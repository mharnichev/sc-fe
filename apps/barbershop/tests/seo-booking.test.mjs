import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/seoBooking.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const {
  seoBookingPath,
  parseSeoBookingQuery,
  resolveSeoBookingSelection,
  shouldApplySeoBookingSelection,
  isSeoBookingContext,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const catalog = [
  {
    slug: 'mens-haircut-11',
    catalogId: 'base:11',
    barberServices: [{ id: 101, barberId: 7 }, { id: 202, barberId: 8 }],
  },
  {
    slug: 'beard-trim-12',
    catalogId: 'base:12',
    barberServices: [{ id: 301, barberId: 8 }],
  },
]
const masters = [
  { id: 7, activeServiceIds: [101, 777] },
  { id: 8, activeServiceIds: [202, 301] },
]

test('booking paths retain validated public values and use URLSearchParams', () => {
  assert.equal(seoBookingPath({ serviceSlug: 'mens-haircut-11', masterId: 7 }), '/?service=mens-haircut-11&master=7#booking')
  assert.equal(seoBookingPath({ serviceSlug: 'mens-haircut-11' }), '/?service=mens-haircut-11#booking')
  assert.equal(seoBookingPath({ masterId: 7 }), '/?master=7#booking')
  assert.equal(seoBookingPath({ masterId: 7, serviceId: 777 }), '/?master=7&service_id=777#booking')
  assert.equal(seoBookingPath({ serviceSlug: 'mens-haircut-11', masterId: 7, serviceId: 777 }), '/?service=mens-haircut-11&master=7#booking')
  assert.equal(seoBookingPath({ serviceSlug: '../other?x=1', masterId: -1, serviceId: 777 }), '/#booking')
})

test('query parsing rejects arrays and malformed IDs without manufacturing selections', () => {
  assert.deepEqual(parseSeoBookingQuery({ service: 'mens-haircut-11', master: '7' }), { serviceSlug: 'mens-haircut-11', masterId: 7, serviceId: undefined })
  assert.deepEqual(parseSeoBookingQuery({ master: '7', service_id: '777' }), { serviceSlug: undefined, masterId: 7, serviceId: 777 })
  assert.deepEqual(parseSeoBookingQuery({ service: ['mens-haircut-11'], master: ['7'] }), null)
  assert.deepEqual(parseSeoBookingQuery({ service: 'bad/slug', master: '07' }), null)
  assert.deepEqual(parseSeoBookingQuery({ service: 'mens-haircut-11', master: '0' }), { serviceSlug: 'mens-haircut-11', masterId: undefined, serviceId: undefined })
  assert.deepEqual(parseSeoBookingQuery({ master: '9007199254740992', service_id: '777' }), null)
  assert.deepEqual(parseSeoBookingQuery({ service: 'mens-haircut-11', master: '7', service_id: '777' }), { serviceSlug: 'mens-haircut-11', masterId: 7, serviceId: undefined })
})

test('service and master intents select the expected next actionable step', () => {
  assert.deepEqual(resolveSeoBookingSelection({ serviceSlug: 'mens-haircut-11' }, catalog, masters), { catalogId: 'base:11', step: 1 })
  assert.deepEqual(resolveSeoBookingSelection({ masterId: 7 }, catalog, masters), { masterId: 7, step: 0 })
  assert.deepEqual(resolveSeoBookingSelection({ serviceSlug: 'mens-haircut-11', masterId: 7 }, catalog, masters), {
    catalogId: 'base:11', serviceId: 101, masterId: 7, step: 2,
  })
  assert.deepEqual(resolveSeoBookingSelection({ masterId: 7, serviceId: 777 }, catalog, masters), { serviceId: 777, masterId: 7, step: 2 })
})

test('unknown, excluded, and incompatible entities never substitute another master or inactive service', () => {
  assert.deepEqual(resolveSeoBookingSelection({ serviceSlug: 'missing', masterId: 7 }, catalog, masters), { masterId: 7, step: 0 })
  assert.deepEqual(resolveSeoBookingSelection({ serviceSlug: 'beard-trim-12', masterId: 7 }, catalog, masters), { masterId: 7, step: 0 })
  assert.deepEqual(resolveSeoBookingSelection({ serviceSlug: 'mens-haircut-11', masterId: 9 }, catalog, masters), { catalogId: 'base:11', step: 1 })
  assert.deepEqual(resolveSeoBookingSelection({ masterId: 7, serviceId: 202 }, catalog, masters), { masterId: 7, step: 0 })
  assert.deepEqual(resolveSeoBookingSelection({ serviceSlug: 'mens-haircut-11', masterId: 7 }, catalog, [{ id: 7, activeServiceIds: [777] }]), { masterId: 7, step: 0 })
  assert.deepEqual(resolveSeoBookingSelection({ serviceSlug: 'missing' }, catalog, masters), { step: 0 })
  assert.deepEqual(resolveSeoBookingSelection({ serviceSlug: 'mens-haircut-11', masterId: 7 }, [...catalog, { ...catalog[0], catalogId: 'base:99' }], masters), { masterId: 7, step: 0 })
})

test('prefill waits for data and never replays over manual or existing selection', () => {
  const initial = { ready: true, dataError: false, applied: false, manualSelection: false, hasSelection: false }
  assert.equal(shouldApplySeoBookingSelection(initial), true)
  for (const key of ['applied', 'manualSelection', 'hasSelection']) {
    assert.equal(shouldApplySeoBookingSelection({ ...initial, [key]: true }), false)
  }
  assert.equal(shouldApplySeoBookingSelection({ ...initial, ready: false }), false)
  assert.equal(shouldApplySeoBookingSelection({ ...initial, dataError: true }), false)
  assert.equal(shouldApplySeoBookingSelection({ ...initial, dataError: false }), true)
})

test('URL intent is scoped to normal homepage booking, excluding drawer, repeat, and campaign flows', () => {
  const initial = { path: '/', mode: 'section', idPrefix: 'booking', hasRepeatBooking: false, hasCampaignOffer: false }
  assert.equal(isSeoBookingContext(initial), true)
  assert.equal(isSeoBookingContext({ ...initial, path: '/en/' }), true)
  assert.equal(isSeoBookingContext({ ...initial, path: '/en' }), true)
  assert.equal(isSeoBookingContext({ ...initial, path: '/booking/repeat' }), false)
  assert.equal(isSeoBookingContext({ ...initial, mode: 'drawer' }), false)
  assert.equal(isSeoBookingContext({ ...initial, idPrefix: 'other-booking' }), false)
  assert.equal(isSeoBookingContext({ ...initial, hasRepeatBooking: true }), false)
  assert.equal(isSeoBookingContext({ ...initial, hasCampaignOffer: true }), false)
})

