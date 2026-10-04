package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// brandsFile lists the brand marks the page can draw (generated from the platform's brand registry). A plugin.icon
// of brand:<id> naming one that is not there is a typo, and the plugin would silently show a letter instead.
const brandsFile = "site/brands.js"

var brandKeyRe = regexp.MustCompile(`(?m)^ "([a-z0-9-]+)": \{`)

func checkBrand(root, icon string) error {
	raw, err := os.ReadFile(filepath.Join(root, brandsFile))
	if err != nil {
		return nil // no brand table (a private registry without the page): nothing to check against
	}
	id := strings.TrimPrefix(icon, "brand:")
	for _, m := range brandKeyRe.FindAllStringSubmatch(string(raw), -1) {
		if m[1] == id {
			return nil
		}
	}
	return fmt.Errorf("plugin.icon %s is not a known brand mark (see %s); use one listed there, or ship an icon.svg", icon, brandsFile)
}
