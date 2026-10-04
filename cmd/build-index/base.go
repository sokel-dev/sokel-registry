package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// runBase is the pull request gate: the head tree passes admission, and every entry whose files changed against the
// base branch raises its version. Without the bump the platform's "update available" badge and version-matched
// advisories never see the change: installs keep the old contract while the catalog quietly serves a new one.
// A removed entry is a delisting (installed copies keep working, no more updates or advisories); it is reported, not
// refused — review decides.
func runBase(root, baseRoot string) error {
	head, _, err := admit(root)
	if err != nil {
		return err
	}
	base, _, err := build(baseRoot)
	if err != nil {
		return fmt.Errorf("the base branch does not build (fix main first): %w", err)
	}
	baseVer := map[string]string{}
	for _, e := range base.Plugins {
		baseVer[e.Ref] = e.Version
	}
	var problems, notes []string
	for _, e := range head.Plugins {
		old, existed := baseVer[e.Ref]
		delete(baseVer, e.Ref)
		if !existed {
			notes = append(notes, fmt.Sprintf("new entry %s %s", e.Ref, e.Version))
			continue
		}
		same, err := sameTree(entryDir(root, e.Ref), entryDir(baseRoot, e.Ref))
		if err != nil {
			return err
		}
		if same {
			continue
		}
		if c := compareVersions(e.Version, old); c <= 0 {
			problems = append(problems, fmt.Sprintf("%s changed but its version did not go up (base %s, this change %s): raise plugin.version in the manifest", e.Ref, old, e.Version))
			continue
		}
		notes = append(notes, fmt.Sprintf("updated %s %s -> %s", e.Ref, old, e.Version))
	}
	for ref := range baseVer {
		notes = append(notes, "delisted "+ref)
	}
	sort.Strings(notes)
	for _, n := range notes {
		fmt.Println("build-index:", n)
	}
	if len(problems) > 0 {
		sort.Strings(problems)
		return fmt.Errorf("%d entries need a version bump:\n  - %s", len(problems), strings.Join(problems, "\n  - "))
	}
	fmt.Printf("build-index: %d entries pass against the base branch\n", len(head.Plugins))
	return nil
}

func entryDir(root, ref string) string {
	return filepath.Join(root, pluginsSub, filepath.FromSlash(ref))
}

// sameTree reports whether two entry directories hold the same files with the same contents.
func sameTree(a, b string) (bool, error) {
	ha, err := treeHash(a)
	if err != nil {
		return false, err
	}
	hb, err := treeHash(b)
	if err != nil {
		return false, err
	}
	return ha == hb, nil
}

func treeHash(dir string) (string, error) {
	h := sha256.New()
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(dir, p)
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		if isManifestFile(rel) {
			b = withoutCommentLines(b)
		}
		fmt.Fprintf(h, "%s\x00%d\x00", filepath.ToSlash(rel), len(b))
		h.Write(b)
		return nil
	})
	return hex.EncodeToString(h.Sum(nil)), err
}

// compareVersions orders two versions of the form v?MAJOR.MINOR.PATCH(-prerelease)? (admission has validated both):
// numbers compare numerically, a release is above its prereleases, prerelease identifiers compare per semver.
func compareVersions(a, b string) int {
	ca, pa := splitVersion(a)
	cb, pb := splitVersion(b)
	for i := 0; i < 3; i++ {
		if ca[i] != cb[i] {
			if ca[i] < cb[i] {
				return -1
			}
			return 1
		}
	}
	switch {
	case pa == pb:
		return 0
	case pa == "":
		return 1
	case pb == "":
		return -1
	}
	ia, ib := strings.Split(pa, "."), strings.Split(pb, ".")
	for i := 0; i < len(ia) && i < len(ib); i++ {
		if ia[i] == ib[i] {
			continue
		}
		na, ea := strconv.Atoi(ia[i])
		nb, eb := strconv.Atoi(ib[i])
		switch {
		case ea == nil && eb == nil:
			if na < nb {
				return -1
			}
			return 1
		case ea == nil: // numeric identifiers sort below alphanumeric ones
			return -1
		case eb == nil:
			return 1
		case ia[i] < ib[i]:
			return -1
		default:
			return 1
		}
	}
	switch {
	case len(ia) < len(ib):
		return -1
	case len(ia) > len(ib):
		return 1
	}
	return 0
}

func splitVersion(v string) ([3]int, string) {
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	core, pre, _ := strings.Cut(v, "-")
	var n [3]int
	for i, part := range strings.SplitN(core, ".", 3) {
		n[i], _ = strconv.Atoi(part)
	}
	return n, pre
}

func isManifestFile(rel string) bool {
	switch filepath.ToSlash(rel) {
	case "manifest.yml", "manifest.yaml":
		return true
	}
	return false
}

// withoutCommentLines drops whole-line YAML comments: they do not change what the manifest declares, so editing
// them is not a new version. End-of-line comments stay (a # inside a value is not always a comment).
func withoutCommentLines(b []byte) []byte {
	var out []string
	for _, line := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}
		out = append(out, line)
	}
	return []byte(strings.Join(out, "\n"))
}
