import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const component = await readFile(new URL('../components/auth/UserOtpCode.vue', import.meta.url), 'utf8')
let sequence = 0

async function setup(t, options = {}) {
  const calls = [], events = [], stops = []
  const auth = vue.reactive({ loading: false, error: '', verifyOtp: async (...args) => { calls.push(args) }, ...options.auth })
  const props = { phone: '+380990001234', debugCode: '', ...options.props }
  Object.assign(globalThis, {
    ref: vue.ref, computed: vue.computed,
    watch: (...args) => { const stop = vue.watch(...args); stops.push(stop); return stop },
    defineProps: () => props, withDefaults: value => value,
    defineEmits: () => (...event) => events.push(event),
    useCustomerAuthStore: () => auth,
    useShopLocale: () => ({ terms: vue.ref({ auth: { verifyError: 'Verification failed' } }) }),
    useShopRuntimeDisplay: () => ({ runtimeMessage: value => value }),
    onMounted: () => {}, onBeforeUnmount: () => {},
  })
  const source = component.split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm, '')
  const compiled = ts.transpileModule(source + '\nexport { otpCode, isOtpComplete, verifyOtp, errorMessage };', {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const state = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}#otp-${sequence++}`)
  t.after(() => stops.forEach(stop => stop()))
  return { ...state, auth, calls, events }
}

test('incomplete, oversized and nonnumeric codes never reach verification', async t => {
  const form = await setup(t)
  for (const value of ['', '123', '1234', '12345', '1234567', '12345x', '123 456', '１２３４５６']) {
    form.otpCode.value = value
    await vue.nextTick()
    assert.equal(form.isOtpComplete.value, false, value)
    await form.verifyOtp()
  }
  assert.deepEqual(form.calls, [])
  assert.deepEqual(form.events, [])
})

test('six digits including leading zero auto-submit the trimmed code once', async t => {
  const form = await setup(t)
  form.otpCode.value = ' 012345 '
  await vue.nextTick()
  assert.equal(form.isOtpComplete.value, true)
  assert.deepEqual(form.calls, [['+380990001234', '012345']])
  assert.deepEqual(form.events, [['hide-modal']])
})

test('missing phone and pending verification block auto and explicit submissions', async t => {
  for (const options of [{ props: { phone: '' } }, { auth: { loading: true } }]) {
    const form = await setup(t, options)
    form.otpCode.value = '123456'
    await vue.nextTick()
    await form.verifyOtp()
    assert.deepEqual(form.calls, [])
    assert.deepEqual(form.events, [])
  }
})

test('verification failures keep the form open and retain server error', async t => {
  const form = await setup(t, { auth: { error: 'Invalid OTP code', verifyOtp: async () => { throw new Error('rejected') } } })
  form.otpCode.value = '123456'
  await vue.nextTick()
  assert.equal(form.errorMessage.value, 'Invalid OTP code')
  assert.deepEqual(form.events, [])
})

test('the submit button uses the same completion predicate as the handler', () => {
  assert.match(component, /:disabled="auth\.loading \|\| !isOtpComplete"/)
  assert.match(component, /if \(!props\.phone \|\| !isOtpComplete\.value \|\| auth\.loading\) return/)
})
