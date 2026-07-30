import type { MasterDto } from '@shared-types'

type MasterNameLanguage = 'uk' | 'en'
type MasterNameField = string | null | undefined

const hasCyrillic = (value?: string | null) => Boolean(value && /[А-Яа-яЁёІіЇїЄєҐґ]/.test(value))
const hasLatin = (value?: string | null) => Boolean(value && /[A-Za-z]/.test(value))
const isCleanEnglishText = (value?: string | null) => Boolean(value && !hasCyrillic(value))
const isCleanUkrainianText = (value?: string | null) => Boolean(value && !hasLatin(value))

const cleanName = (value?: string | null) =>
  value?.trim() || ''

const localizedName = (value: MasterNameField, language: MasterNameLanguage) => {
  const name = cleanName(value)

  if (!name) return ''

  return language === 'en'
    ? isCleanEnglishText(name) ? name : ''
    : isCleanUkrainianText(name) ? name : ''
}

const firstMatchedName = (
  fields: MasterNameField[],
  format: (field: MasterNameField) => string,
) => fields.map(format).find(Boolean) || ''

export const useMasterDisplay = () => {
  const { locale } = useTerms()

  const masterNameFields = (master: MasterDto, language: MasterNameLanguage) => {
    const localizedFields = language === 'en'
      ? [master.first_name_en, master.full_name_en, master.full_name, master.first_name_uk, master.full_name_uk]
      : [master.first_name_uk, master.full_name_uk, master.full_name, master.first_name_en, master.full_name_en]

    const fallbackFields = language === 'en'
      ? [master.first_name_en, master.full_name_en, master.full_name, master.name]
      : [master.first_name_uk, master.full_name_uk, master.full_name, master.name]

    return { localizedFields, fallbackFields }
  }

  const masterName = (master?: MasterDto | null) => {
    if (!master) return ''

    const language = locale.value === 'en' ? 'en' : 'uk'
    const { localizedFields, fallbackFields } = masterNameFields(master, language)

    return firstMatchedName(localizedFields, field => localizedName(field, language))
      || firstMatchedName(fallbackFields, cleanName)
      || `Master #${master.id}`
  }

  const masterFullName = (master?: MasterDto | null) => {
    if (!master) return ''

    const language = locale.value === 'en' ? 'en' : 'uk'
    const localizedFields = language === 'en'
      ? [master.full_name_en, master.full_name, master.full_name_uk]
      : [master.full_name_uk, master.full_name, master.full_name_en]
    const localizedFullName = firstMatchedName(
      localizedFields,
      field => localizedName(field, language),
    )

    return localizedFullName
      || firstMatchedName(localizedFields, cleanName)
      || masterName(master)
  }

  return { masterFullName, masterName }
}
