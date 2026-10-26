import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'

const source = await readFile(new URL('../pages/bookings.vue', import.meta.url), 'utf8')
const body = source.match(/const openAvailabilityPlanner = \(\) => \{([\s\S]*?)\n\}/)?.[1]
assert.ok(body)

function fixture(admin, selectable, pending = false) {
  const values = Object.fromEntries(Object.entries({ actionPending: pending, isAdmin: admin, canSelectSlots: selectable,
    actionModalOpen: true, availabilityInitialDate: '2026-10-27', availabilityInitialStart: '10:00',
    availabilityInitialEnd: '18:00', availabilityModalOpen: false }).map(([key, value]) => [key, { value }]))
  vm.runInNewContext(`(() => {${body}\n})()`, values)
  return values
}

test('planner opens an empty draft for admin and bound master without a write', () => {
  for (const [admin, selectable] of [[true, false], [false, true]]) {
    const state = fixture(admin, selectable)
    assert.equal(state.availabilityModalOpen.value, true)
    assert.equal(state.actionModalOpen.value, false)
    for (const key of ['availabilityInitialDate', 'availabilityInitialStart', 'availabilityInitialEnd']) assert.equal(state[key].value, '')
  }
})

test('pending action and an unbound master cannot open or replace planner context', () => {
  for (const args of [[true, true, true], [false, true, true], [false, false, false]]) {
    const state = fixture(...args)
    assert.equal(state.availabilityModalOpen.value, false)
    assert.equal(state.actionModalOpen.value, true)
    assert.equal(state.availabilityInitialDate.value, '2026-10-27')
  }
  assert.doesNotMatch(body, /api\.|fetch\(/)
  assert.match(source, /watch\(\(\) => \[auth\.sessionRevision, auth\.user\?\.id, selectedMasterId\.value\],[\s\S]*?availabilityModalOpen\.value = false[\s\S]*?flush: 'sync'/)
})
