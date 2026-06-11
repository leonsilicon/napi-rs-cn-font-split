# napi-rs-cn-font-split

![CI](https://github.com/leonsilicon/napi-rs-cn-font-split/workflows/CI/badge.svg)

A [napi-rs](https://napi.rs) binding for [`cn-font-split`](https://github.com/KonghaYao/cn-font-split) — a
font subsetter/splitter that breaks large CJK fonts into many small, unicode-range-keyed `woff2`
chunks so the browser only downloads the glyphs a page actually renders.

## Why this exists

Upstream `cn-font-split` ships a JS-only npm package and downloads its native Rust binary from
GitHub Releases at install/first-use time. That download isn't pinned to the package version,
isn't integrity-checked, and isn't atomic — a partial download silently breaks `dlopen` later.

This package wraps the same upstream Rust library with napi-rs instead, so the native binary is
distributed the standard npm way: prebuilt per-platform `.node` addons published as
`optionalDependencies`, version-locked to the JS package, integrity-hashed in your lockfile, and
installed offline-cacheably. HarfBuzz is built from source and linked statically, so each addon is
self-contained (no system `libharfbuzz` required).

## Install

```bash
npm install napi-rs-cn-font-split
```

Prebuilt binaries are published for: macOS (arm64, x64), Linux gnu (arm64, x64), Windows msvc
(arm64, x64).

## Usage

The binding mirrors the upstream protobuf contract: pass a protobuf-encoded `InputTemplate`,
receive each streamed `EventMessage` back as a protobuf-encoded `Buffer`, in emission order.

```ts
import { fontSplit } from 'napi-rs-cn-font-split'

// `input` is a protobuf-encoded cn-font InputTemplate (field 1 = the ttf/woff2 bytes).
const events: Buffer[] = fontSplit(input)
// Decode each Buffer as an EventMessage. OUTPUT_DATA events carry { message: filename, data }
// for each woff2 chunk / css / reporter; the final event is END.
```

See `__test__/index.spec.ts` for a minimal hand-rolled encode/decode example.

## Development

```bash
yarn install
yarn build        # builds the .node addon (compiles bundled HarfBuzz on first run)
yarn test         # ava
yarn lint         # oxlint
```

The upstream Rust crates are pinned to a specific git rev in `Cargo.toml`. `HARFBUZZ_SYS_NO_PKG_CONFIG`
is set in `.cargo/config.toml` so local builds bundle HarfBuzz the same way CI does.

### Releasing

CI publishes to npm when the latest commit message is a bare semver (e.g. `1.0.0`):

```bash
yarn version          # bumps version, runs `napi version`
git commit -am "1.0.0"
git push
```

Requires an `NPM_TOKEN` repository secret.
