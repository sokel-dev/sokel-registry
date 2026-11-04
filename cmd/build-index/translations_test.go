package main

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"unicode"

	"github.com/sokel-dev/sokel-plugin-sdk/sokelgen"
)

// Official entries promise an English/Chinese interface, including the whole
// usage guide. Keep this as a repository regression check, not an admission rule
// for external publishers. Builtins without a guide do not need to invent one.
func TestOfficialPluginTranslations(t *testing.T) {
	root := filepath.Join("..", "..", pluginsSub, "sokel")
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	checked := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		checked++
		t.Run(entry.Name(), func(t *testing.T) {
			path, err := sokelgen.FindManifest(filepath.Join(root, entry.Name()))
			if err != nil || path == "" {
				t.Fatalf("find official manifest: path=%q, err=%v", path, err)
			}
			m, err := sokelgen.LoadManifest(path)
			if err != nil {
				t.Fatal(err)
			}
			doc, err := m.DocMarkdown()
			if err != nil {
				t.Fatal(err)
			}
			if strings.TrimSpace(doc) != "" {
				translated := false
				for _, lang := range []string{"en", "zh-CN"} {
					// The entire unmodified document is the lookup key, including
					// whitespace. A filename or excerpt would never translate the
					// guide shown by the platform. Semantic completeness still
					// belongs in review; this prevents a buttons-only catalog.
					value := strings.TrimSpace(m.Locales[lang][doc])
					if value != "" && value != strings.TrimSpace(doc) {
						translated = true
						break
					}
				}
				if !translated {
					t.Errorf("%s needs a nonempty, different en or zh-CN translation keyed by its exact complete Markdown (%d bytes)", m.Plugin.Doc, len(doc))
				}
			}

			// Use the SDK's source set, which includes plugin/operation/event
			// labels and descriptions plus nested field labels, descriptions,
			// help, placeholders and option labels across all capabilities.
			// Deployment metadata is deliberately excluded: SDK v0.7.7 does
			// not accept those strings as locale keys.
			sources := m.TranslatableStrings()
			keys := make([]string, 0, len(sources))
			for source := range sources {
				if source != doc && strings.ContainsFunc(source, func(r rune) bool { return unicode.Is(unicode.Han, r) }) {
					keys = append(keys, source)
				}
			}
			sort.Strings(keys)
			for _, source := range keys {
				translation := strings.TrimSpace(m.Locales["en"][source])
				if translation == "" || translation == strings.TrimSpace(source) {
					t.Errorf("contract needs an English translation for %q", source)
				}
			}
		})
	}
	if checked == 0 {
		t.Fatal("no official plugin manifests were checked")
	}
}
