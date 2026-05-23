const PHONE_COUNTRY_CODE = '380'
const PHONE_DIGIT_LIMIT = 12

const getPhoneDigits = (value: string) => value.replace(/\D/g, '')

export const normalizePhoneDigits = (value: string) => {
  const digits = getPhoneDigits(value)

  if (!digits) return ''

  if (digits.startsWith(`${PHONE_COUNTRY_CODE}0`)) {
    return `${PHONE_COUNTRY_CODE}${digits.slice(4)}`.slice(0, PHONE_DIGIT_LIMIT)
  }

  if (digits.startsWith(PHONE_COUNTRY_CODE)) {
    return digits.slice(0, PHONE_DIGIT_LIMIT)
  }

  if (digits.startsWith('0')) {
    return `38${digits}`.slice(0, PHONE_DIGIT_LIMIT)
  }

  if (digits.startsWith('80')) {
    return `3${digits}`.slice(0, PHONE_DIGIT_LIMIT)
  }

  return `${PHONE_COUNTRY_CODE}${digits}`.slice(0, PHONE_DIGIT_LIMIT)
}

export const formatPhoneInput = (value: string) => {
  const digits = normalizePhoneDigits(value)

  if (!digits) return ''
  if (digits.length <= PHONE_COUNTRY_CODE.length) return `+${digits}`

  const operatorCode = digits.slice(3, 5)
  const firstPart = digits.slice(5, 8)
  const secondPart = digits.slice(8, 10)
  const thirdPart = digits.slice(10, 12)

  return [
    `+${PHONE_COUNTRY_CODE}`,
    operatorCode,
    firstPart,
    secondPart,
    thirdPart,
  ].filter(Boolean).join(' ')
}

export const isValidPhoneNumber = (value: string) =>
  /^380[1-9]\d{8}$/.test(normalizePhoneDigits(value))

export const formatPhoneForSubmit = (value: string) => {
  const digits = normalizePhoneDigits(value)

  return digits.length === PHONE_DIGIT_LIMIT ? `+${digits}` : ''
}
