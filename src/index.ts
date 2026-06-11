// 1:1-compatible drop-in for the upstream `cn-font-split` npm package, but backed by a
// prebuilt napi-rs native addon (distributed as per-platform optionalDependencies) instead of
// a binary downloaded from GitHub Releases at install time.
//
// We reuse upstream's OWN JS layer for full API parity: `createAPI` (options -> InputTemplate
// protobuf -> per-event file writing), `decodeReporter`, and the generated `proto`. The only
// thing we substitute is the native backend handed to `createAPI`. Upstream's runtime backends
// (node/bun/deno) `dlopen` the downloaded library; ours calls the napi addon. These upstream
// modules are pulled from a build-time devDependency and inlined by the bundler, so the
// published package has no runtime dependency on `cn-font-split` and runs no postinstall.
//
// NOTE: import the individual upstream modules directly — never `cn-font-split` /
// `cn-font-split/dist/auto.js`, whose top-level code eagerly loads the (absent) downloaded
// binary and throws.

// @ts-expect-error — no type declarations published for the deep module path.
import { createAPI } from 'cn-font-split/dist/createAPI.js'
// @ts-expect-error — re-exported for parity with upstream's public surface.
import { decodeReporter } from 'cn-font-split/dist/decodeReporter.js'
// @ts-expect-error — the generated protobuf namespace, re-exported as `proto`.
import { api_interface as proto } from 'cn-font-split/dist/gen/index.js'

import { fontSplit as napiFontSplit } from './napi.cjs'

// Upstream's `createAPI(font_split, createCallback, finallyFn?)` expects a native
// `font_split(buffer, length, cb)` that invokes `cb(eventBytes)` once per streamed
// `EventMessage` during execution. Our napi addon instead runs to completion and returns the
// full `EventMessage[]` synchronously, so we replay those buffers through the same callback —
// preserving `createAPI`'s exact decode-and-write-per-event semantics. No FFI marshalling is
// needed, so `createCallback` is the identity function.
const fontSplitBackend = (buffer: Uint8Array, _length: number, cb: (data: Uint8Array) => void): void => {
  for (const event of napiFontSplit(Buffer.from(buffer))) {
    cb(event)
  }
}

const identityCallback = (cb: (data: Uint8Array) => void): ((data: Uint8Array) => void) => cb

/**
 * Subset/split a font. Drop-in replacement for `cn-font-split`'s default/`fontSplit` export:
 * same options object (`{ input, outDir, css, chunkSize, renameOutputFont, ... }`) and the
 * same behavior (writes chunk files + CSS into `outDir`).
 */
export const fontSplit = createAPI(fontSplitBackend, identityCallback)

export { createAPI, decodeReporter, proto }
export default fontSplit
