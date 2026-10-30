import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../utils/masterRewardsView.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const view = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
test('rate requires explicit valid basis points, including explicit zero; never invents 10%', () => {
  for (const [value, expected] of [['', null], [' ', null], ['7,25', 725], ['0', 0], ['100', 10000], ['100.01', null], ['-1', null], ['1.123', null], ['1e2', null]]) assert.equal(view.parseRewardRate(value), expected)
})
test('sale period presets use calendar boundaries, including Sunday and month transitions', () => {
  assert.deepEqual(view.rewardRange('week', '2026-11-01'), { from: '2026-10-26', to: '2026-11-01' })
  assert.deepEqual(view.rewardRange('month', '2026-11-01'), { from: '2026-11-01', to: '2026-11-01' })
})
