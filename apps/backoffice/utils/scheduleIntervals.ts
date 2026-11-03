export interface TimeRange {
  start: number
  end: number
}

interface ScheduleIntervalItem {
  start_at?: string
  end_at?: string
}

export const timestamp = (value?: string | null) => {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? time : null
}

export const rangesFromItems = (items: ScheduleIntervalItem[]): TimeRange[] =>
  items.map(item => ({ start: timestamp(item.start_at), end: timestamp(item.end_at) }))
    .filter((range): range is TimeRange => range.start != null && range.end != null && range.end > range.start)

export const mergeRanges = (ranges: TimeRange[]): TimeRange[] => {
  const sorted = ranges
    .filter(range => range.end > range.start)
    .sort((first, second) => first.start - second.start || first.end - second.end)
  if (!sorted.length) return []

  const merged: TimeRange[] = []
  let current = { ...sorted[0] }
  for (const range of sorted.slice(1)) {
    if (range.start <= current.end) {
      current.end = Math.max(current.end, range.end)
      continue
    }
    merged.push(current)
    current = { ...range }
  }
  merged.push(current)
  return merged
}

export const intersectRanges = (firstRanges: TimeRange[], secondRanges: TimeRange[]): TimeRange[] => {
  const first = mergeRanges(firstRanges)
  const second = mergeRanges(secondRanges)
  const intersections: TimeRange[] = []
  let firstIndex = 0
  let secondIndex = 0

  while (firstIndex < first.length && secondIndex < second.length) {
    const start = Math.max(first[firstIndex].start, second[secondIndex].start)
    const end = Math.min(first[firstIndex].end, second[secondIndex].end)
    if (end > start) intersections.push({ start, end })

    if (first[firstIndex].end <= second[secondIndex].end) firstIndex += 1
    else secondIndex += 1
  }
  return intersections
}

export const subtractRanges = (sourceRanges: TimeRange[], excludedRanges: TimeRange[]): TimeRange[] => {
  const source = mergeRanges(sourceRanges)
  const excluded = mergeRanges(excludedRanges)
  const result: TimeRange[] = []
  let excludedIndex = 0

  for (const range of source) {
    let cursor = range.start
    while (excludedIndex < excluded.length && excluded[excludedIndex].end <= cursor) excludedIndex += 1

    let currentExcludedIndex = excludedIndex
    while (currentExcludedIndex < excluded.length && excluded[currentExcludedIndex].start < range.end) {
      const excludedRange = excluded[currentExcludedIndex]
      if (excludedRange.start > cursor) result.push({ start: cursor, end: Math.min(excludedRange.start, range.end) })
      cursor = Math.max(cursor, excludedRange.end)
      if (cursor >= range.end) break
      currentExcludedIndex += 1
    }
    excludedIndex = currentExcludedIndex
    if (cursor < range.end) result.push({ start: cursor, end: range.end })
  }
  return result
}

export const minutesInRanges = (ranges: TimeRange[]) =>
  Math.round(mergeRanges(ranges).reduce((total, range) => total + range.end - range.start, 0) / 60000)

/** Clip half-open intervals to actual instants, never to a fixed 24-hour day. */
export const clipScheduleItems = <T extends ScheduleIntervalItem>(items: T[], bounds: TimeRange): T[] =>
  items.flatMap(item => {
    const range = rangesFromItems([item])[0]
    if (!range) return []
    const start = Math.max(range.start, bounds.start)
    const end = Math.min(range.end, bounds.end)
    return end > start ? [{ ...item, start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString() }] : []
  })

export const scheduleOccupancy = (availability: TimeRange[], blocks: TimeRange[], bookings: TimeRange[], bounds: TimeRange) => {
  const scheduled = intersectRanges(availability, [bounds])
  const blocked = intersectRanges(scheduled, blocks)
  const capacity = subtractRanges(scheduled, blocked)
  const booked = intersectRanges(capacity, bookings)
  const capacityMinutes = minutesInRanges(capacity)
  const bookedMinutes = minutesInRanges(booked)
  return {
    scheduledMinutes: minutesInRanges(scheduled), blockedMinutes: minutesInRanges(blocked),
    capacityMinutes, bookedMinutes, freeMinutes: Math.max(0, capacityMinutes - bookedMinutes),
    loadPercent: capacityMinutes ? Math.round(bookedMinutes / capacityMinutes * 100) : null,
  }
}

/** Redirect aliases share one physical calendar, including multi-hop redirects. */
export const physicalCalendarId = (id: number, redirects: Map<number, number>) => {
  const visited = new Set<number>()
  let current = id
  while (redirects.has(current) && !visited.has(current)) {
    visited.add(current)
    current = redirects.get(current)!
  }
  // Invalid cycles must still collapse deterministically rather than multiply capacity.
  return visited.has(current) ? Math.min(current, ...visited) : current
}
