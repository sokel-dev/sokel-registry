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
		{"removed entry", map[string]string{"acme/foo": "1.0.0"}, "", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			base := fixture(t, map[string]string{"acme/foo": "1.0.0", "acme/bar": "2.0.0"}, owners)
			head := fixture(t, c.head, owners)
			if c.edit != "" {
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
