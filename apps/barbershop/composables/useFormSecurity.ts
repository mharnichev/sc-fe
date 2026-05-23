export const FORM_FIELD_LIMITS = {
  name: 80,
  fullName: 120,
  email: 254,
  message: 1000,
  comment: 600,
} as const

type SanitizeOptions = {
  multiline?: boolean
}

const CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const MARKUP_DELIMITERS_PATTERN = /[<>]/g
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
}

const escapeHtml = (value: string) => value.replace(/[&<>"'`=]/g, char => HTML_ESCAPE_MAP[char] || char)

export const constrainFormInput = (
  value: string,
  maxLength: number,
  options: SanitizeOptions = {},
) => {
  const normalized = value
    .normalize('NFKC')
    .replace(CONTROL_CHARS_PATTERN, '')
    .replace(MARKUP_DELIMITERS_PATTERN, '')
  const withoutLineBreaks = options.multiline
    ? normalized.replace(/\r\n?/g, '\n')
    : normalized.replace(/[\r\n\t]+/g, ' ')
  const compacted = options.multiline
    ? withoutLineBreaks
    : withoutLineBreaks.replace(/\s{2,}/g, ' ')

  return compacted.slice(0, maxLength)
}

export const sanitizeFormText = (
  value: string,
  maxLength: number,
  options: SanitizeOptions = {},
) => escapeHtml(constrainFormInput(value, maxLength, options).trim())
