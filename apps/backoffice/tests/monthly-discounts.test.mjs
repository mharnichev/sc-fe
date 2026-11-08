import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../utils/monthlyDiscounts.ts', import.meta.url), 'utf8')
const compile = value => ts.transpileModule(value, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { parseMonthlyDiscountsResponse } = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`)

const item = (overrides = {}) => ({
  booking_id: 17, start_at: '2026-10-31T22:30:00Z', completed_at: null,
  customer_id: null, customer_name: 'Клієнт', customer_phone: '', master_id: 2, master_name: null,
  subtotal_amount: '1000.00', promotion_discount_amount: '200.00', manual_discount_amount: '50.00',
  discount_amount: '250.00', total_amount: '750.00', promotion_id: null, promotion_code: null,
  promotion_name_uk: null, promotion_name_en: null, promotion_discount_percent: null,
  promotion_application_mode_snapshot: 'automatic', promotion_eligibility_type_snapshot: null,
  campaign_offer_id: 3, amount_status: 'known', warnings: [], ...overrides,
})
const response = (overrides = {}) => ({
  period: { year: 2026, month: 11, timezone: 'Europe/Kyiv', time_basis: 'start_at' },
  scope: 'booking_services', historical_completeness: 'not_verifiable', generated_at: '2026-11-05T10:00:00Z',
  summary: { completed_bookings: 70, discounted_bookings: 51, unknown_discount_bookings: 1, invalid_discount_bookings: 1, known_discount_amount: '12500.00' },
  items: [item()], total: 53, offset: 0, limit: 50, ...overrides,
})

test('monthly discounts preserve full-month totals and recorded promo/manual amounts', () => {
  const result = parseMonthlyDiscountsResponse(response())
  assert.equal(result.summary.known_discount_amount, '12500.00')
  assert.equal(result.total, 53)
  assert.equal(result.items[0].discount_amount, '250.00')
  assert.equal(result.items[0].campaign_offer_id, 3)
  assert.equal(result.items[0].promotion_code, null)
})

test('unknown and invalid snapshots stay explicit without coercion or clamping', () => {
  const unknown = item({ subtotal_amount: null, promotion_discount_amount: null, discount_amount: null, amount_status: 'unknown', warnings: ['missing_pricing_snapshot'] })
  const invalid = item({ booking_id: 18, promotion_discount_amount: '-5.00', discount_amount: null, amount_status: 'invalid' })
  const excessive = item({ booking_id: 19, promotion_discount_amount: '1200.00', discount_amount: '1250.00', warnings: ['discount_exceeds_subtotal', 'snapshot_total_mismatch'] })
  const result = parseMonthlyDiscountsResponse(response({ items: [unknown, invalid, excessive] }))
  assert.equal(result.items[0].discount_amount, null)
  assert.equal(result.items[0].promotion_discount_amount, null)
  assert.equal(result.items[1].promotion_discount_amount, '-5.00')
  assert.equal(result.items[1].discount_amount, null)
  assert.equal(result.items[2].discount_amount, '1250.00')
  assert.deepEqual(result.items[2].warnings, ['discount_exceeds_subtotal', 'snapshot_total_mismatch'])
})

test('invalid response shapes never become empty or zero-valued reports', () => {
  for (const invalid of [
    null, {}, response({ scope: 'shop' }), response({ historical_completeness: 'complete' }),
    response({ period: { year: 2026, month: 13, timezone: 'Europe/Kyiv', time_basis: 'start_at' } }),
    response({ period: { year: 2026, month: 11, timezone: 'UTC', time_basis: 'start_at' } }),
    response({ items: [item({ discount_amount: 250 })] }),
    response({ items: [item({ discount_amount: undefined })] }),
    response({ items: [item({ warnings: ['unexpected'] })] }),
    response({ items: [item({ amount_status: 'empty' })] }),
    response({ limit: 101 }), response({ offset: -1 }),
  ]) assert.throws(() => parseMonthlyDiscountsResponse(invalid), TypeError)
})

const apiSource = compile(await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8'))
  .replace(/^import .* from .*;\n/gm, '')
const setup = (user, next = response()) => {
  const calls = []
  const createError = options => Object.assign(new Error(options.statusMessage), options)
  const useBackofficeApi = vm.compileFunction(
    `${apiSource.replace('export const useBackofficeApi', 'const useBackofficeApi')}; return useBackofficeApi`,
    ['useApi', 'useRuntimeConfig', 'useAuthStore', 'createError', 'parseMonthlyDiscountsResponse'],
  )(() => async (path, options) => { calls.push({ path, ...options }); return next }, () => ({ public: { apiBase: '' } }), () => ({ user }), createError, parseMonthlyDiscountsResponse)
  return { api: useBackofficeApi(), calls }
}

test('monthly report rejects ordinary admin and barber before issuing a request', async () => {
  for (const user of [null, { role: 'admin', is_superuser: false }, { role: 'barber', is_superuser: false }]) {
    const { api, calls } = setup(user)
    await assert.rejects(() => api.adminGetMonthlyDiscounts({ year: 2026, month: 11 }), error => error.statusCode === 403)
    assert.equal(calls.length, 0)
  }
})

test('superuser report uses only year/month/offset/limit and validates returned period', async () => {
  const { api, calls } = setup({ is_superuser: true })
  await api.adminGetMonthlyDiscounts({ year: 2026, month: 11 })
  assert.deepEqual(calls, [{ path: '/backoffice/statistics/admin/discounts/monthly', query: { year: 2026, month: 11, offset: 0, limit: 50 } }])
  const second = setup({ is_superuser: true }, response({ offset: 50, items: [] }))
  await second.api.adminGetMonthlyDiscounts({ year: 2026, month: 11, offset: 50 })
  assert.equal(second.calls[0].query.offset, 50)
  await assert.rejects(() => api.adminGetMonthlyDiscounts({ year: 2026, month: 10 }), TypeError)
})
