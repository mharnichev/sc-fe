import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

test('website booking sends SMS consent for any selected master', async () => {
  const component = await readFile(new URL('../components/sections/BookingSection.vue', import.meta.url), 'utf8')
  const script = component.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const source = ts.createSourceFile('booking.ts', script, ts.ScriptTarget.Latest, true)
  const payloads = []
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'domain.createBooking') {
      payloads.push(node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.equal(payloads.length, 1)
  const payload = payloads[0]
  assert.ok(ts.isObjectLiteralExpression(payload))
  const property = name => payload.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(source) === name)
  assert.equal(property('sms_consent')?.initializer.kind, ts.SyntaxKind.TrueKeyword)
  assert.equal(property('master_id')?.initializer.getText(source), 'selectedMasterId.value')
})

test('booking disclosure names review and promotional SMS in both languages', async () => {
  const terms = await readFile(new URL('../data/terms.ts', import.meta.url), 'utf8')
  assert.match(terms, /bookingConsentSuffix: '[^']*SMS[^']*відгук[^']*акції[^']*відмовитися/)
  assert.match(terms, /bookingConsentSuffix: '[^']*SMS[^']*review requests[^']*promotions[^']*unsubscribe/)
})
