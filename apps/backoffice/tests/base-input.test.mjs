import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const baseInputSource = await readFile(new URL('../components/BaseInput.vue', import.meta.url), 'utf8')

test('BaseInput keeps every rendered input exactly 44px high', () => {
  const fixedHeightClasses = baseInputSource.match(/:class="\['h-11', inputClass, attrsClass\]"/g) || []
  assert.equal(fixedHeightClasses.length, 2)
})
