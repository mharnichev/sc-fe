import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../utils/bookingNoSlots.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { parseNoSlotPage, noSlotDateRange, noSlotActivity, noSlotServices } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const attempt = (id = 'opaque-reference') => ({ attempt_id: id, observations: 38, contexts: 32, services: [{service_id: 1, service_name: 'Стрижка'}], durations_minutes: [60], checked_dates: 28, date_from: '2026-09-01', date_to: '2026-09-28', first_observed_at: '2026-09-01T21:00:00Z', last_observed_at: '2026-09-28T21:00:00Z', later_time_selection: true, later_booking_same_master: false, later_booking_other_master: true, later_booking_unknown_master: false, rapid_checks: 7 })
const page = (items, overrides = {}) => ({items, total: items.length, offset: 0, limit: 10, has_more: false, snapshot_id: 58, ...overrides})
test('attempt page preserves whole-period evidence and distinct recovery attribution', () => {
  const parsed = parseNoSlotPage(page([attempt()], {total: 3, has_more: true}), 'attempts')
  assert.equal(parsed.total, 3)
  assert.equal(parsed.items[0].observations, 38)
  assert.equal(parsed.items[0].later_booking_other_master, true)
  assert.equal(parsed.items[0].later_booking_same_master, false)
})
test('duplicate attempt references cannot inflate a page', () => {
  assert.throws(() => parseNoSlotPage(page([attempt(), attempt()]), 'attempts'))
  assert.equal(parseNoSlotPage(page([attempt('a'), attempt('b')]), 'attempts').items.length, 2)
})
test('pagination rejects impossible totals, missing pages and inconsistent continuation', () => {
  for (const overrides of [{total: 0}, {limit: 0}, {offset: -1}, {snapshot_id: -1}, {has_more: true}, {total: 3}, {limit: 0.5}]) {
    assert.throws(() => parseNoSlotPage(page([attempt()], overrides), 'attempts'))
  }
  assert.throws(() => parseNoSlotPage(page([], {total: 3, has_more: true}), 'attempts'))
  assert.equal(parseNoSlotPage(page([attempt()], {offset: 2, total: 3}), 'attempts').offset, 2)
})
test('check pages preserve unknown historical context and reject invalid evidence', () => {
  const check = { target_date: null, services: [], duration_minutes: null, observed_at: '2026-09-28T21:30:00Z' }
  assert.equal(parseNoSlotPage(page([check]), 'checks').items[0].target_date, null)
  for (const overrides of [{target_date: '2026-02-30'}, {observed_at: 'bad'}, {duration_minutes: 0}, {services: [{service_id: 0, service_name: null}]}]) {
    assert.throws(() => parseNoSlotPage(page([{...check, ...overrides}]), 'checks'))
  }
})
test('requested dates stay calendar dates while activity uses Kyiv including DST', () => {
  assert.equal(noSlotDateRange('2026-09-01', '2026-09-28'), '01.09.2026 — 28.09.2026')
  assert.equal(noSlotDateRange(null, null), 'Дата не визначена')
  assert.match(noSlotActivity('2026-09-28T21:30:00Z'), /29\.09\.2026.*00:30:00/)
  assert.match(noSlotActivity('2026-01-01T21:30:00Z'), /01\.01\.2026.*23:30:00/)
  assert.equal(noSlotServices([{service_id: 7, service_name: null}]), 'Послуга #7')
})
