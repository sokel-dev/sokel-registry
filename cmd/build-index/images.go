package main

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/sokel-dev/sokel-plugin-sdk/sokelgen"
)

// The catalog's version gate and its advisories are keyed by version, so an entry's image has to stay what it was
// when the version was reviewed. A moving tag defeats both: `latest` silently becomes a different program a month
// later, and a digest is the only reference a registry cannot repoint. Checked for entries that change (the ratchet
// in runBase): nothing already published goes red, and every new version has to pin.
//
//   - any org: a container target needs a tag or a digest, and the tag must not be `latest`;
//   - the sokel org (released by the official plugins' Release workflow, which prints the digest): the digest is
//     required;
//   - other orgs: a missing digest is noted, not refused — yet.
var digestRe = regexp.MustCompile(`@sha256:[0-9a-f]{64}$`)

func imageProblems(ref string, m *sokelgen.Manifest) (problems, notes []string) {
	if m == nil || m.Deployment == nil {
		return nil, nil
	}
	official := strings.HasPrefix(ref, "sokel/")
	for _, t := range m.Deployment.Targets {
		if t.Kind != "container" {
			continue
		}
		img := t.Ref
		pinned := digestRe.MatchString(img)
		name := digestRe.ReplaceAllString(img, "")
		tag := ""
		if i := strings.LastIndex(name, ":"); i > strings.LastIndex(name, "/") {
			tag = name[i+1:]
		}
		switch {
		case tag == "latest":
			problems = append(problems, fmt.Sprintf("%s: image %q uses the latest tag: pin the release (image:1.2.0@sha256:…)", ref, img))
		case tag == "" && !pinned:
			problems = append(problems, fmt.Sprintf("%s: image %q has no tag: pin the release (image:1.2.0@sha256:…)", ref, img))
		case official && !pinned:
			problems = append(problems, fmt.Sprintf("%s: official entries pin the image by digest (image:1.2.0@sha256:…), got %q", ref, img))
		case !pinned:
			notes = append(notes, fmt.Sprintf("%s: image %q is not pinned by digest; a tag can be repointed, a digest cannot", ref, img))
		}
	}
	return problems, notes
}
