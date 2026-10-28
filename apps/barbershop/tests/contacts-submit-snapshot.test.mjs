import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const page = await readFile(new URL('../pages/contacts.vue', import.meta.url), 'utf8')
const source = page.match(/const submit = async \(\) => \{[\s\S]*?\n\}/)?.[0]
assert.ok(source)
const code = ts.transpileModule(`${source}\nglobalThis.submit = submit`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

test('contacts submission and events use the validated snapshot while availability is pending', async () => {
  let resolveSlots
  const slots = new Promise(resolve => { resolveSlots = resolve })
  const events = []
  let payload
  let availabilityArgs
  const form = { first_name: 'A', last_name: 'B', email: 'a@example.test', note: '', phone: 'old', master_id: '1', service_ids: ['2'], scheduled_at: '2099-01-02T10:00' }
  const duration = { value: 30 }
  const context = {
    form, selectedDurationMinutes: duration,
    state: { loading: false, success: '', error: '', browserSessionCreated: false },
    terms: { value: { pages: { contacts: { success: 'ok', error: 'error' } } } },
    slotUnavailableMessage: { value: 'unavailable' },
    FORM_FIELD_LIMITS: { name: 100, email: 100, comment: 100 },
    sanitizeFormText: value => value,
    isValidPhoneNumber: () => true,
    formatPhoneForSubmit: value => `formatted-${value}`,
    kyivLocalDateTimeToIso: value => `${value}:00Z`,
    includesBookingStart: () => true,
    recordReachedMasterStep: () => {},
    bookingFunnel: { sessionId: () => 'session', recordInBackground: () => {}, reset: () => {} },
    trackEvent: (name, params) => events.push({ name, params }),
    domain: {
      getAvailableSlots: (...args) => { availabilityArgs = args; return slots },
      createBooking: async value => { payload = value; return { browserSessionCreated: false } },
    },
    console,
  }
  vm.runInNewContext(code, context)
  const pending = context.submit()
  assert.equal(context.state.loading, true)
  form.scheduled_at = '2099-02-03T11:00'
  form.phone = 'new'
  form.service_ids = ['3']
  form.master_id = '4'
  duration.value = 90
  await context.submit()
  resolveSlots([])
  await pending
  assert.deepEqual(Array.from(availabilityArgs).slice(0, 1), [1])
  assert.equal(availabilityArgs[2], '2099-01-02')
  assert.equal(availabilityArgs[3], 30)
  assert.equal(payload.master_id, 1)
  assert.equal(payload.service_id, 2)
  assert.equal(payload.start_at, '2099-01-02T10:00:00Z')
  assert.equal(payload.duration_minutes, 30)
  assert.equal(payload.customer_phone, 'formatted-old')
  assert.deepEqual(events.map(({ name }) => name), ['booking_submit', 'booking_success'])
  for (const { params } of events) {
    assert.equal(params.master_id, 1)
    assert.equal(params.appointment_date, '2099-01-02')
    assert.equal(params.duration_minutes, 30)
  }
})
