import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const nuxtRequire = createRequire(import.meta.resolve('nuxt/package.json'))
const vuePath = pathToFileURL(nuxtRequire.resolve('vue')).href
const { ref } = await import(vuePath)

const source = await readFile(new URL('../composables/useBookingReconciliation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("from 'vue'", `from '${vuePath}'`)
const { useBookingReconciliation, bookingActionErrorMessage } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const settle = () => new Promise(resolve => setImmediate(resolve))
const booking = (id = 1, status = 'confirmed') => ({ id, status, services: [] })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const conflict = { response: { status: 400 }, data: { detail: 'Completed bookings cannot be modified' } }
function setup(load) {
  const selected = ref(null)
  const updates = []
  const deleted = []
  let refreshes = 0
  const state = useBookingReconciliation(selected, { load, onUpdated: b => updates.push(b), onDeleted: id => deleted.push(id), refreshList: async () => { refreshes++ } })
  return { selected, updates, deleted, state, refreshes: () => refreshes }
}

test('opening revalidates once and updates completed mode without refreshing calendar', async () => {
  let requests = 0
  const { selected, state, updates, refreshes } = setup(async id => { requests++; return booking(id, 'completed') })
  selected.value = booking()
  assert.equal(state.busy.value, true)
  await Promise.all([state.refreshSelected(), state.refreshSelected()])
  assert.equal(requests, 1)
  assert.equal(selected.value.status, 'completed')
  assert.match(state.notice.value, /уже завершено/)
  assert.equal(updates.length, 1)
  assert.equal(refreshes(), 0)
})

test('completed conflict immediately locks stale record even if recovery read fails', async () => {
  let calls = 0
  const { selected, state } = setup(async id => { if (++calls > 1) throw Error('offline'); return booking(id) })
  selected.value = booking()
  await settle()
  let fail
  const result = state.mutate(() => new Promise((_, reject) => { fail = reject }), 'Помилка')
  let duplicate = 0
  assert.equal(await state.mutate(async () => { duplicate++ }, 'Помилка'), false)
  fail(conflict)
  assert.equal(await result, false)
  assert.equal(duplicate, 0)
  assert.equal(selected.value.status, 'completed')
  assert.equal(state.needsRefresh.value, true)
  assert.match(state.error.value, /Перевірте інтернет/)
  assert.match(state.notice.value, /уже завершено/)
})

test('late read response cannot replace another selected record or reopen a closed modal', async () => {
  const requests = [deferred(), deferred()]
  const { selected, state } = setup(id => requests[id - 1].promise)
  selected.value = booking(1)
  selected.value = booking(2)
  requests[0].resolve(booking(1, 'completed'))
  await settle()
  assert.equal(selected.value.id, 2)
  selected.value = null
  requests[1].resolve(booking(2))
  await settle()
  assert.equal(selected.value, null)
  assert.equal(state.checking.value, false)
})

test('switching during mutation verifies new record and does not overwrite it', async () => {
  const mutation = deferred()
  let reads = 0
  const { selected, state } = setup(async id => { reads++; return booking(id) })
  selected.value = booking(1)
  await settle()
  const result = state.mutate(() => mutation.promise, 'Помилка')
  selected.value = booking(2)
  mutation.resolve(booking(1, 'completed'))
  await result
  await settle()
  assert.equal(selected.value.id, 2)
  assert.equal(selected.value.status, 'confirmed')
  assert.equal(reads, 2)
})

test('409 revalidates actual state without assuming completion; raw English is hidden', async () => {
  const { selected, state } = setup(async id => booking(id))
  selected.value = booking()
  await settle()
  await state.mutate(async () => { throw { response: { status: 409 }, data: { detail: 'Time slot unavailable' } } }, 'Помилка')
  assert.equal(selected.value.status, 'confirmed')
  assert.match(state.error.value, /доступність часу змінилися/)
  assert.equal(state.busy.value, false)
  assert.equal(bookingActionErrorMessage({ data: { detail: 'Internal diagnostic' } }, 'Не вдалося зберегти.'), 'Не вдалося зберегти.')
})

test('archived record on opening is removed instead of entering an endless refresh loop', async () => {
  const { selected, state, deleted } = setup(async () => { throw { response: { status: 404 } } })
  selected.value = booking()
  await settle()
  assert.equal(selected.value, null)
  assert.deepEqual(deleted, [1])
  assert.equal(state.busy.value, false)
  assert.equal(state.needsRefresh.value, false)
})

test('a lost archive response is reconciled by the subsequent 404 without retrying DELETE', async () => {
  let archived = false
  const { selected, state, deleted } = setup(async id => {
    if (archived) throw { response: { status: 404 } }
    return booking(id)
  })
  selected.value = booking()
  await settle()
  let mutations = 0
  assert.equal(await state.mutate(async () => {
    mutations++
    archived = true
    throw Error('lost response')
  }, 'Помилка', true), false)
  assert.equal(mutations, 1)
  assert.equal(selected.value, null)
  assert.deepEqual(deleted, [1])
  assert.equal(state.busy.value, false)
})

test('permission failure does not pretend the booking was deleted and blocks mutations until retry', async () => {
  let denied = true
  const { selected, state, deleted } = setup(async id => {
    if (denied) throw { response: { status: 403 } }
    return booking(id)
  })
  selected.value = booking()
  await settle()
  assert.equal(selected.value.id, 1)
  assert.deepEqual(deleted, [])
  assert.equal(state.needsRefresh.value, true)
  assert.equal(await state.mutate(async () => assert.fail('unauthorized mutation'), 'Помилка'), false)
  denied = false
  await state.refreshSelected()
  assert.equal(state.busy.value, false)
  assert.equal(state.error.value, '')
})

test('late 404 for the previous selection cannot remove the current booking', async () => {
  let reject
  const { selected, deleted } = setup(id => id === 1
    ? new Promise((_, fail) => { reject = fail })
    : Promise.resolve(booking(id)))
  selected.value = booking(1)
  await settle()
  selected.value = booking(2)
  reject({ response: { status: 404 } })
  await settle()
  assert.equal(selected.value.id, 2)
  assert.deepEqual(deleted, [])
})

test('removing a row absent after a list refresh never decrements its total', async () => {
  const page = await readFile(new URL('../pages/my-bookings.vue', import.meta.url), 'utf8')
  const body = page.match(/const removeBooking = \(id: number\) => \{([\s\S]*?)\n\}/)[1]
  const data = { value: { items: [booking(2)], total: 10 } }
  const remove = new Function('id', 'data', 'normalizeItems', body)
  const normalize = value => Array.isArray(value) ? value : value.items
  remove(1, data, normalize)
  assert.equal(data.value.total, 10)
  remove(2, data, normalize)
  assert.equal(data.value.total, 9)
  remove(2, data, normalize)
  assert.equal(data.value.total, 9)
})
