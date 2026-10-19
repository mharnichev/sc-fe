import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../composables/useBookingCalendar.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/export /g, '')

test('Monday slots are usable while past slots and busy ranges remain protected', () => {
  const calendar = new Function('useBookingFormatting', `${compiled}; return useBookingCalendar();`)(() => ({
    timeZone: 'Europe/Kyiv', todayInput: () => '2026-10-19',
    addDaysInput: value => value,
    toKyivIso: (date, time) => `${date}T${time}:00+03:00`,
  }))
  const day = calendar.buildDays('2099-01-05', 'today')[0]
  const slots = calendar.buildSlotsByDay([day])[day.date]
  assert.ok(slots.length > 0)
  assert.ok(slots.every(slot => !slot.disabled && !slot.isPast))
  const pastDay = calendar.buildDays('2000-01-03', 'today')[0]
  const past = calendar.buildSlotsByDay([pastDay])[pastDay.date]
  assert.ok(past.every(slot => slot.disabled && slot.isPast))
  const first = slots[0]
  assert.equal(calendar.rangeOverlapsBusy(first.startAt, first.endAt, [{
    id: 'synthetic-block', kind: 'block', date: first.date,
    startAt: first.startAt, endAt: first.endAt,
    startMinutes: first.startMinutes, endMinutes: first.endMinutes,
  }]), true)
})
