<!-- Thanks! CI checks the mechanics; reviewers check what CI cannot. -->

**What this changes**

- [ ] New plugin `org/name`
- [ ] New version of `org/name` (`plugin.version` raised)
- [ ] Security advisory (`advisories.json`)
- [ ] Delisting
- [ ] Docs / tooling

**For a plugin**

- Source repository:
- How it runs (image / binary, where it is published):
- Credentials it asks for, and where they go:
- Icon (`plugin.icon`: `icon.svg` / `icon.png` in the entry, or `brand:<id>`):
- [ ] `go run ./cmd/build-index -site _site .` passes locally
- [ ] First plugin of a new org: this PR adds `/plugins/<org>/ @handle` to `.github/CODEOWNERS`
