import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../e2e/support/shop.ts', import.meta.url), 'utf8')
const diagnostics = () => {
  const context = vm.createContext({
    URL, console: { info() {} },
    expect: (actual, message) => ({ toEqual: expected => assert.equal(JSON.stringify(actual), JSON.stringify(expected), message) }),
  })
  const script = ts.transpileModule(source.replace(/^import[^\n]+\n/gm, '').replace(/export const/g, 'const'), {
    compilerOptions: { module: ts.ModuleKind.None },
  }).outputText
  vm.runInContext(script + '\nglobalThis.install = installRuntimeDiagnostics', context)
  const handlers = {}
  const result = context.install({ on: (event, handler) => { handlers[event] = handler } })
  return { result, handlers }
}
const cartDelete = ({ method = 'DELETE', path = '/api/v1/public/customers/cart/1153', error = 'net::ERR_ABORTED' } = {}) => ({
  method: () => method,
  url: () => `http://127.0.0.1:8012${path}`,
  failure: () => ({ errorText: error }),
  resourceType: () => 'fetch',
})
const response = (request, status) => ({ request: () => request, status: () => status, url: () => request.url() })

test('records completed cart DELETE204 body abort separately from actual failures', () => {
  const { result, handlers } = diagnostics()
  const request = cartDelete()
  handlers.response(response(request, 204))
  handlers.requestfailed(request)
  result.assertClean()
  assert.equal(result.completedNoContentAborts.length, 1)
})

for (const [name, options, status] of [
  ['abort before any response', {}, null],
  ['ordinary 200 response', {}, 200],
  ['failed HTTP response', {}, 503],
  ['GET rather than DELETE', { method: 'GET' }, 204],
  ['different endpoint', { path: '/api/v1/public/orders/1153' }, 204],
  ['different transport failure', { error: 'net::ERR_CONNECTION_RESET' }, 204],
]) {
  test(`never hides ${name}`, () => {
    const { result, handlers } = diagnostics()
    const request = cartDelete(options)
    if (status) handlers.response(response(request, status))
    handlers.requestfailed(request)
    assert.throws(() => result.assertClean(), /Failed browser requests/)
    assert.equal(result.completedNoContentAborts.length, 0)
  })
}

test('same URL from a different request is not evidence of a successful DELETE', () => {
  const { result, handlers } = diagnostics()
  handlers.response(response(cartDelete(), 204))
  handlers.requestfailed(cartDelete())
  assert.throws(() => result.assertClean(), /Failed browser requests/)
})
