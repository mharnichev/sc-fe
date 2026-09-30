import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageSource = await readFile(new URL('../pages/services/[slug].vue', import.meta.url), 'utf8')

test('service detail allows long names to wrap without widening the mobile layout', () => {
  assert.match(pageSource, /<div class="min-w-0 max-w-4xl">/)
  assert.equal((pageSource.match(/service-name-wrap/g) || []).length, 3)
  assert.match(pageSource, /overflow-wrap: anywhere/)
  assert.match(pageSource, /word-break: normal/)
  assert.match(pageSource, /hyphens: auto/)
})
