# Sokel Plugin Registry

[![CI](https://github.com/sokel-dev/sokel-registry/actions/workflows/ci.yml/badge.svg)](https://github.com/sokel-dev/sokel-registry/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

English · [简体中文](README.zh-CN.md)

The catalog of plugins for the [Sokel](https://github.com/sokel-dev) workflow platform, and the page that shows it:
**https://sokel-dev.github.io/sokel-registry/**

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

## How platforms use it

A platform ships a built-in snapshot of this catalog, which works offline. An administrator can add this site as a
refresh source (**Platform settings → Plugin index source**, address `https://sokel-dev.github.io/sokel-registry`):
the platform then fetches `index.json` and `advisories.json` every 12 hours, shows new plugins in its marketplace
and installs them from the same origin, and flags installed versions that an advisory names. It is off by default —
nothing is fetched until someone turns it on. Advisories also ship with every platform release (each image carries
the advisories current at build time), so offline deployments get them by upgrading.

## Run it locally

```bash
go run ./cmd/build-index -site _site .             # admission + the published tree
go run ./cmd/build-index -base ../main-checkout .  # the pull request version check
cd _site && python3 -m http.server                 # then open http://localhost:8000
```

## License

[Apache-2.0](LICENSE). Each plugin is licensed by its own repository.
