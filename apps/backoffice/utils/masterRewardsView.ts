export const rewardMoney = (minor: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(minor / 100)
export const rewardPercent = (bps: number) => `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(bps / 100)}%`
export const rewardDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeZone: 'Europe/Kyiv' }).format(date)
}
export const rewardToday = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date())
export const rewardRange = (preset: 'week' | 'month', today = rewardToday()) => {
  const date = new Date(`${today}T12:00:00Z`)
  if (preset === 'month') date.setUTCDate(1)
  else date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return { from: date.toISOString().slice(0, 10), to: today }
}
export const parseRewardRate = (value: string): number | null => {
  const clean = value.trim().replace(',', '.')
  if (!/^(?:\d{1,3})(?:\.\d{1,2})?$/.test(clean)) return null
  const [whole, fraction = ''] = clean.split('.')
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return bps >= 0 && bps <= 10000 ? bps : null
}
