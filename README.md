# Sokel Plugin Registry

[![CI](https://github.com/sokel-dev/sokel-registry/actions/workflows/ci.yml/badge.svg)](https://github.com/sokel-dev/sokel-registry/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

English · [简体中文](README.zh-CN.md)

The catalog of plugins for the [Sokel](https://github.com/sokel-dev) workflow platform, and the page that shows it:
**https://plugins.sokel.dev/**

A plugin's code lives in its own repository. What lives here is its **manifest** — what each operation takes and
returns, which credentials it asks for, how to run it — plus optional translations and a usage doc. Platforms read
this catalog to fill their plugin marketplace; this page reads the very same files.

## How a plugin gets here

1. Write the plugin with the [plugin SDK](https://github.com/sokel-dev/sokel-plugin-sdk) (Go, Python or TypeScript)
   and publish an image or binary people can run.
2. Open a pull request adding `plugins/<org>/<name>/manifest.yml`. CI checks it; a maintainer reviews it.
3. On merge the catalog is rebuilt and published here within minutes.

New versions and security advisories go through the same pull request flow. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Layout

```
plugins/<org>/<name>/
  manifest.yml          # the only required file (manifest.yaml / manifest.json also work)
  locales/<lang>.json   # optional translations: source string -> translation
  README.md             # optional usage doc shown on the detail page
advisories.json         # security advisories, syntax in ADVISORIES.md
site/                   # the page (no build step); site/brands.js is generated from the platform's brand registry
cmd/build-index/        # admission checks and the published tree
```

The directory is the identity: `plugins/acme/foo` is `acme/foo`, and `.github/CODEOWNERS` says who maintains each org.

Entries outside the `sokel` publisher namespace carry a third-party publisher label. Their detail page and
installation dialog remind users to verify the publisher, code source and requested permissions before granting
access to data or credentials. This source notice is separate from version-specific security advisories;
Sokel publication does not imply that every upstream integration uses a service's official API.

## How platforms use it

A platform ships a built-in snapshot of this catalog, which works offline. An administrator can add this site as a
refresh source (**Platform settings → Plugin index source**, address `https://plugins.sokel.dev`):
the platform then fetches `index.json` and `advisories.json` every 12 hours, shows new plugins in its marketplace
and installs them from the same origin, and flags installed versions that an advisory names. It is off by default —
nothing is fetched until someone turns it on. Advisories also ship with every platform release (each image carries
the advisories current at build time), so offline deployments get them by upgrading.

## Run it locally

To preview only the registry UI with the live official catalog (no platform or login required):

```bash
python3 scripts/preview.py
# Open http://127.0.0.1:5180/?base=https://plugins.sokel.dev/&lang=en
```

The preview server disables browser caching so edits cannot mix new markup with stale styles. When updating
the published UI, bump the shared asset revision in `site/index.html` and the token import in `site/style.css`.

To build and preview the catalog from this checkout:

```bash
go run ./cmd/build-index -site _site .             # admission + the published tree
go run ./cmd/build-index -base ../main-checkout .  # the pull request version check
cd _site && python3 -m http.server                 # then open http://localhost:8000
```

The directory supports cross-language search, independent use-case/capability/publisher filters, event and
deployment filters, sorting, and grid/list views. URLs retain the filters, page and view. Pages render 24, 48 or
96 entries; plugin details load only when opened, and operation fields only when expanded.

The home page keeps the registry's headline and brand cloud, with at most six plugin cards per discovery section.
Its search and category links open the full catalog at `#/plugins`; detail navigation returns to the originating view.

`site/catalog.js` contains the discovery model. Explicit `categories` from the index take precedence over its
exact-ref compatibility table for older official entries; unknown plugins without categories are uncategorized.
The browser still downloads the complete compact index, so pagination bounds rendered content, not index transfer
size. No popularity or recency ranking is inferred from metadata that the index does not provide.

Run the dependency-free UI tests with `node --test tests/*.test.cjs`. Optional browser coverage (2,000-entry fixture
and live-index smoke check) uses an existing Playwright installation:

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/@playwright/test node tests/catalog-browser.mjs
PLAYWRIGHT_MODULE=/path/to/node_modules/@playwright/test node tests/publisher-risk-browser.mjs
```

The publisher-risk check uses browser-local fixtures for third-party entries, including misleading display metadata,
and verifies the existing install handoff, English copy, mobile layout and separate security advisories.

## License

[Apache-2.0](LICENSE). Each plugin is licensed by its own repository.
