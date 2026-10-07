# Contributing

English · [简体中文](CONTRIBUTING.zh-CN.md)

Everything here changes through pull requests. CI checks the mechanics; a code owner reviews the rest.

## Add a plugin

1. **Write and publish the plugin.** Use the [plugin SDK](https://github.com/sokel-dev/sokel-plugin-sdk); its
   `sokel-plugin-dev` skill lets a local coding agent do most of the work. Publish something people can run — an
   image in a public registry, or a release binary — and keep the source public.
2. **Pick your org.** `org` is the publisher: your GitHub user or organization name, lowercase. It cannot be `sokel`
   (that org is for plugins maintained in the Sokel project).
3. **Add the entry.** Create `plugins/<org>/<name>/manifest.yml` (`sokel-gen` can export it from your plugin), with
   `plugin.org` and `plugin.name` matching the directory and a `plugin.version`. Write the manifest's display text
   (`label`, `desc`, `help`, `placeholder`) in **Chinese** and translate every string in **`locales/en.json`**
   (Chinese source string → English): platforms and this page show the manifest as written in Chinese and look strings
   up in that table in English, falling back to Chinese. `README.md` (optional) is one file shown as is in both, so
   write it in Chinese, or Chinese then English.
4. **Give it an icon** (optional, recommended): set `plugin.icon` in the manifest to
   - `icon.svg` / `icon.png` — a file in the entry directory, or
   - `brand:<id>` — one of the built-in brand marks listed in `site/brands.js` (e.g. `brand:gitlab`).

   The file is checked by CI: SVG with no scripts, event handlers or external references, at most 32 KB; PNG at least
   128×128 and at most 64 KB; about square. Platforms serve it themselves, so it never loads from anyone else's server.
   Without an icon the plugin shows a letter.
5. **First plugin of a new org:** in the same pull request, add `/plugins/<org>/ @your-handle` to
   `.github/CODEOWNERS`. From then on, changes under your org need your approval.
6. **Check locally:** `go run ./cmd/build-index -site _site .` must pass.
7. **Open the pull request** and fill in the template.

What reviewers look at, beyond CI:

- the org really is yours, and the name does not impersonate another product or publisher;
- the credentials it asks for are what it needs, and the docs say where they go;
- the image or binary in `deployment` comes from the source you link, and that source is public;
- the container image is pinned: a tag that is not `latest`, best with its digest (`image:1.2.0@sha256:…`). CI refuses
  `latest` and untagged images for every entry that changes; `sokel/*` entries must carry the digest, other orgs are
  reminded. A digest is the only reference a registry cannot repoint, and the catalog's versions and advisories are
  only meaningful if the image stays what was reviewed;
- the usage doc tells a stranger how to get it running.

## Official entries (`plugins/sokel/`)

The `sokel` org's entries are maintained here, like everyone else's: change them by pull request with a version bump,
and the Sokel maintainers review them. Some sections are generated, so edit them with the tool rather than by hand:
the contract sections of model vendors and other shell-backed plugins come from the platform's shell schemas (the
`reembed-llm` / `reembed-shell` tools in the platform repository), and `site/brands.js` from the platform's brand
registry. Releases of the [official plugins](https://github.com/sokel-dev/sokel-official-plugins) arrive as pull
requests opened by that repository's Release workflow (tag `<plugin>/vX.Y.Z` there): the entry's contract is rewritten
from the plugin's code and the image is pinned by digest; a maintainer reviews and merges. The platform ships a
snapshot of this repository at a pinned commit; a merged change reaches its built-in catalog when that pin moves, and
platforms that use this site as a refresh source sooner.

## Publish a new version

Change the files under your entry and **raise `plugin.version`**. CI compares against `main` and refuses a change
that keeps or lowers the version: platforms decide "update available" and match advisories by version, so a change
without a bump would be invisible to them. Point `deployment.targets[].ref` at the new image (pinned, see above).
Your org's code owner approves it.

## Report a problem with a published version (security advisory)

- **Already public, or low risk:** open a pull request adding an entry to `advisories.json` (syntax in
  [ADVISORIES.md](ADVISORIES.md)). `warn` flags the version; `block` makes platforms refuse its calls.
- **Not public yet:** use GitHub's private vulnerability reporting (Security → Report a vulnerability) so it can be
  fixed before it is announced.

Once merged, an advisory reaches platforms that use this site as a refresh source at their next refresh, and every
platform release after that carries it in its built-in snapshot.

Fix it with a new version, and list the affected range (for example `["<v1.2.0"]`) in the advisory.

## Delist a plugin

Remove its directory. Installed copies keep working, but get no more updates or advisories. Delisting needs a
maintainer's approval.

## After the merge

The publish workflow rebuilds `index.json` and deploys the page within minutes. Platforms that use this site as a
refresh source pick it up at their next refresh (every 12 hours, or "sync now"); the built-in snapshot follows
platform releases.
