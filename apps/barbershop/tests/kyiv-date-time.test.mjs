import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/kyivDateTime.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const kyiv = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('converts Kyiv wall-clock time independently of the browser timezone', () => {
  assert.equal(kyiv.kyivLocalDateTimeToIso('2026-01-15T10:30'), '2026-01-15T08:30:00.000Z')
  assert.equal(kyiv.kyivLocalDateTimeToIso('2026-07-15T10:30'), '2026-07-15T07:30:00.000Z')
})

test('rejects malformed and impossible Kyiv local values', () => {
  assert.equal(kyiv.kyivLocalDateTimeToIso(''), null)
  assert.equal(kyiv.kyivLocalDateTimeToIso('2026-02-31T10:30'), null)
  assert.equal(kyiv.kyivLocalDateTimeToIso('2026-07-15T25:00'), null)
})

test('formats instants as datetime-local values in Kyiv', () => {
  assert.equal(
    kyiv.kyivDateTimeLocalInput(new Date('2026-07-15T07:30:00.000Z')),
    '2026-07-15T10:30',
  )
})
