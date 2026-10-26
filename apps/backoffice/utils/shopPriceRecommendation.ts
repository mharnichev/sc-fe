/** Optional whole-hryvnia ending-9 price; never increase or reduce by more than 2%. */
export const recommendShopPrice = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'number' && !Number.isFinite(value)) return null
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim())
  if (!match) return null

  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 9_999_999_999) return null
  const candidate = (Math.floor((Math.floor(cents / 100) + 1) / 10) * 10 - 1) * 100
  if (candidate <= 0 || candidate >= cents || (cents - candidate) * 100 > cents * 2) return null
  return candidate / 100
}
