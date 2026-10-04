// build-index collects the registry directory into a single index.json.
//
// It lives in the registry rather than the plugin SDK because directory layout, index format and
// index version are the registry's own business: changing the index format shouldn't force an SDK
// release, and plugin authors' toolchains shouldn't carry marketplace operations code they will
// never run. The SDK provides only what it should: parsing and validating a single manifest.
//
// The real seam is the index.json format, not this binary: a third party running a private
// registry can rewrite it in any language as long as the output matches the format.
//
//	go run ./cmd/build-index -o index.json .           # write the index
//	go run ./cmd/build-index -base ../base .           # PR gate: changed entries must bump their version
//	go run ./cmd/build-index -site _site .             # the published tree (site + index + files + details)
//
// Every mode runs the same admission first (each manifest exports a contract, versions are valid, the
// directory is the identity, advisories point at real entries, every org has a CODEOWNERS line).
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/sokel-dev/sokel-plugin-sdk/sokelgen"
)

// pluginsSub is the directory holding the entries, laid out as plugins/<org>/<name>/manifest.yml.
// The path is the identity claim: reviewers look at which directory you changed, and under GitOps
// that is exactly where CODEOWNERS can gate.
const pluginsSub = "plugins"

// indexVersion is the index format version. The platform rejects the whole index on an unknown
// version: best-effort parsing of an index it can't understand would drop half the store's plugins
// with nobody knowing why.
const indexVersion = 2

// entry is one index item: enough to render a store card, without the full contract (fetched at
// install time).
type entry = sokelgen.IndexEntry

type index struct {
	Version int     `json:"version"`
	Plugins []entry `json:"plugins"`
}

func main() {
	out := flag.String("o", "", "write to this file (default: stdout)")
	check := flag.Bool("check", false, "only check that the written index is up to date, without changing files (for CI)")
	base := flag.String("base", "", "a checkout of the base branch: every entry that changed must raise its version")
	site := flag.String("site", "", "write the published tree into this directory (site files, index, advisories, entry files, details)")
	flag.Parse()
	root := "."
	if flag.NArg() > 0 {
		root = flag.Arg(0)
	}
	// -check without -o used to silently take the stdout branch and never compare: in CI it was an
	// always-green empty guard (confirmed).
	if *check && *out == "" {
		*out = filepath.Join(root, "index.json")
	}
	var err error
	switch {
	case *base != "":
		err = runBase(root, *base)
	case *site != "":
		err = runSite(root, *site)
	default:
		err = run(root, *out, *check)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "build-index:", err)
		os.Exit(1)
	}
}

// admit runs the admission shared by every mode: the entries, the advisories, the owners.
func admit(root string) (*index, map[string]*sokelgen.Manifest, error) {
	idx, mans, err := build(root)
	if err != nil {
		return nil, nil, err
	}
	if err := verifyAdvisories(root, idx); err != nil {
		return nil, nil, err
	}
	if err := verifyOwners(root); err != nil {
		return nil, nil, err
	}
	return idx, mans, nil
}

func run(root, out string, check bool) error {
	idx, _, err := admit(root)
	if err != nil {
		return err
	}
	b, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	if out == "" {
		fmt.Print(string(b))
		return nil
	}
	if check {
		cur, rerr := os.ReadFile(out)
		if rerr != nil {
			return fmt.Errorf("%s does not exist; run: go run ./cmd/build-index -o %s %s", out, out, root)
		}
		if string(cur) != string(b) {
			return fmt.Errorf("%s is stale (entries changed but the index was not rebuilt); run: go run ./cmd/build-index -o %s %s", out, out, root)
		}
		fmt.Printf("build-index: %s is up to date (%d plugins)\n", out, len(idx.Plugins))
		return nil
	}
	if err := os.WriteFile(out, b, 0o644); err != nil {
		return err
	}
	fmt.Printf("build-index: wrote %s (%d plugins)\n", out, len(idx.Plugins))
	return nil
}

// build walks <root>/plugins/<org>/<name>/.
//
// Every entry goes through the SDK's normal load path (including validation); anything that fails
// `sokel-gen check` stays out of the index. Publishing a broken manifest would turn one author's
// mistake into every installer's problem.
func build(root string) (*index, map[string]*sokelgen.Manifest, error) {
	base := filepath.Join(root, pluginsSub)
	orgs, err := os.ReadDir(base)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read %s: %w", base, err)
	}
	idx := &index{Version: indexVersion, Plugins: []entry{}}
	mans := map[string]*sokelgen.Manifest{}
	var problems []string
	for _, org := range orgs {
		if !org.IsDir() {
			continue
		}
		names, nerr := os.ReadDir(filepath.Join(base, org.Name()))
		if nerr != nil {
			return nil, nil, nerr
		}
		for _, name := range names {
			if !name.IsDir() {
				continue
			}
			e, m, eerr := one(root, filepath.Join(base, org.Name(), name.Name()), org.Name(), name.Name())
			if eerr != nil {
				problems = append(problems, eerr.Error())
				continue
			}
			idx.Plugins = append(idx.Plugins, *e)
			mans[e.Ref] = m
		}
	}
	if len(problems) > 0 {
		sort.Strings(problems)
		return nil, nil, fmt.Errorf("%d entries could not be indexed:\n  - %s", len(problems), strings.Join(problems, "\n  - "))
	}
	sort.Slice(idx.Plugins, func(i, j int) bool { return idx.Plugins[i].Ref < idx.Plugins[j].Ref })
	return idx, mans, nil
}

func one(root, dir, org, name string) (*entry, *sokelgen.Manifest, error) {
	path, ferr := sokelgen.FindManifest(dir)
	if ferr != nil {
		return nil, nil, fmt.Errorf("%s/%s: %w", org, name, ferr)
	}
	if path == "" {
		return nil, nil, fmt.Errorf("%s/%s: no manifest in %s", org, name, dir)
	}
	m, lerr := sokelgen.LoadManifest(path)
	if lerr != nil {
		return nil, nil, fmt.Errorf("%s/%s: %w", org, name, lerr)
	}
	// The directory is the identity; the manifest merely restates it. A mismatch can't be papered
	// over: reviewers would read one thing while installers get another.
	if m.Plugin.Org != "" && m.Plugin.Org != org {
		return nil, nil, fmt.Errorf("%s/%s: manifest says org=%q, but it is under directory %q", org, name, m.Plugin.Org, org)
	}
	if m.Plugin.Name != "" && m.Plugin.Name != name {
		return nil, nil, fmt.Errorf("%s/%s: manifest says name=%q, but the directory is %q", org, name, m.Plugin.Name, name)
	}
	// Derivation belongs to the SDK (sokelgen.BuildIndexEntry): the distribution gate's two admission
	// checks (version present and valid / contract actually exportable) and the stats fields live
	// there. The index is about to get a second producer (the platform's registry-tools plugin,
	// building from approved submissions in its pipeline), so sharing the code keeps them from
	// drifting. Path fields belong here (based on what is on disk).
	doc, derr := m.DocMarkdown()
	if derr != nil {
		return nil, nil, fmt.Errorf("%s/%s: failed to read usage docs: %w", org, name, derr)
	}
	ie, berr := sokelgen.BuildIndexEntry(m, doc)
	if berr != nil {
		return nil, nil, fmt.Errorf("%s/%s: %w", org, name, berr)
	}
	rel, rerr := filepath.Rel(root, filepath.Join(dir, "manifest.yml"))
	if rerr != nil {
		rel = filepath.Join(dir, "manifest.yml")
	}
	files := []string{"manifest.yml"}
	if lf, lerr := os.ReadDir(filepath.Join(dir, "locales")); lerr == nil {
		for _, e := range lf {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
				files = append(files, "locales/"+e.Name())
			}
		}
	}
	if _, rerr := os.Stat(filepath.Join(dir, "README.md")); rerr == nil {
		files = append(files, "README.md")
	}
	ie.Manifest, ie.Files = filepath.ToSlash(rel), files
	return ie, m, nil
}

// Security advisory validation.
//
// advisories.json is the single entry point for "these versions of this plugin have a problem"
// (the platform consumes it alongside the index; a match marks the plugin red / raises an alert /
// blocks calls under block). Only structure and references are checked here: ref must be an index
// entry and all fields must be present. An advisory with a wrong ref silently matches nothing,
// which is as if it were never issued (worse than rejecting it). Semantics (whether to flag at
// all) are up to review.
type advisory struct {
	Ref       string   `json:"ref"`
	Versions  []string `json:"versions"`
	Severity  string   `json:"severity"`
	Reason    string   `json:"reason"`
	URL       string   `json:"url,omitempty"`
	Published string   `json:"published"`
}

type advisoryFile struct {
	Version    int        `json:"version"`
	Advisories []advisory `json:"advisories"`
}

// Version format (finalized 2026-09-06).
//
// `v?MAJOR.MINOR.PATCH(-prerelease)?`, required in the manifest. Three consumers depend on it:
//
//	updateAvailable deciding whether the catalog changed, advisories matching by version, and ordering in range syntax.
//
// Without a format, range comparison is meaningless; entries without a version would keep "update
// available" and advisories silent forever. (The regex itself moved into the SDK along with
// derivation: sokelgen.BuildIndexEntry / ValidVersionExpr.)

// validVersionExpr validates one item of an advisory's versions[]: an exact version, or a range
// prefixed with <, <=, > or >=. The implementation lives in the SDK (shared with entry derivation).
func validVersionExpr(s string) bool { return sokelgen.ValidVersionExpr(s) }

func verifyAdvisories(root string, idx *index) error {
	path := filepath.Join(root, "advisories.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // having no advisories file is a valid state
		}
		return fmt.Errorf("failed to read advisories.json: %w", err)
	}
	var f advisoryFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return fmt.Errorf("advisories.json is not valid JSON: %w", err)
	}
	if f.Version != 1 {
		return fmt.Errorf("advisories.json version=%d is unknown (this tool only understands 1)", f.Version)
	}
	refs := map[string]bool{}
	for _, p := range idx.Plugins {
		refs[p.Ref] = true
	}
	for i, a := range f.Advisories {
		if !refs[a.Ref] {
			return fmt.Errorf("advisories[%d]: ref %q is not in the index (an advisory with a wrong ref silently matches nothing)", i, a.Ref)
		}
		if len(a.Versions) == 0 {
			return fmt.Errorf("advisories[%d] (%s): versions must not be empty; list them explicitly even when pulling every version", i, a.Ref)
		}
		if a.Severity != "warn" && a.Severity != "block" {
			return fmt.Errorf("advisories[%d] (%s): severity %q must be warn|block", i, a.Ref, a.Severity)
		}
		if a.Reason == "" {
			return fmt.Errorf("advisories[%d] (%s): reason is required; users decide their next step from it", i, a.Ref)
		}
		for _, v := range a.Versions {
			if !validVersionExpr(v) {
				return fmt.Errorf("advisories[%d] (%s): invalid version expression %q; use an exact version (v1.2.3) or a range (<v1.2.3 / <=… / >… / >=…)", i, a.Ref, v)
			}
		}
	}
	return nil
}
