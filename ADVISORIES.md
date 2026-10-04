# Security advisories (advisories.json)

English · [简体中文](ADVISORIES.zh-CN.md)

The one place to say "these versions of this plugin have a problem". Platforms read it with the catalog: an
installed version that matches is flagged in the marketplace, the plugin list and the plugin page, and raises a
platform alert; `block` also **refuses the plugin's calls** (the error names the reason and the link).

**Trust:** platforms trust only this file, changed through reviewed pull requests. Nothing a plugin says about
itself counts.

Entry shape (elements of the `advisories` array):

```json
{
  "ref": "sokel/example",           // full <org>/<name>
  "versions": ["<v1.2.0"],          // affected versions: exact ("v1.0.1") or a range (<, <=, >, >= prefix)
  "severity": "warn",               // warn = flag it; block = also refuse calls
  "reason": "credentials may be written to debug logs",
  "url": "https://…/GHSA-xxxx",      // details, optional
  "published": "2026-09-06"
}
```

To add one: open a pull request editing this file. CI checks that the ref exists and the fields are valid (locally:
`go run ./cmd/build-index -site _site .`); once merged it is published with the catalog. For a vulnerability that is
not public yet, use GitHub's private vulnerability reporting first — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Version expressions

Each item of `versions` is an **exact version** or a **range**:

- Exact: `"v1.0.1"` — compared with the installed version after normalizing (the `v` prefix does not matter).
- Range: `"<v1.2.0"` / `"<=…"` / `">…"` / `">=…"` — semver ordering. The usual case, "fixed in v1.2.0, everything
  before is affected", is `["<v1.2.0"]`.
- Format: `v?MAJOR.MINOR.PATCH(-prerelease)?`; build-index refuses the whole file on a malformed one.
- An installed version that cannot be parsed never matches a range (unknown is not affected); exact items fall back
  to comparing the strings, so an advisory that named a malformed version still works.
