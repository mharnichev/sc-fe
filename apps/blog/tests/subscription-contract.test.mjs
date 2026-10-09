import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../composables/useBlogSubscription.ts', import.meta.url), 'utf8')
function loadSubscription(query = {}, path = '/newsletter/unsubscribe') {
  const calls = []
  const context = vm.createContext({
    computed: getter => ({ get value() { return getter() } }),
    useHead: () => {},
    onMounted: () => {},
    useNuxtApp: () => ({}),
    useRouter: () => ({ replace: () => {} }),
    useRoute: () => ({ path, fullPath: `${path}?token=SECRET123#SECRET123`, query }),
    useBlogLocale: () => ({ locale: { value: 'en' }, terms: { value: { subscriptionProofRequired: 'personal link required', subscriptionError: 'retry' } } }),
    useBlogApi: () => async (url, options) => {
      calls.push({ url, ...options })
      return { email: 'reader@example.com', status: 'subscribed', is_subscribed: true }
    },
  })
  const js = ts.transpileModule(source.replace('export const', 'const'), { compilerOptions: { module: ts.ModuleKind.None } }).outputText
  vm.runInContext(js + '\nglobalThis.result = useBlogSubscription()', context)
  return { ...context.result, calls }
}

test('newsletter resubscribe sends letter proof only in the dedicated field', async () => {
  const subscription = loadSubscription({ token: 'SECRET123', utm_source: 'SECRET123' })
  await subscription.subscribeToBlog(' reader@example.com ', 'blog_modal')
  const body = JSON.parse(JSON.stringify(subscription.calls[0].body))
  assert.equal(body.confirmation_token, 'SECRET123')
  assert.equal(body.email, 'reader@example.com')
  delete body.confirmation_token
  assert.equal(JSON.stringify(body).includes('SECRET123'), false)
  assert.equal(body.referrer, '/newsletter/unsubscribe')
  assert.equal(body.metadata_json.path, '/newsletter/unsubscribe')
})

test('signup supports confirmation_token and tokenless public responses', async () => {
  const subscription = loadSubscription({ confirmation_token: ['SECRET123', 'ignored'] }, '/')
  const response = await subscription.subscribeToBlog('reader@example.com')
  assert.equal(subscription.calls[0].body.confirmation_token, 'SECRET123')
  assert.equal('unsubscribe_token' in response, false)
})

test('email-only unsubscribe is rejected locally without a request', async () => {
  const subscription = loadSubscription()
  await assert.rejects(subscription.unsubscribeFromBlog({ email: 'reader@example.com' }), /Personal unsubscribe token/)
  await assert.rejects(subscription.unsubscribeFromBlog({ token: '  ' }), /Personal unsubscribe token/)
  assert.equal(subscription.calls.length, 0)
})

test('unsubscribe passes token and optional matching email', async () => {
  const subscription = loadSubscription()
  await subscription.unsubscribeFromBlog({ token: 'SECRET123', email: ' reader@example.com ', reason: 'user_request' })
  assert.deepEqual(JSON.parse(JSON.stringify(subscription.calls[0])), {
    url: '/public/blog/unsubscribe', method: 'POST', body: { token: 'SECRET123', email: 'reader@example.com', reason: 'user_request' },
  })
})

test('403 explains personal proof rather than suggesting blind retries', () => {
  const subscription = loadSubscription()
  assert.equal(subscription.subscriptionError({ statusCode: 403 }), 'personal link required')
  assert.equal(subscription.subscriptionError({ status: 403 }), 'personal link required')
  assert.equal(subscription.subscriptionError({ statusCode: 500 }), 'retry')
})
