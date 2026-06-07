export type LocaleCode = 'uk' | 'en'

export const localeOptions: Array<{ code: LocaleCode, label: string, shortLabel: string }> = [
  { code: 'uk', label: '🇺🇦 Укр', shortLabel: 'UA' },
  { code: 'en', label: '🇬🇧 Eng', shortLabel: 'EN' },
]

export const blogTerms = {
  uk: {
    subscribe: 'Підписка',
  },
  en: {
    subscribe: 'Subscribe',
  },
} satisfies Record<LocaleCode, { subscribe: string }>
