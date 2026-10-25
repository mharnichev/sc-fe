import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vueRequire = createRequire(require.resolve('nuxt/package.json'))
const vue = vueRequire('vue')
const { parse, compileScript, compileTemplate } = vueRequire('@vue/compiler-sfc')
const root = new URL('../', import.meta.url)
const source = await readFile(new URL('components/AvailabilityWindowFormModal.vue', root), 'utf8')
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { resolve, promise } }

function fixture(options = {}) {
  const props = vue.reactive({ modelValue: true, admin: true, masters: [{ id: 7 }], disabled: false, initialDate: '2026-10-26', initialMasterId: 7, ...options.props })
  const auth = vue.reactive({ sessionRevision: 1, user: { id: 1, role: 'admin', master_id: 7 } })
  const calls = [], events = [], unmount = [], leave = []
  const windows = []
  const api = {
    adminGetAvailability: async () => windows,
    getMyAvailability: async () => windows,
    adminCreateAvailabilityWindow: async body => { calls.push(body); windows.push(body) },
    createMyAvailabilityWindow: async body => { calls.push(body); windows.push(body) },
    ...options.api,
  }
  const formatting = {
    todayInput: () => options.today || '2026-10-25',
    addDaysInput: (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10),
    toKyivIso: (date, time) => `${date}T${time}:00+02:00`,
    masterName: () => 'Master', apiErrorMessage: error => error.message,
  }
  const globals = {
    ...vue, defineProps: () => props, withDefaults: value => value,
    defineEmits: () => (...args) => events.push(args),
    useBackofficeApi: () => api, useAuthStore: () => auth,
    useAssetUrl: () => value => value, useBaseToastNotification: () => ({ warning() {} }),
    useBookingCalendar: () => ({ workdayStart: '09:30', workdayEnd: '20:00' }),
    useBookingFormatting: () => formatting,
    onMounted() {}, onBeforeUnmount: callback => unmount.push(callback),
    onBeforeRouteLeave: callback => leave.push(callback),
    document: { removeEventListener() {} }, initials: () => 'M',
  }
  const script = parse(source).descriptor.scriptSetup.content.replace(/^import .*\n/gm, '')
  const compiled = ts.transpileModule(`${script}\nreturn { submit, drafts, form, formError, saving, toggleDate, applyTimes, validate, fillForm, horizonEnd, visibleMonth, monthDays, moveMonth, selectMonth };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const scope = vue.effectScope()
  const state = scope.run(() => vm.compileFunction(compiled, Object.keys(globals))(...Object.values(globals)))
  return { ...state, calls, events, props, auth, windows, leave() { leave.forEach(callback => callback()) }, stop() { unmount.forEach(callback => callback()); scope.stop() } }
}

test('all owned Vue files compile with existing SFC compiler', async () => {
  for (const path of ['components/AvailabilityWindowFormModal.vue', 'components/BookingCalendarGrid.vue', 'pages/bookings.vue', 'pages/my-time-blocks.vue']) {
    const { descriptor, errors } = parse(await readFile(new URL(path, root), 'utf8'))
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: path })
    const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  }
})

test('initial day/master, independent times, and self endpoint are preserved', async () => {
  const f = fixture({ props: { admin: false } })
  try {
    f.toggleDate('2026-10-27')
    f.drafts.value[1].start = '11:00'
    await f.submit()
    assert.equal(f.calls.length, 2)
    assert.equal(f.calls[1].start_at, '2026-10-27T11:00:00+02:00')
    assert.equal(f.calls[0].master_id, undefined)
  } finally { f.stop() }
})

test('partial failure retains only failed days and retry reconciles lost POST response', async () => {
  let attempts = 0
  const committed = []
  const f = fixture({ api: {
    adminGetAvailability: async () => committed,
    adminCreateAvailabilityWindow: async body => {
      attempts++
      committed.push(body)
      if (attempts === 2) throw new Error('response lost')
    },
  } })
  try {
    f.toggleDate('2026-10-27')
    await f.submit()
    assert.deepEqual(f.drafts.value.map(day => day.date), ['2026-10-27'])
    await f.submit()
    assert.equal(attempts, 2, 'retry must not POST committed interval again')
    assert.equal(f.drafts.value.length, 0)
  } finally { f.stop() }
})

test('slot time initializes the selected day, invalid slot time falls back to workday', async () => {
  for (const [start, end, expectedStart, expectedEnd] of [
    ['11:30', '12:00', '11:30', '12:00'],
    ['12:00', '11:30', '09:30', '20:00'],
    ['00:00', '23:59', '09:30', '20:00'],
    ['bad', '12:00', '09:30', '20:00'],
  ]) {
    const f = fixture({ props: { initialStartTime: start, initialEndTime: end } })
    try {
      assert.equal(f.form.start_time, expectedStart)
      assert.equal(f.form.end_time, expectedEnd)
      assert.equal(f.drafts.value[0].start, expectedStart)
      assert.equal(f.drafts.value[0].end, expectedEnd)
      await f.submit()
      assert.equal(f.calls[0].start_at, `2026-10-26T${expectedStart}:00+02:00`)
    } finally { f.stop() }
  }
})

for (const interruption of ['session', 'role', 'unmount', 'close', 'disabled', 'leave']) {
  test(`${interruption} during POST stops batch and suppresses stale UI events`, async () => {
    const pending = deferred()
    let sent = 0
    const f = fixture({ api: { adminCreateAvailabilityWindow: async () => { sent++; await pending.promise } } })
    f.toggleDate('2026-10-27')
    const result = f.submit()
    await Promise.resolve(); await Promise.resolve()
    assert.equal(sent, 1)
    if (interruption === 'session') f.auth.sessionRevision++
    if (interruption === 'role') f.auth.user.role = 'barber'
    if (interruption === 'unmount') f.stop()
    if (interruption === 'close') f.props.modelValue = false
    if (interruption === 'disabled') f.props.disabled = true
    if (interruption === 'leave') f.leave()
    const before = f.events.length
    pending.resolve(); await result
    assert.equal(sent, 1)
    assert.equal(f.events.length, before)
    f.stop()
  })
}

test('invalid dates, horizon, malformed times, and removed masters cannot submit', async () => {
  const f = fixture({ props: { initialDate: '2026-11-31' } })
  try {
    assert.equal(f.drafts.value.length, 0)
    assert.equal(f.horizonEnd.value, '2026-12-25')
    for (const date of ['2026-10-24', '2026-12-26']) f.toggleDate(date)
    assert.equal(f.drafts.value.length, 0)
    f.toggleDate('2026-10-26')
    for (const [start, end] of [['9:30', '20:00'], ['09:29', '20:00'], ['10:00', '10:00'], ['10:00', '20:01']]) {
      Object.assign(f.drafts.value[0], { start, end })
      await f.submit()
      assert.ok(f.formError.value)
    }
    f.props.masters = []
    await f.submit()
    assert.equal(f.calls.length, 0)
  } finally { f.stop() }
})

test('double submit and failed reconciliation cannot send duplicate or unchecked POSTs', async () => {
  const pending = deferred()
  const f = fixture({ api: { adminGetAvailability: () => pending.promise } })
  try {
    const first = f.submit()
    await f.submit()
    pending.resolve([])
    await first
    assert.equal(f.calls.length, 1)
  } finally { f.stop() }
  const blocked = fixture({ api: { adminGetAvailability: async () => { throw new Error('offline') } } })
  try { await blocked.submit(); assert.equal(blocked.calls.length, 0); assert.equal(blocked.drafts.value.length, 1) }
  finally { blocked.stop() }
})

test('route leave during GET stops writes and cancelled navigation does not lock the form', async () => {
  const pending = deferred()
  const f = fixture({ api: { adminGetAvailability: () => pending.promise } })
  try {
    const first = f.submit()
    f.leave()
    assert.equal(f.saving.value, false)
    pending.resolve([])
    await first
    assert.equal(f.calls.length, 0)
    assert.equal(f.events.some(([event]) => event === 'saved'), false)
    // A cancelled navigation leaves the component alive and permits an explicit retry.
    await f.submit()
    assert.equal(f.calls.length, 1)
  } finally { f.stop() }
})

test('calendar-month horizon clamps month ends and leap years', () => {
  for (const [today, end] of [['2026-12-31', '2027-02-28'], ['2027-12-31', '2028-02-29']]) {
    const f = fixture({ today, props: { initialDate: today } })
    try {
      assert.equal(f.horizonEnd.value, end)
      f.moveMonth(2)
      f.selectMonth(false)
      assert.ok(f.drafts.value.every(day => day.date <= end))
      assert.equal(f.monthDays.value.filter(Boolean).length, Number(end.slice(8)))
    } finally { f.stop() }
  }
})

test('real formatting sends Kyiv DST-correct timestamps', async () => {
  const source = await readFile(new URL('composables/useBookingFormatting.ts', root), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  vm.compileFunction(compiled, ['exports'])(exports)
  const { toKyivIso } = exports.useBookingFormatting()
  assert.equal(toKyivIso('2026-10-24', '09:30'), '2026-10-24T06:30:00.000Z')
  assert.equal(toKyivIso('2026-10-25', '09:30'), '2026-10-25T07:30:00.000Z')
})
