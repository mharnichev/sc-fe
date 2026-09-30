import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../components/ui/BaseModal.vue', import.meta.url), 'utf8')

test('all BaseModal variants occupy the lower 90 percent of mobile viewports', () => {
  assert.match(source, /\.base-modal--default \{\s+align-items: flex-end/)
  assert.match(source, /@media \(max-width: 767px\)/)
  assert.match(source, /\.base-modal--default \.base-modal__container,\s+\.base-modal--right \.base-modal__container \{[\s\S]*?position: absolute;[\s\S]*?inset: 10svh 0 0;[\s\S]*?inset-block-start: 10dvh;[\s\S]*?height: auto;[\s\S]*?max-height: none/)
  assert.doesNotMatch(source, /100svh - 60px/)
})

test('desktop modals restore centered and side-panel layouts', () => {
  assert.match(source, /@media \(min-width: 768px\)/)
  assert.match(source, /\.base-modal--default \{\s+align-items: center/)
  assert.match(source, /\.base-modal--default \.base-modal__container \{[\s\S]*?height: auto/)
  assert.match(source, /\.base-modal--right \.base-modal__container \{[\s\S]*?height: 100%/)
})
