import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const componentSource = await readFile(new URL('../components/BaseFileInput.vue', import.meta.url), 'utf8')
const masterFormSource = await readFile(new URL('../components/MasterFormModal.vue', import.meta.url), 'utf8')

test('BaseFileInput replaces the native file control with an accessible themed drop zone', () => {
  assert.match(componentSource, /type="file"/)
  assert.match(componentSource, /class="sr-only"/)
  assert.match(componentSource, /:for="inputId"/)
  assert.match(componentSource, /@drop\.prevent="handleDrop"/)
  assert.match(componentSource, /prefers-reduced-motion: reduce/)
  assert.match(componentSource, /prefers-reduced-transparency: reduce/)
  assert.match(componentSource, /forced-colors: active/)
})

test('master media fields use the shared file input and preserve WebP validation', () => {
  assert.equal((masterFormSource.match(/<BaseFileInput/g) || []).length, 3)
  assert.match(masterFormSource, /accept="\.webp,image\/webp"/)
  assert.match(masterFormSource, /setFilePreview\(\$event, 'photo'\)/)
  assert.match(masterFormSource, /setFilePreview\(\$event, 'avatar'\)/)
  assert.match(masterFormSource, /setFilePreview\(\$event, 'passport_photo'\)/)
  assert.doesNotMatch(masterFormSource, /file:bg-slate-950/)
})
