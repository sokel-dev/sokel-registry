package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fixture writes a registry tree: entries maps "org/name" to its version (empty = no plugin.version), owners is the
// CODEOWNERS content ("" = no file).
func fixture(t *testing.T, entries map[string]string, owners string) string {
	t.Helper()
	root := t.TempDir()
	for ref, ver := range entries {
		org, name, _ := strings.Cut(ref, "/")
		v := ""
		if ver != "" {
			v = ", version: " + ver
		}
		m := "plugin: {name: " + name + ", org: " + org + ", label: " + name + ", desc: test" + v + "}\n" +
			"operations:\n  - {id: ping, label: Ping, inputs: [], outputs: []}\n"
		mustWrite(t, filepath.Join(root, "plugins", org, name, "manifest.yml"), m)
		mustWrite(t, filepath.Join(root, "plugins", org, name, "locales", "en.json"), "{}\n")
	}
	if owners != "" {
		mustWrite(t, filepath.Join(root, ".github", "CODEOWNERS"), owners)
	}
	mustWrite(t, filepath.Join(root, "site", "index.html"), "<!doctype html>\n")
	return root
}

func mustWrite(t *testing.T, p, s string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(s), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.0.1", "1.0.0", 1},
		{"v1.0.0", "1.0.0", 0},
		{"1.10.0", "1.9.9", 1},
		{"2.0.0", "10.0.0", -1},
		{"1.0.0", "1.0.0-rc.1", 1},
		{"1.0.0-rc.2", "1.0.0-rc.10", -1},
		{"1.0.0-alpha", "1.0.0-1", 1},
		{"1.0.0-rc", "1.0.0-rc.1", -1},
	}
	for _, c := range cases {
		if got := compareVersions(c.a, c.b); got != c.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestOwners(t *testing.T) {
	cases := []struct {
		name, owners, wantErr string
	}{
		{"no CODEOWNERS file: not checked", "", ""},
		{"every org has a line", "* @a\n/plugins/acme/ @a\nplugins/beta/** @b\n", ""},
		{"an org without a line", "* @a\n/plugins/acme/ @a\n", "beta"},
		{"a comment does not count", "* @a\n/plugins/acme/ @a\n# /plugins/beta/ @b\n", "beta"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			root := fixture(t, map[string]string{"acme/foo": "1.0.0", "beta/bar": "1.0.0"}, c.owners)
			err := verifyOwners(root)
			if c.wantErr == "" && err != nil {
				t.Fatalf("unexpected: %v", err)
			}
			if c.wantErr != "" && (err == nil || !strings.Contains(err.Error(), c.wantErr)) {
				t.Fatalf("want an error naming %q, got %v", c.wantErr, err)
			}
		})
	}
}

// The pull request gate: an entry whose files changed must raise its version; an untouched entry, a new entry and
// a removed one (delisting) pass.
func TestBaseGate(t *testing.T) {
	owners := "* @a\n/plugins/acme/ @a\n"
	cases := []struct {
		name    string
		head    map[string]string
		edit    string // a file under the head tree to change ("" = none)
		wantErr string
	}{
		{"nothing changed", map[string]string{"acme/foo": "1.0.0", "acme/bar": "2.0.0"}, "", ""},
		{"changed and bumped", map[string]string{"acme/foo": "1.0.1", "acme/bar": "2.0.0"}, "", ""},
		{"changed, version kept", map[string]string{"acme/foo": "1.0.0", "acme/bar": "2.0.0"}, "plugins/acme/foo/locales/en.json", "acme/foo changed but its version did not go up"},
		{"version went down", map[string]string{"acme/foo": "0.9.0", "acme/bar": "2.0.0"}, "", "acme/foo"},
		{"new entry", map[string]string{"acme/foo": "1.0.0", "acme/bar": "2.0.0", "acme/new": "0.1.0"}, "", ""},
		// Comments do not change what a manifest declares: no version bump for a comment-only edit.
		{"comment-only change", map[string]string{"acme/foo": "1.0.0", "acme/bar": "2.0.0"}, "comment:plugins/acme/foo/manifest.yml", ""},
		{"removed entry", map[string]string{"acme/foo": "1.0.0"}, "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			base := fixture(t, map[string]string{"acme/foo": "1.0.0", "acme/bar": "2.0.0"}, owners)
			head := fixture(t, c.head, owners)
			if f, ok := strings.CutPrefix(c.edit, "comment:"); ok {
				raw, _ := os.ReadFile(filepath.Join(head, f))
				mustWrite(t, filepath.Join(head, f), "# a note for maintainers\n"+string(raw)+"  # trailing note\n")
			} else if c.edit != "" {
				mustWrite(t, filepath.Join(head, c.edit), "{\"Ping\": \"Ping it\"}\n")
			}
			err := runBase(head, base)
			if c.wantErr == "" && err != nil {
				t.Fatalf("unexpected: %v", err)
			}
			if c.wantErr != "" && (err == nil || !strings.Contains(err.Error(), c.wantErr)) {
				t.Fatalf("want an error containing %q, got %v", c.wantErr, err)
			}
		})
	}
}

// Admission still refuses a broken tree in every mode: a missing version here.
func TestAdmissionRefusesMissingVersion(t *testing.T) {
	root := fixture(t, map[string]string{"acme/foo": ""}, "")
	if err := runSite(root, filepath.Join(t.TempDir(), "out")); err == nil {
		t.Fatal("an entry without plugin.version must not be published")
	}
}

// The published tree holds what platforms and the page read, at the paths they read it from.
func TestSiteTree(t *testing.T) {
	root := fixture(t, map[string]string{"acme/foo": "1.2.0"}, "* @a\n/plugins/acme/ @a\n")
	out := filepath.Join(t.TempDir(), "out")
	if err := runSite(root, out); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{"index.html", "index.json", "advisories.json", ".nojekyll",
		"plugins/acme/foo/manifest.yml", "plugins/acme/foo/locales/en.json", "details/acme/foo.json"} {
		if _, err := os.Stat(filepath.Join(out, p)); err != nil {
			t.Errorf("published tree is missing %s", p)
		}
	}
	var idx index
	raw, _ := os.ReadFile(filepath.Join(out, "index.json"))
	if err := json.Unmarshal(raw, &idx); err != nil || len(idx.Plugins) != 1 || idx.Plugins[0].Ref != "acme/foo" {
		t.Fatalf("index.json: %v %s", err, raw)
	}
	var detail map[string]any
	raw, _ = os.ReadFile(filepath.Join(out, "details/acme/foo.json"))
	if err := json.Unmarshal(raw, &detail); err != nil || detail["version"] != "1.2.0" {
		t.Errorf("details carry the manifest: %v %s", err, raw)
	}
}

// An icon file travels with the entry (listed in files, copied into the published tree); a brand mark must exist in
// the page's brand table; an unsafe icon never gets in.
func TestIcons(t *testing.T) {
	setIcon := func(t *testing.T, root, icon string) {
		p := filepath.Join(root, "plugins/acme/foo/manifest.yml")
		raw, _ := os.ReadFile(p)
		mustWrite(t, p, strings.Replace(string(raw), "desc: test", "desc: test, icon: "+icon, 1))
	}
	root := fixture(t, map[string]string{"acme/foo": "1.0.0"}, "")
	setIcon(t, root, "icon.svg")
	mustWrite(t, filepath.Join(root, "plugins/acme/foo/icon.svg"), `<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`)
	out := filepath.Join(t.TempDir(), "out")
	if err := runSite(root, out); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(filepath.Join(out, "index.json"))
	var idx index
	_ = json.Unmarshal(raw, &idx)
	e := idx.Plugins[0]
	if e.Icon != "icon.svg" || !strings.Contains(strings.Join(e.Files, ","), "icon.svg") {
		t.Errorf("the icon is on the entry and in its files: %+v", e)
	}
	if _, err := os.Stat(filepath.Join(out, "plugins/acme/foo/icon.svg")); err != nil {
		t.Error("the icon is published with the entry")
	}

	mustWrite(t, filepath.Join(root, "plugins/acme/foo/icon.svg"), `<svg viewBox="0 0 24 24" onload="alert(1)"/>`)
	if err := runSite(root, filepath.Join(t.TempDir(), "out")); err == nil {
		t.Error("an unsafe icon must not be published")
	}

	root = fixture(t, map[string]string{"acme/foo": "1.0.0"}, "")
	mustWrite(t, filepath.Join(root, brandsFile), "window.SOKEL_BRANDS = {\n \"gitlab\": {\"label\": \"GitLab\"}\n};\n")
	setIcon(t, root, "brand:gitlab")
	if err := runSite(root, filepath.Join(t.TempDir(), "out")); err != nil {
		t.Errorf("a known brand: %v", err)
	}
	root = fixture(t, map[string]string{"acme/foo": "1.0.0"}, "")
	mustWrite(t, filepath.Join(root, brandsFile), "window.SOKEL_BRANDS = {\n \"gitlab\": {\"label\": \"GitLab\"}\n};\n")
	setIcon(t, root, "brand:gitlabb")
	if err := runSite(root, filepath.Join(t.TempDir(), "out")); err == nil || !strings.Contains(err.Error(), "not a known brand") {
		t.Errorf("a misspelled brand must be refused: %v", err)
	}
}
