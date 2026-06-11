import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import test from 'ava'

// Test the PUBLISHED, bundled package (dist/index.cjs) — the ergonomic 1:1 API consumers use —
// not the low-level napi addon. Requires `yarn build` (or at least the napi .node + `yarn bundle`)
// to have produced dist/ first.
import { fontSplit } from '../dist/index.cjs'

const fontPath = fileURLToPath(new URL('./fixtures/test-font.ttf', import.meta.url))

test('fontSplit writes woff2 chunks + css into outDir', async (t) => {
  const font = readFileSync(fontPath)
  const outDir = mkdtempSync(join(tmpdir(), 'cnfs-test-'))

  await fontSplit({
    input: new Uint8Array(font),
    outDir,
    css: { fontFamily: 'Test Font', fileName: 'index.css', compress: true },
    chunkSize: 800_000,
    renameOutputFont: '[hash:6].[ext]',
    reporter: false,
    silent: true,
  })

  const files = readdirSync(outDir)
  t.true(files.includes('index.css'), 'expected an index.css to be written')
  t.true(
    files.some((f) => f.endsWith('.woff2')),
    'expected at least one .woff2 chunk',
  )
})
