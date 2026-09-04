import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import test from 'node:test'

const source = await readFile(new URL('../components/BaseFilterPanel.vue', import.meta.url), 'utf8')
const buttonTags = [...source.matchAll(/<BaseButton\b[\s\S]*?>/g)].map(match => match[0])
const appRoot = new URL('..', import.meta.url)
const migratedFilterFiles = [
  '../pages/products/index.vue',
  '../pages/brands.vue',
  '../pages/categories.vue',
  '../pages/customers/index.vue',
  '../pages/masters/index.vue',
  '../pages/services/index.vue',
  '../pages/promotions.vue',
  '../pages/messaging/templates.vue',
  '../pages/messaging/index.vue',
  '../components/messaging/SmsCampaignsPanel.vue',
  '../pages/reviews/index.vue',
  '../pages/my-bookings.vue',
  '../pages/my-time-blocks.vue',
  '../pages/bookings.vue',
  '../pages/time-blocks.vue',
  '../pages/admin/dashboards/barbershop.vue',
  '../pages/admin/statistics/index.vue',
  '../pages/blog/statistics.vue',
  '../components/statistics/MonthYearFilter.vue',
].map(path => new URL(path, import.meta.url))

test('BaseFilterPanel provides the semantic filter form contract', () => {
  assert.match(source, /<form\b/)
  assert.match(source, /@submit\.prevent="handleSubmit"/)
  assert.match(source, /data-testid="base-filter-panel"/)
  assert.match(source, /<BaseCard\b/)
  assert.match(source, /v-bind="attrs"/)
  assert.match(source, /class="base-filter-panel__card"/)
})

test('BaseFilterPanel provides correctly typed standard actions', () => {
  const submitButton = buttonTags.find(tag => /type="submit"/.test(tag))
  const clearButton = buttonTags.find(tag => /v-if="showClear"/.test(tag))
  assert.match(submitButton || '', /variant="primary"/)
  assert.match(clearButton || '', /type="button"/)
  assert.match(clearButton || '', /variant="neutral"/)
  assert.match(source, /applyLabel:\s*'Застосувати'/)
  assert.match(source, /clearLabel:\s*'Очистити'/)
  assert.match(source, /showClear:\s*true/)
})

test('BaseFilterPanel collapses to an accessible mobile modal with filter state', () => {
  assert.match(source, /activeCount\?: number/)
  assert.match(source, /mobileTriggerLabel\?: string/)
  assert.match(source, /data-testid="base-filter-trigger"/)
  assert.match(source, /:data-active="hasActiveFilters \? 'true' : 'false'"/)
  assert.match(source, /<Teleport to="body" :disabled="!mobileVisible">/)
  assert.match(source, /:role="mobileVisible \? 'dialog' : undefined"/)
  assert.match(source, /:aria-modal="mobileVisible \|\| undefined"/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(source, /base-filter-panel-in 280ms cubic-bezier/)
  assert.match(source, /base-filter-panel-out 220ms cubic-bezier/)
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.match(source, /h-\[90dvh\] max-h-\[90dvh\]/)
  assert.match(source, /mobileVisible \? 'liquid-glass relative z-10/)
  assert.match(source, /base-filter-panel__mobile-trigger--active/)
  assert.match(source, /color: var\(--bo-success-text\) !important/)
  assert.doesNotMatch(source, /!bg-cyan-50|!text-cyan-900/)
  assert.match(source, /base-filter-panel__card--mobile/)
  assert.match(source, /margin-top: auto/)
  assert.match(source, /padding-bottom: env\(safe-area-inset-bottom, 0px\)/)
})

test('BaseFilterPanel guards actions while unavailable', () => {
  assert.match(source, /loading\?: boolean/)
  assert.match(source, /disabled\?: boolean/)
  assert.match(source, /const unavailable = computed\(\(\) => props\.loading \|\| props\.disabled\)/)
  assert.match(source, /const handleSubmit = \(\) => \{\s*if \(unavailable\.value\) return\s*emit\('apply'\)/)
  assert.match(source, /const handleClear = \(\) => \{\s*if \(unavailable\.value\) return\s*emit\('clear'\)/)
  assert.match(source, /:aria-busy="loading \|\| undefined"/)
  assert.match(source, /:aria-disabled="disabled \|\| undefined"/)
  assert.match(source, /<fieldset\s+:disabled="unavailable"/)
})

test('BaseFilterPanel exposes its presentation slots and responsive layout hooks', () => {
  assert.match(source, /<slot :loading="loading" :disabled="unavailable" \/>/)
  assert.match(source, /name="actions"/)
  assert.match(source, /name="summary"/)
  assert.match(source, /name="after"/)
  assert.match(source, /rootClass\?: string/)
  assert.match(source, /cardClass\?: string/)
  assert.match(source, /layoutClass\?: string/)
  assert.match(source, /fieldsClass\?: string/)
  assert.match(source, /actionsClass\?: string/)
  assert.match(source, /:variant="variant"/)
  assert.match(source, /:padding="padding"/)
  assert.match(source, /md:grid-cols-2/)
  assert.match(source, /sm:flex-row/)
  assert.match(source, /xl:justify-end/)
})

test('BaseFilterPanel stays presentation-only', () => {
  assert.doesNotMatch(source, /useBackofficeApi|useAsyncData|useRoute|useRouter|\$fetch/)
})

test('every migrated filter uses the shared panel and approved controls', async () => {
  const violations = []

  for (const file of migratedFilterFiles) {
    const fileSource = await readFile(file, 'utf8')
    const panels = [...fileSource.matchAll(/<BaseFilterPanel\b[\s\S]*?<\/BaseFilterPanel>/g)].map(match => match[0])
    const fileName = relative(appRoot.pathname, file.pathname)

    if (!panels.length) {
      violations.push(`${fileName}: missing BaseFilterPanel`)
      continue
    }

    for (const panel of panels) {
      if (/<BaseSelect\b[^>]*\bnative\b/.test(panel) || /<select\b/.test(panel)) {
        violations.push(`${fileName}: native select in filter panel`)
      }
      if (/backoffice-modal-action-/.test(panel)) {
        violations.push(`${fileName}: legacy action class in filter panel`)
      }
      if (!/<(?:BaseInput|BaseSelect|BaseDateRange|BaseCalendar|BaseMultiSelect|MasterSelect|BaseSegmentedControl)\b/.test(panel)) {
        violations.push(`${fileName}: filter panel has no approved control`)
      }
    }
  }

  assert.deepEqual(violations, [])
})

test('the admin statistics master selector remains navigation, not an API filter', async () => {
  const adminStatisticsSource = await readFile(new URL('../pages/admin/statistics/index.vue', import.meta.url), 'utf8')

  assert.match(adminStatisticsSource, /<StatisticsMonthYearFilter/)
  assert.match(adminStatisticsSource, /<MasterSelect/)
  assert.match(adminStatisticsSource, /selectedBarberPath/)
  assert.doesNotMatch(adminStatisticsSource, /watch\(selectedBarberId/)
})
