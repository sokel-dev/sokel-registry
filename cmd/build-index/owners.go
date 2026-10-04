package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// codeownersPath is where GitHub reads code owners. Each org directory needs a line naming who maintains it, so
// "who may change sokel/foo" is written down and enforced by review (branch protection: require code owner review),
// not remembered. An org without a line would fall back to the catch-all owner silently.
const codeownersPath = ".github/CODEOWNERS"

// verifyOwners checks that every plugins/<org>/ has its own CODEOWNERS line. No CODEOWNERS file = not checked
// (a private registry may not use GitHub at all).
func verifyOwners(root string) error {
	f, err := os.Open(filepath.Join(root, codeownersPath))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", codeownersPath, err)
	}
	defer f.Close()
	owned := map[string]bool{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 2 || strings.HasPrefix(fields[0], "#") {
			continue
		}
		p := strings.TrimSuffix(strings.TrimSuffix(strings.TrimPrefix(fields[0], "/"), "**"), "/")
		if org, ok := strings.CutPrefix(p, pluginsSub+"/"); ok && org != "" && !strings.Contains(org, "/") {
			owned[org] = true
		}
	}
	if err := sc.Err(); err != nil {
		return err
	}
	orgs, err := os.ReadDir(filepath.Join(root, pluginsSub))
	if err != nil {
		return err
	}
	var missing []string
	for _, o := range orgs {
		if o.IsDir() && !owned[o.Name()] {
			missing = append(missing, o.Name())
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return fmt.Errorf("these orgs have no line in %s: %s — add `/plugins/<org>/ @your-github-handle` so the org has a named maintainer",
			codeownersPath, strings.Join(missing, ", "))
	}
	return nil
}
