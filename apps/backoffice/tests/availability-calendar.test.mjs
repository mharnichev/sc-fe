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
const source = await readFile(new URL('components/AvailabilityWindowForm.vue', root), 'utf8')
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { resolve, promise } }

function fixture(options = {}) {
  const props = vue.reactive({ active: true, admin: true, masters: [{ id: 7 }], disabled: false, initialDate: '2026-10-26', initialMasterId: 7, ...options.props })
  const auth = vue.reactive({ sessionRevision: 1, user: { id: 1, role: 'admin', master_id: 7 } })
  const calls = [], events = [], unmount = [], leave = []
  const windows = []
  const api = {
    adminGetAvailability: async () => [],
    getMyAvailability: async () => [],
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
    Date: class extends Date { static now() { return Date.parse('2026-10-25T00:00:00Z') } },
    ...vue, defineProps: () => props, withDefaults: value => value,
    defineEmits: () => (...args) => { events.push(args); if (args[0] === 'complete') props.active = false },
    useBackofficeApi: () => api, useAuthStore: () => auth,
    useId: () => 'test', useAssetUrl: () => value => value, useBaseToastNotification: () => ({ warning() {} }),
    useBookingCalendar: () => ({ workdayStart: '09:30', workdayEnd: '20:00' }),
    useBookingFormatting: () => formatting,
    onMounted() {}, onBeforeUnmount: callback => unmount.push(callback),
    onBeforeRouteLeave: callback => leave.push(callback),
    document: { removeEventListener() {}, getElementById: options.getElementById || (() => null) },
    window: { matchMedia: () => ({ matches: true }) }, initials: () => 'M',
  }
  const script = parse(source).descriptor.scriptSetup.content.replace(/^import .*\n/gm, '')
  const compiled = ts.transpileModule(`${script}\nreturn { submit, drafts, form, formError, saving, toggleDate, applyTimes, validate, fillForm, horizonEnd, visibleMonth, monthDays, moveMonth, selectMonth, loadAvailability, existingWindows, focusedDate, closeExistingDay, availabilityError, availabilityReady };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const scope = vue.effectScope()
  const state = scope.run(() => vm.compileFunction(compiled, Object.keys(globals))(...Object.values(globals)))
  return { ...state, ready: vue.nextTick().then(() => vue.nextTick()), calls, events, props, auth, windows, leave() { leave.forEach(callback => callback()) }, stop() { unmount.forEach(callback => callback()); scope.stop() } }
}

test('all owned Vue files compile with existing SFC compiler', async () => {
  for (const path of ['components/AvailabilityWindowForm.vue', 'components/AvailabilityWindowFormModal.vue', 'components/BaseInput.vue']) {
    const { descriptor, errors } = parse(await readFile(new URL(path, root), 'utf8'))
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: path })
    const template = compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
  }
})

test('opening reads date and slot time after the complete reactive parent prop batch', async () => {
  const f = fixture({ props: { active: false, initialDate: undefined, initialMasterId: null } })
  try {
    // Match Vue parent prop assignment order: active arrives before draft props.
    f.props.active = true
    f.props.initialDate = '2026-11-02'
    f.props.initialStartTime = '12:00'
    f.props.initialEndTime = '12:30'
    f.props.initialMasterId = 7
    f.props.masters = [{ id: 7 }]
    await vue.nextTick(); await vue.nextTick()
    assert.equal(f.focusedDate.value, '2026-11-02')
    assert.equal(f.visibleMonth.value, '2026-11')
    assert.equal(f.form.master_id, '7')
    assert.equal(f.form.start_time, '12:00')
    assert.deepEqual(f.drafts.value.map(day => [day.date, day.start, day.end]), [['2026-11-02', '12:00', '12:30']])
    assert.equal(f.calls.length, 0)
  } finally { f.stop() }
})

test('batched opening focuses an existing day without creating a draft', async () => {
  const f = fixture({ props: { active: false, initialDate: undefined }, api: { adminGetAvailability: async () => [existingWindow(42)] } })
  try {
    f.props.active = true
    f.props.initialDate = '2026-10-26'
    await vue.nextTick(); await vue.nextTick()
    assert.equal(f.focusedDate.value, '2026-10-26')
    assert.equal(f.existingWindows.value[0].id, 42)
    assert.equal(f.drafts.value.length, 0)
  } finally { f.stop() }
})

for (const interruption of ['close', 'session', 'unmount']) {
  test(`${interruption} before the opening batch flush prevents initialization`, async () => {
    let reads = 0
    const f = fixture({ props: { active: false }, api: { adminGetAvailability: async () => { reads++; return [] } } })
    f.props.active = true
    f.props.initialDate = '2026-11-02'
    if (interruption === 'close') f.props.active = false
    if (interruption === 'session') f.auth.sessionRevision++
    if (interruption === 'unmount') f.stop()
    await vue.nextTick(); await vue.nextTick()
    assert.equal(reads, 0)
    assert.equal(f.drafts.value.length, 0)
    f.stop()
  })
}

test('initial day/master, independent times, and self endpoint are preserved', async () => {
  const f = fixture({ props: { admin: false } })
  try {
    await f.ready
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
    adminGetAvailability: async () => committed.map((item, index) => ({ id: index + 1, ...item })),
    adminCreateAvailabilityWindow: async body => {
      attempts++
      committed.push(body)
      if (attempts === 2) throw new Error('response lost')
    },
  } })
  try {
    await f.ready
    f.toggleDate('2026-10-27')
    await f.submit()
    assert.deepEqual(f.drafts.value.map(day => day.date), ['2026-10-27'])
    const signature = f.drafts.value[0].errorSignature
    const backendError = f.drafts.value[0].backendError
    assert.ok(signature && backendError)
    f.validate()
    assert.equal(f.drafts.value[0].error, '', 'deliberate retry clears the displayed error')
    assert.equal(f.drafts.value[0].errorSignature, signature)
    assert.equal(f.drafts.value[0].backendError, backendError)
    await f.submit()
    assert.equal(attempts, 2, 'retry must not POST committed interval again')
    assert.equal(f.drafts.value.length, 0)
    assert.equal(f.events.filter(([event]) => event === 'saved').length, 2, 'retry acknowledges the reconciled committed day')
  } finally { f.stop() }
})

test('changing a failed interval invalidates its retry evidence', async () => {
  const f = fixture({ api: { adminCreateAvailabilityWindow: async () => { throw new Error('response lost') } } })
  try {
    await f.ready
    await f.submit()
    assert.ok(f.drafts.value[0].backendError)
    f.drafts.value[0].start = '10:00'
    f.validate()
    assert.equal(f.drafts.value[0].backendError, undefined)
    assert.equal(f.drafts.value[0].errorSignature, undefined)
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
    await f.ready
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
    const started = deferred()
    let sent = 0
    const f = fixture({ api: { adminCreateAvailabilityWindow: async () => { sent++; started.resolve(); await pending.promise } } })
    await f.ready
    f.toggleDate('2026-10-27')
    const result = f.submit()
    await started.promise
    assert.equal(sent, 1)
    if (interruption === 'session') f.auth.sessionRevision++
    if (interruption === 'role') f.auth.user.role = 'barber'
    if (interruption === 'unmount') f.stop()
    if (interruption === 'close') f.props.active = false
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
    await f.ready
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
  const f = fixture({ api: { adminGetAvailability: (() => { let reads = 0; return () => ++reads === 1 ? Promise.resolve([]) : pending.promise })() } })
  try {
    await f.ready
    const first = f.submit()
    await f.submit()
    pending.resolve([])
    await first
    assert.equal(f.calls.length, 1)
  } finally { f.stop() }
  const blocked = fixture({ api: { adminGetAvailability: async () => { throw new Error('offline') } } })
  try { await blocked.ready; blocked.drafts.value = [{ date: '2026-10-26', start: '09:30', end: '20:00', error: '' }]; await blocked.submit(); assert.equal(blocked.calls.length, 0); assert.equal(blocked.drafts.value.length, 1) }
  finally { blocked.stop() }
})

test('route leave during GET stops writes and cancelled navigation does not lock the form', async () => {
  const pending = deferred()
  let reads = 0
  const f = fixture({ api: { adminGetAvailability: () => ++reads === 1 ? Promise.resolve([]) : pending.promise } })
  try {
    await f.ready
    const first = f.submit()
    f.leave()
    assert.equal(f.saving.value, false)
    pending.resolve([])
    await first
    assert.equal(f.calls.length, 0)
    assert.equal(f.events.some(([event]) => event === 'saved'), false)
    // Route leave completes the form; explicit reactivation after cancelled navigation permits a fresh selection.
    assert.equal(f.props.active, false)
    f.props.active = true
    await vue.nextTick(); await vue.nextTick()
    f.toggleDate('2026-10-26')
    await f.submit()
    assert.equal(f.calls.length, 1)
  } finally { f.stop() }
})

test('calendar-month horizon clamps month ends and leap years', async () => {
  for (const [today, end] of [['2026-12-31', '2027-02-28'], ['2027-12-31', '2028-02-29']]) {
    const f = fixture({ today, props: { initialDate: today } })
    try {
    await f.ready
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

const existingWindow = (id, end = '2026-10-26T20:00:00+02:00') => ({ id, master_id: 7, start_at: '2026-10-26T09:30:00+02:00', end_at: end })
for (const complete of [true, false]) {
  test(`redirected calendar uses canonical window ID with ${complete ? 'complete' : 'incomplete'} owner metadata`, async () => {
    const deleted = [], requested = []
    const masters = [{ id: 7, booking_redirect_master_id: 8 }, ...(complete ? [{ id: 8, booking_redirect_master_id: 9 }, { id: 9, booking_redirect_master_id: null }] : [])]
    const f = fixture({ props: { masters }, api: {
      adminGetAvailability: async filters => { requested.push(filters.master_id); return [{ ...existingWindow(42), master_id: 9 }] },
      adminDeleteAvailabilityWindow: async id => { deleted.push(id) },
    } })
    try {
      await f.ready
      assert.equal(f.availabilityReady.value, true)
      assert.deepEqual(requested, [7])
      await f.closeExistingDay()
      assert.deepEqual(deleted, [42])
      assert.equal(f.existingWindows.value.length, 0)
    } finally { f.stop() }
  })
}

test('known canonical owner rejects unrelated windows', async () => {
  const f = fixture({ props: { masters: [{ id: 7, booking_redirect_master_id: 9 }, { id: 9, booking_redirect_master_id: null }] }, api: {
    adminGetAvailability: async () => [existingWindow(42)],
  } })
  try { await f.ready; assert.equal(f.availabilityReady.value, false); assert.equal(f.existingWindows.value.length, 0) }
  finally { f.stop() }
})

test('fresh preflight removes conflicting drafts before any POST', async () => {
  let reads = 0
  const f = fixture({ api: { adminGetAvailability: async () => ++reads === 1 ? [] : [existingWindow(1)] } })
  try {
    await f.ready
    f.toggleDate('2026-10-27')
    await f.submit()
    assert.equal(f.calls.length, 0)
    assert.deepEqual(f.drafts.value.map(day => day.date), ['2026-10-27'])
    assert.equal(f.focusedDate.value, '2026-10-26')
    assert.match(f.formError.value, /уже є у графіку/)
  } finally { f.stop() }
})

test('failed day is focused only after saving is cleared', async () => {
  let f, focused = 0
  f = fixture({
    api: { adminCreateAvailabilityWindow: async () => { throw new Error('offline') } },
    getElementById: () => ({ scrollIntoView() {}, focus() { assert.equal(f.saving.value, false); focused++ } }),
  })
  try { await f.ready; await f.submit(); assert.equal(focused, 1); assert.equal(f.calls.length, 0) }
  finally { f.stop() }
})

for (const interruption of ['session', 'role', 'master', 'removed-master', 'close', 'disabled', 'unmount', 'leave']) {
  test(`${interruption} during DELETE stops loop and suppresses stale results`, async () => {
    const pending = deferred()
    let deleted = 0
    const f = fixture({ api: {
      adminGetAvailability: async () => [existingWindow(1), existingWindow(2)],
      adminDeleteAvailabilityWindow: async () => { deleted++; await pending.promise; throw new Error('late failure') },
    } })
    await f.ready
    const result = f.closeExistingDay()
    assert.equal(deleted, 1)
    if (interruption === 'session') f.auth.sessionRevision++
    if (interruption === 'role') f.auth.user.role = 'barber'
    if (interruption === 'master') f.form.master_id = '8'
    if (interruption === 'removed-master') f.props.masters = []
    if (interruption === 'close') f.props.active = false
    if (interruption === 'disabled') f.props.disabled = true
    if (interruption === 'unmount') f.stop()
    if (interruption === 'leave') f.leave()
    const before = f.events.length
    pending.resolve(); await result
    assert.equal(deleted, 1)
    assert.equal(f.events.length, before)
    f.stop()
  })
}

test('spanning windows cannot be deleted by a day action', async () => {
  let deleted = 0
  const f = fixture({ api: {
    adminGetAvailability: async () => [existingWindow(1, '2026-10-27T10:00:00+02:00')],
    adminDeleteAvailabilityWindow: async () => { deleted++ },
  } })
  try { await f.ready; await f.closeExistingDay(); assert.equal(deleted, 0) }
  finally { f.stop() }
})

test('old availability read cannot populate a reopened session', async () => {
  const pending = deferred()
  const f = fixture({ api: { adminGetAvailability: () => pending.promise } })
  f.auth.sessionRevision++
  pending.resolve([existingWindow(1)])
  await f.ready
  assert.equal(f.existingWindows.value.length, 0)
  assert.equal(f.availabilityReady.value, false)
  f.stop()
})

test('BaseInput preserves caller ARIA while adding field descriptions and errors', async () => {
  const input = await readFile(new URL('components/BaseInput.vue', root), 'utf8')
  const script = parse(input).descriptor.scriptSetup.content.replace(/^import .*\n/gm, '')
  const compiled = ts.transpileModule(`${script}\nreturn { describedBy, ariaInvalid, castValue };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const props = vue.reactive({ id: 'time', hint: 'help', error: '', modelModifiers: {}, type: 'text' })
  const attrs = { 'aria-describedby': 'external time-hint', 'aria-invalid': 'grammar' }
  const globals = { ...vue, defineOptions() {}, defineProps: () => props, withDefaults: value => value, defineEmits: () => () => {}, defineExpose() {}, useAttrs: () => attrs, useId: () => 'input' }
  const state = vm.compileFunction(compiled, Object.keys(globals))(...Object.values(globals))
  assert.equal(state.describedBy.value, 'external time-hint')
  assert.equal(state.ariaInvalid.value, 'grammar')
  props.error = 'invalid'
  assert.equal(state.describedBy.value, 'external time-hint time-error')
  assert.equal(state.ariaInvalid.value, true)
  assert.equal(state.castValue('  text  '), '  text  ')
  props.modelModifiers = { trim: true, number: true }
  assert.equal(state.castValue(' 12 '), 12)
  assert.equal(state.castValue(''), null)
})
