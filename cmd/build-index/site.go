package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/sokel-dev/sokel-plugin-sdk/sokelgen"
)

// siteSub holds the static marketplace page (no build step: it reads the JSON below).
const siteSub = "site"

// runSite writes the published tree, the one directory a static host serves:
//
//	index.html, app.js, …              the marketplace page
//	index.json                         the catalog (platforms read <base>/index.json)
//	advisories.json                    security advisories (platforms read <base>/advisories.json)
//	plugins/<org>/<name>/<files>       each entry's files, as listed in the index (remote installs fetch these)
//	details/<org>/<name>.json          the full manifest as JSON with its doc: the page's detail view
//
// index.json is a build product here, not a file in the repository: two pull requests never conflict on it, and
// what is served is always what the merged entries say.
func runSite(root, out string) error {
	idx, mans, err := admit(root)
	if err != nil {
		return err
	}
	if err := os.RemoveAll(out); err != nil {
		return err
	}
	if err := copyDir(filepath.Join(root, siteSub), out); err != nil {
		return fmt.Errorf("failed to copy the page: %w", err)
	}
	b, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return err
	}
	if err := writeFile(filepath.Join(out, "index.json"), append(b, '\n')); err != nil {
		return err
	}
	adv, err := os.ReadFile(filepath.Join(root, "advisories.json"))
	if os.IsNotExist(err) {
		adv, err = []byte("{\"version\": 1, \"advisories\": []}\n"), nil
	}
	if err != nil {
		return err
	}
	if err := writeFile(filepath.Join(out, "advisories.json"), adv); err != nil {
		return err
	}
	for _, e := range idx.Plugins {
		dir := filepath.Dir(filepath.FromSlash(e.Manifest))
		for _, f := range e.Files {
			src := filepath.Join(root, dir, filepath.FromSlash(f))
			if strings.HasSuffix(e.Manifest, "/"+f) || f == filepath.Base(e.Manifest) {
				// The index always lists the manifest as manifest.yml; the file on disk may be .yaml / .json.
				if p, ferr := sokelgen.FindManifest(filepath.Join(root, dir)); ferr == nil && p != "" {
					src = p
				}
			}
			raw, rerr := os.ReadFile(src)
			if rerr != nil {
				return fmt.Errorf("%s: %w", e.Ref, rerr)
			}
			if err := writeFile(filepath.Join(out, dir, filepath.FromSlash(f)), raw); err != nil {
				return err
			}
		}
		m := mans[e.Ref]
		doc, derr := m.DocMarkdown()
		if derr != nil {
			return fmt.Errorf("%s: %w", e.Ref, derr)
		}
		detail, xerr := sokelgen.ExportManifestJSON(m, doc)
		if xerr != nil {
			return fmt.Errorf("%s: %w", e.Ref, xerr)
		}
		if err := writeFile(filepath.Join(out, "details", filepath.FromSlash(e.Ref)+".json"), detail); err != nil {
			return err
		}
	}
	// GitHub Pages runs Jekyll by default, which drops files and directories it does not like.
	if err := writeFile(filepath.Join(out, ".nojekyll"), nil); err != nil {
		return err
	}
	fmt.Printf("build-index: wrote the published tree to %s (%d plugins)\n", out, len(idx.Plugins))
	return nil
}

func writeFile(path string, b []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o644)
}

func copyDir(src, dst string) error {
	return filepath.Walk(src, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, p)
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		in, err := os.Open(p)
		if err != nil {
			return err
		}
		defer in.Close()
		outF, err := os.Create(target)
		if err != nil {
			return err
		}
		defer outF.Close()
		_, err = io.Copy(outF, in)
		return err
	})
}
