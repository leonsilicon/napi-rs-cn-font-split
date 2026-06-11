import { defineConfig } from 'tsdown'

// Bundle the ergonomic 1:1 wrapper (src/index.ts) into dist/index.js, INLINING upstream
// cn-font-split's JS layer (createAPI + proto + decodeReporter) and its pure-JS deps
// (google-protobuf, fs-extra). The native addon loader (napi.cjs) is generated separately by
// `napi build -o dist` and kept EXTERNAL here, so the published package has no runtime
// dependency on cn-font-split and runs no postinstall.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  // napi build writes napi.cjs / napi.d.ts / *.node into dist/ first; don't wipe them.
  clean: false,
  dts: true,
  // The napi loader is shipped alongside index.js in dist/ and resolves the per-platform
  // .node via the optionalDependencies convention — must not be bundled.
  external: ['./napi.cjs'],
  // Inline everything else (cn-font-split + transitive pure-JS deps) into the output.
  noExternal: ['cn-font-split', 'google-protobuf', 'fs-extra'],
})
