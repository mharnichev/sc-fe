import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/bookingPromotions.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const promotions = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const offer = (overrides = {}) => ({
  application_mode: 'automatic',
  eligibility_type: 'first_visit',
  applies_to_all_masters: false,
  master_ids: [7],
  applies_to_all_services: false,
  base_service_ids: [11],
  ...overrides,
})

test('master offer is shown only when one of that master’s services is in scope', () => {
  assert.equal(promotions.offerAppliesToMasterServices(offer(), 7, [11, 12]), true)
  assert.equal(promotions.offerAppliesToMasterServices(offer(), 7, [12]), false)
  assert.equal(promotions.offerAppliesToMasterServices(offer(), 8, [11]), false)
})

test('all-service offers remain available to a scoped master even when service metadata is absent', () => {
  assert.equal(promotions.offerAppliesToMasterServices(
    offer({ applies_to_all_services: true, base_service_ids: [] }),
    7,
    [],
  ), true)
})


test('offer refresh uses Nuxt default caching so manual refresh bypasses stale hydration payload', async () => {
  const source = await readFile(new URL('../composables/useBookingPromotions.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /getCachedData:/)
  assert.match(source, /refreshAsyncData\(\)/)
  assert.match(source, /onBeforeUnmount/)
  assert.match(source, /onNuxtReady\(\(\) =>/)
})
