const PHONE_PREFIX = '+380'
const SUBSCRIBER_DIGITS = 9
const PREFIX_DIGITS = '380'

const extractSubscriberDigits = (value: string | null | undefined) => {
  const digits = String(value || '').replace(/\D/g, '')

  if (PREFIX_DIGITS.startsWith(digits)) {
    return ''
  }

  if (digits.startsWith(PREFIX_DIGITS)) {
    const subscriberDigits = digits.slice(PREFIX_DIGITS.length, PREFIX_DIGITS.length + SUBSCRIBER_DIGITS)

    if (subscriberDigits === PREFIX_DIGITS.slice(0, 2)) {
      return ''
    }

    return subscriberDigits
  }

  if (digits.startsWith('0')) {
    return digits.slice(1, 1 + SUBSCRIBER_DIGITS)
  }

  return digits.slice(0, SUBSCRIBER_DIGITS)
}

const formatSubscriberDigits = (subscriberDigits: string) => {
  const groups = [
    subscriberDigits.slice(0, 2),
    subscriberDigits.slice(2, 5),
    subscriberDigits.slice(5, 7),
    subscriberDigits.slice(7, 9),
  ].filter(Boolean)

  return groups.length ? `${PHONE_PREFIX} ${groups.join(' ')}` : PHONE_PREFIX
}

export const useUkrainianPhoneMask = () => {
  const formatPhone = (value: string | null | undefined, showPrefix = false) => {
    const subscriberDigits = extractSubscriberDigits(value)
    if (!subscriberDigits && !showPrefix) return ''
    return formatSubscriberDigits(subscriberDigits)
  }

  const normalizePhone = (value: string | null | undefined) => {
    const subscriberDigits = extractSubscriberDigits(value)
    return subscriberDigits ? `${PHONE_PREFIX}${subscriberDigits}` : ''
  }

  const isCompletePhone = (value: string | null | undefined) =>
    extractSubscriberDigits(value).length === SUBSCRIBER_DIGITS

  return {
    formatPhone,
    normalizePhone,
    isCompletePhone,
  }
}
