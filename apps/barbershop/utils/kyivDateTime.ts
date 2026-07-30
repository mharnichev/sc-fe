const KYIV_TIME_ZONE = 'Europe/Kyiv'

const kyivPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KYIV_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const dateTimeParts = (date: Date) => {
  const values = Object.fromEntries(
    kyivPartsFormatter
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  )

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

const pad = (value: number) => String(value).padStart(2, '0')

export const kyivDateTimeLocalInput = (date: Date) => {
  if (Number.isNaN(date.getTime())) return ''
  const parts = dateTimeParts(date)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

export const kyivLocalDateTimeToIso = (value: string): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match
  const expected = {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
    hour: Number(hourRaw),
    minute: Number(minuteRaw),
  }
  const utcGuess = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
  )
  const calendarCheck = new Date(utcGuess)
  if (
    calendarCheck.getUTCFullYear() !== expected.year
    || calendarCheck.getUTCMonth() + 1 !== expected.month
    || calendarCheck.getUTCDate() !== expected.day
    || calendarCheck.getUTCHours() !== expected.hour
    || calendarCheck.getUTCMinutes() !== expected.minute
  ) {
    return null
  }

  const offsetAt = (instant: Date) => {
    const parts = dateTimeParts(instant)
    return Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - instant.getTime()
  }

  let candidate = new Date(utcGuess - offsetAt(new Date(utcGuess)))
  candidate = new Date(utcGuess - offsetAt(candidate))
  const actual = dateTimeParts(candidate)
  if (
    actual.year !== expected.year
    || actual.month !== expected.month
    || actual.day !== expected.day
    || actual.hour !== expected.hour
    || actual.minute !== expected.minute
  ) {
    return null
  }

  return candidate.toISOString()
}
