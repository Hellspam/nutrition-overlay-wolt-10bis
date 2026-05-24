// Build the extension with esbuild into self-contained IIFE bundles.
//
// Why not crxjs/Vite? crxjs injects content scripts via a loader that does
// `import(chrome.runtime.getURL(...))`. Wolt (script-src 'strict-dynamic') and
// 10bis (script-src 'self') both refuse to load chrome-extension: scripts, so
// that dynamic import is blocked by the page CSP and the content code never
// runs. A statically-declared, single-file content script runs in the isolated
// world and is NOT subject to the page CSP — so we bundle each entry into one
// IIFE file with no runtime imports and reference them directly in manifest.json.
import * as esbuild from 'esbuild'
import { copyFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs'

const watch = process.argv.includes('--watch')

const entries = [
  { entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js' },
  { entryPoints: ['src/background/index.ts'], outfile: 'dist/background.js' },
  { entryPoints: ['src/options/options.ts'], outfile: 'dist/options.js' },
]
const opts = (e) => ({
  ...e,
  bundle: true,
  format: 'iife', // self-contained; no runtime import() that a page CSP could block
  target: 'chrome110',
  charset: 'utf8', // keep Hebrew literals as UTF-8 instead of \uXXXX escapes
  legalComments: 'none',
  logLevel: 'info',
})

function copyStatic() {
  copyFileSync('manifest.json', 'dist/manifest.json')
  copyFileSync('src/options/index.html', 'dist/options.html')
  mkdirSync('dist/icons', { recursive: true })
  for (const s of [16, 48, 128]) copyFileSync(`icons/icon-${s}.png`, `dist/icons/icon-${s}.png`)
}

function assertSelfContained() {
  // The content script must never depend on a runtime dynamic import — that is
  // exactly what the page CSP blocks. Fail the build if one sneaks in.
  const content = readFileSync('dist/content.js', 'utf8')
  if (/chrome\.runtime\.getURL\s*\(|\bimport\s*\(/.test(content)) {
    throw new Error('dist/content.js contains a dynamic import — it would be blocked by site CSP')
  }
}

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })

if (watch) {
  const ctxs = await Promise.all(entries.map((e) => esbuild.context(opts(e))))
  await Promise.all(ctxs.map((c) => c.watch()))
  copyStatic()
  console.log('esbuild: watching for changes…')
} else {
  await Promise.all(entries.map((e) => esbuild.build(opts(e))))
  copyStatic()
  assertSelfContained()
  console.log('build OK — dist/ ready (content.js is self-contained, CSP-safe)')
}
