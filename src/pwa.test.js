import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('manifest abre a PWA em /mobile e os ícones existem', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'))
  assert.equal(m.start_url, '/mobile')
  assert.equal(m.scope, '/mobile')
  assert.equal(m.display, 'standalone')
  for (const i of m.icons) assert.ok(existsSync(new URL(`../public${i.src}`, import.meta.url)), i.src)
})

test('CSP permite carregar o manifest (default-src none bloqueia-o)', () => {
  const csp = JSON.parse(read('vercel.json')).headers[0].headers.find(h => h.key === 'Content-Security-Policy').value
  assert.match(csp, /manifest-src 'self'/)
})

test('index.html liga o manifest', () => {
  assert.match(read('index.html'), /rel="manifest" href="\/manifest.webmanifest"/)
})
