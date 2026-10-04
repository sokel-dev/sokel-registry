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
   `plugin.org` and `plugin.name` matching the directory and a `plugin.version`. Optional: `locales/<lang>.json`,
   `README.md`.
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
- the usage doc tells a stranger how to get it running.

## Official entries (`plugins/sokel/`)

The `sokel` org's entries are generated from the [main repository](https://github.com/sokel-dev/sokel), where the
plugins themselves are maintained, and arrive here as pull requests. To change one, open an issue or a pull request
in the main repository; an edit made only here would be overwritten by the next sync.

## Publish a new version

Change the files under your entry and **raise `plugin.version`**. CI compares against `main` and refuses a change
that keeps or lowers the version: platforms decide "update available" and match advisories by version, so a change
without a bump would be invisible to them. Your org's code owner approves it.

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
