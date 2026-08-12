import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const utilitySource = await read('../utils/googleCalendar.ts')
const utilityCompiled = ts.transpileModule(utilitySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const calendar = await import(`data:text/javascript;base64,${Buffer.from(utilityCompiled).toString('base64')}`)

const calendarParams = input => new URL(input).searchParams

test('builds a Google Calendar event with Kyiv timezone, duration and visit details', () => {
  const params = calendarParams(calendar.buildGoogleCalendarUrl({
    startAt: '2026-07-15T10:30:00+03:00',
    durationMinutes: 90,
    masterName: 'Олексій',
    serviceNames: ['Стрижка', 'Борода'],
  }))

  assert.equal(params.get('action'), 'TEMPLATE')
  assert.equal(params.get('text'), 'Запис до Soul Cuts')
  assert.equal(params.get('dates'), '20260715T073000Z/20260715T090000Z')
  assert.equal(params.get('ctz'), 'Europe/Kyiv')
  assert.equal(params.get('location'), 'вул. Канатна, 6, Одеса')
  assert.equal(params.get('details'), 'Майстер: Олексій\nПослуги: Стрижка, Борода')
})

test('keeps winter and summer Kyiv instants correct', () => {
  const winter = calendarParams(calendar.buildGoogleCalendarUrl({
    startAt: '2026-01-15T10:30:00+02:00',
    durationMinutes: 60,
  }))
  const summer = calendarParams(calendar.buildGoogleCalendarUrl({
    startAt: '2026-07-15T10:30:00+03:00',
    durationMinutes: 60,
  }))

  assert.equal(winter.get('dates'), '20260115T083000Z/20260115T093000Z')
  assert.equal(summer.get('dates'), '20260715T073000Z/20260715T083000Z')
})

test('does not add customer data, tokens or internal identifiers', () => {
  const url = calendar.buildGoogleCalendarUrl({
    startAt: '2026-08-09T12:00:00+03:00',
    durationMinutes: 45,
    masterName: 'Іван',
    serviceNames: ['Стрижка'],
  })

  assert.doesNotMatch(url, /phone|token|booking_id|customer/i)
  assert.equal(calendar.buildGoogleCalendarUrl({ startAt: 'invalid', durationMinutes: 45 }), '')
  assert.equal(calendar.buildGoogleCalendarUrl({ startAt: '2026-08-09T12:00:00+03:00', durationMinutes: 0 }), '')
  assert.equal(calendar.buildGoogleCalendarUrl({ startAt: '2026-08-09T12:00:00+03:00', durationMinutes: Number.NaN }), '')
})

test('booking success overlay offers Google Calendar and tracks a privacy-safe click', async () => {
  const source = await read('../components/sections/BookingSection.vue')

  assert.match(source, /buildGoogleCalendarUrl/)
  assert.match(source, /booking_calendar_click/)
  assert.match(source, /channel: 'web'/)
  assert.match(source, /message_type: 'booking_success'/)
  assert.match(source, /target="_blank"/)
  assert.doesNotMatch(source, /booking_calendar_click[\s\S]{0,220}(customer_phone|customer_name|funnel_session_id)/)
})
