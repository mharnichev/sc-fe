import { expect, test, type Page, type Route } from '@playwright/test'

const admin = {
  id: 1, email: 'wizard@soulcuts.test', full_name: 'Wizard Admin', role: 'admin',
  master_id: null, is_active: true, is_superuser: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

const rules = { combine: 'all', conditions: [{ type: 'last_visit_age', min: 3, max: 12, unit: 'calendar_months' }], exclusions: [] }
const segments = Array.from({ length: 101 }, (_, index) => ({
  id: index + 1, name: index === 100 ? 'Особлива аудиторія' : `Сегмент ${String(index + 1).padStart(3, '0')}`,
  description: null, status: 'active', rules, revision: 1,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', archived_at: null,
}))
const master = { id: 7, first_name_uk: 'Тест', last_name_uk: 'Майстер', full_name: 'Тест Майстер', full_name_uk: 'Тест Майстер', is_active: true }
const otherMaster = { id: 8, first_name_uk: 'Інший', last_name_uk: 'Майстер', full_name: 'Інший Майстер', full_name_uk: 'Інший Майстер', is_active: true }
const promotion = { id: 9, name_uk: 'Знижка 30%', discount_percent: 30, discount_type: 'percent', recipient_offer_only: true, is_active: true }
const invalidPromotion = { id: 10, name_uk: 'Знижка 20%', discount_percent: 20, discount_type: 'percent', recipient_offer_only: true, is_active: true }
const service = { id: 11, name: 'Стрижка', title_uk: 'Стрижка', is_active: true, duration_minutes: 30, price: 500 }
const otherService = { id: 12, name: 'Борода', title_uk: 'Борода', is_active: true, duration_minutes: 20, price: 300 }
const sharedTemplate = { id: 41, name: 'Готовий шаблон', channel: 'sms', language: 'uk', body: 'Готове повідомлення {{client_name}}', variables: [], is_active: true, is_default: false }
const emptyOfferAnalytics = {
  period_basis: 'run_cohort', audience_size: 0, communication_eligible_recipients: 0,
  provider_accepted: 0, delivered: 0, raw_link_requests: 0, confirmed_page_opens: 0,
  unique_confirmed_openers: 0, bookings_created: 0, cancelled_bookings: 0, no_show: 0,
  completed_visits: 0, unique_customers_redeemed: 0, total_discount_amount: 0,
  observed_completed_revenue: 0, booking_conversion_percent: null, redemption_conversion_percent: null,
}
const pageOf = (url: URL, items: unknown[], total = items.length) => ({ items, total, page: Number(url.searchParams.get('page') || 1), page_size: Number(url.searchParams.get('page_size') || 100) })

type BackendOptions = {
  user?: typeof admin
  masters?: typeof master[]
  promotions?: typeof promotion[]
  templates?: typeof sharedTemplate[]
  existingNotifications?: Array<Record<string, unknown>>
  existingCampaign?: Record<string, unknown>
}

type Backend = {
  writes: Array<{ path: string; body: Record<string, unknown> }>
  segmentQueries: URL[]
  templateQueries: URL[]
  unexpected: string[]
  errors: string[]
  failSegmentsOnce: () => void
  failCampaignOnce: () => void
  failSegmentPageOnce: (offset: number) => void
  holdCampaignResponse: () => () => void
}

async function installBackend(page: Page, theme: 'light' | 'dark' = 'light', segmentItems = segments, options: BackendOptions = {}): Promise<Backend> {
  const user = options.user || admin
  const masterItems = options.masters || [master]
  const promotionItems = options.promotions || [promotion]
  const templateItems = options.templates || []
  await page.addInitScript(({ theme, user }) => {
    localStorage.setItem('soulcuts-backoffice-theme', theme)
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'wizard-local-only', refreshToken: 'unused', user }))
  }, { theme, user })
  const writes: Backend['writes'] = []
  const segmentQueries: URL[] = []
  const templateQueries: URL[] = []
  const unexpected: string[] = []
  const errors: string[] = []
  let segmentFailures = 0
  let campaignFailures = 0
  const segmentPageFailures = new Map<number, number>()
  let campaignResponse: Promise<void> | undefined
  page.on('pageerror', error => errors.push(`Page error: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') errors.push(`Console error: ${message.text()}`) })
  page.on('requestfailed', request => { if (request.url().includes('/api/v1/')) errors.push(`Failed API request: ${request.url()} ${request.failure()?.errorText}`) })
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api\/v1/, '')
    const method = request.method()
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', json: body })
    if (method === 'GET' && path === '/backoffice/auth/me') return json(user)
    if (method === 'GET' && path === '/public/masters') return json(masterItems)
    if (method === 'GET' && user.role === 'barber' && path === '/backoffice/masters/me/bookings') return json([])
    if (method === 'GET' && user.role === 'barber' && path === '/backoffice/masters/me/time-blocks') return json([])
    if (method === 'GET' && user.role === 'barber' && path === '/backoffice/masters/me/availability') return json([])
    if (method === 'GET' && user.role === 'barber' && path === '/backoffice/reviews/masters/me/statistics') return json({ master_id: 7, approved_average_rating: null, approved_review_count: 0, pending_review_count: 0, rating_distribution: {} })
    if (method === 'GET' && path === '/backoffice/messaging/templates') {
      templateQueries.push(url)
      const page = Number(url.searchParams.get('page') || 1)
      const size = Number(url.searchParams.get('page_size') || 100)
      return json(pageOf(url, templateItems.slice((page - 1) * size, page * size), templateItems.length))
    }
    if (method === 'GET' && path === '/backoffice/messaging/templates/71') {
      const existing = templateItems.find(item => item.id === 71)
      if (existing) return json(existing)
      const body = writes.findLast(item => item.path === '/backoffice/messaging/templates')?.body || {}
      return json({ id: 71, ...body, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' })
    }
    if (method === 'GET' && path === '/backoffice/messaging/campaigns') {
      expect(url.searchParams.get('view')).toBe('notifications')
      return json(pageOf(url, options.existingNotifications || [], options.existingNotifications?.length || 0))
    }
    if (method === 'GET' && path === '/backoffice/masters') return json(pageOf(url, url.searchParams.get('page') === '2' ? [] : masterItems, masterItems.length))
    if (method === 'GET' && path === '/backoffice/promotions') return json(pageOf(url, promotionItems))
    if (method === 'GET' && path === '/backoffice/barbers/7/services') return json([service])
    if (method === 'GET' && path === '/backoffice/barbers/8/services') return json([otherService])
    if (method === 'POST' && path === '/backoffice/messaging/audience/estimate') return json({ total: 3, eligible: 2, excluded: 1, missing_chat_id: 1, opted_out: 0 })
    if (method === 'GET' && path === '/backoffice/segments') {
      segmentQueries.push(url)
      if (segmentFailures) { segmentFailures--; return json({ detail: 'Temporary segment error' }, 503) }
      const offset = Number(url.searchParams.get('offset') || 0)
      const failures = segmentPageFailures.get(offset) || 0
      if (failures) { segmentPageFailures.set(offset, failures - 1); return json({ detail: 'Temporary segment error' }, 503) }
      const limit = Number(url.searchParams.get('limit') || 100)
      return json({ items: segmentItems.slice(offset, offset + limit), total: segmentItems.length, limit, offset })
    }
    const segmentId = /^\/backoffice\/segments\/(\d+)$/.exec(path)?.[1]
    if (method === 'GET' && segmentId) {
      const found = segmentItems.find(item => item.id === Number(segmentId))
      return found ? json(found) : json({ detail: 'Missing segment' }, 404)
    }
    if (method === 'POST' && path === '/backoffice/messaging/templates') {
      const body = request.postDataJSON() as Record<string, unknown>
      writes.push({ path, body })
      return json({ id: 71, ...body, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }, 201)
    }
    if (method === 'POST' && path === '/backoffice/messaging/campaigns') {
      const body = request.postDataJSON() as Record<string, unknown>
      writes.push({ path, body })
      if (campaignFailures) { campaignFailures--; return json({ detail: 'Temporary draft error' }, 503) }
      await campaignResponse
      return json({ id: 501, ...body, created_at: '2026-01-01T00:00:00Z' }, 201)
    }
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/501') {
      const body = writes.findLast(item => item.path === '/backoffice/messaging/campaigns' || item.path === '/backoffice/messaging/campaigns/501')?.body || options.existingCampaign || {}
      return json({ id: 501, ...body, created_at: '2026-01-01T00:00:00Z' })
    }
    if (method === 'PATCH' && path === '/backoffice/messaging/campaigns/501') {
      const body = request.postDataJSON() as Record<string, unknown>
      writes.push({ path, body })
      return json({ id: 501, ...options.existingCampaign, ...body })
    }
    if (method === 'GET' && path === '/backoffice/messaging/campaign-offer-analytics' && url.searchParams.get('campaign_id') === '501') return json(emptyOfferAnalytics)
    if (method === 'GET' && /^\/backoffice\/messaging\/campaigns\/501\/(logs|recipients|runs|readiness|offer-analytics)$/.test(path)) {
      if (path.endsWith('/readiness')) return json({ ready: false, checks: [], runtime_verification: 'unavailable', balance: { status: 'unavailable', amount: null } })
      if (path.endsWith('/offer-analytics')) return json(emptyOfferAnalytics)
      return json(pageOf(url, []))
    }
    unexpected.push(`${method} ${url.href}`)
    return json({ detail: 'Unexpected request in wizard smoke test' }, 599)
  })
  // ofetch retries a failed GET once before the component sees the error.
  return {
    writes, segmentQueries, templateQueries, unexpected, errors,
    failSegmentsOnce: () => { segmentFailures += 2 },
    failCampaignOnce: () => { campaignFailures++ },
    failSegmentPageOnce: offset => { segmentPageFailures.set(offset, 2) },
    holdCampaignResponse: () => {
      let release!: () => void
      campaignResponse = new Promise<void>(resolve => { release = resolve })
      return release
    },
  }
}

function checkBackend(backend: Backend, expectedFailure = false) {
  expect(backend.unexpected, 'Every API request must be explicitly mocked').toEqual([])
  expect(backend.errors.filter(error => !(expectedFailure && /^Console error: .*503/.test(error))), 'Browser exceptions, console errors and failed API calls must be visible').toEqual([])
  expect(backend.writes.filter(write => /\/runs|\/send|\/status/.test(write.path)), 'Saving a draft must never run or send it').toEqual([])
}

const step = (page: Page, number: number) => page.getByRole('button', { name: new RegExp(`^Крок ${number}:`) })
const campaignWrites = (backend: Backend) => backend.writes.filter(write => write.path === '/backoffice/messaging/campaigns')
const next = (page: Page) => page.getByRole('button', { name: 'Далі', exact: true })
const chooseSelectOption = async (page: Page, field: string, option: string) => {
  await page.getByRole('button', { name: new RegExp(`^${field}(?:\\s|$)`) }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
const segmentPicker = (page: Page) => page.locator('[data-testid="campaign-segment-audience"]:visible')
const audienceSource = (page: Page) => page.getByRole('button', { name: /^Джерело аудиторії/ })
const expectInlineAudienceDisabled = async (page: Page) => {
  await expect(audienceSource(page)).toContainText('Збережені сегменти')
  await audienceSource(page).click()
  await expect(page.getByRole('option', { name: 'Фільтри цієї кампанії', exact: true })).toBeDisabled()
  await audienceSource(page).click()
}
const segmentTrigger = (page: Page) => segmentPicker(page).locator('button.backoffice-select-trigger')
const segmentSearch = (page: Page) => segmentPicker(page).getByPlaceholder('Пошук сегмента', { exact: true })
const segmentOption = (page: Page, name: string) => segmentPicker(page).getByRole('checkbox', { name: new RegExp(`^${name}(?:\\s|$)`) })
const openSegments = async (page: Page) => {
  if (!await segmentSearch(page).isVisible()) await segmentTrigger(page).click()
}
const closeSegments = async (page: Page) => {
  if (await segmentSearch(page).isVisible()) await segmentTrigger(page).click()
}
const expectSelectedSegment = async (page: Page, name: string) => {
  await openSegments(page)
  await expect(segmentOption(page, name)).toBeChecked()
  await closeSegments(page)
}
const chooseSegment = async (page: Page, name: string) => {
  await openSegments(page)
  await segmentSearch(page).fill(name)
  await segmentOption(page, name).click()
  await closeSegments(page)
}
const selectOfferOption = async (page: Page, field: string, current: string, option: string) => {
  await page.getByRole('button', { name: `${field} ${current}` }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
const chooseService = async (page: Page, name: string) => {
  await page.getByTestId('campaign-services').getByRole('button', { name: 'Виберіть послуги' }).click()
  await page.getByRole('checkbox', { name: new RegExp(`^${name}`) }).click()
  await page.getByTestId('campaign-services').getByRole('button').first().click()
}
const savedPage = async (page: Page, name: string) => {
  await expect(page).toHaveURL(/\/messaging\/campaigns\/501$/)
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  await page.waitForLoadState('networkidle')
}
const chooseCalendarToday = async (page: Page, label: string, time: string) => {
  const input = page.getByRole('textbox', { name: label, exact: true })
  await input.click()
  const dialog = page.getByRole('dialog', { name: label, exact: true })
  await dialog.getByRole('button', { name: 'Сьогодні' }).click()
  await dialog.getByLabel('Час').fill(time)
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue(new RegExp(`T${time}$`))
  return input
}
const chooseCalendarNextMonth = async (page: Page, label: string, time: string) => {
  const input = page.getByRole('textbox', { name: label, exact: true })
  await input.click()
  const dialog = page.getByRole('dialog', { name: label, exact: true })
  await dialog.getByRole('button', { name: 'Наступний місяць' }).click()
  await dialog.getByRole('button', { name: '15', exact: true }).click()
  await dialog.getByLabel('Час').fill(time)
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue(new RegExp(`-15T${time}$`))
  return input
}

test('channel round trips preserve the audience and text and never allow zero channels', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Зміна каналів')
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Незмінний текст {{client_name}}')
  await step(page, 1).click()
  const telegram = page.getByRole('checkbox', { name: 'Telegram', exact: true })
  const sms = page.getByRole('checkbox', { name: 'SMS', exact: true })
  await expect(telegram).toBeDisabled()
  await sms.check()
  await telegram.uncheck()
  await expect(sms).toBeDisabled()
  await telegram.check()
  await sms.uncheck()
  await expect(telegram).toBeDisabled()
  await step(page, 2).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await step(page, 3).click()
  await expect(page.getByRole('textbox', { name: /^Текст/ })).toHaveValue('Незмінний текст {{client_name}}')
  await step(page, 6).click()
  expect(backend.writes).toEqual([])
  await page.getByRole('button', { name: 'Створити кампанію', exact: true }).click()
  await savedPage(page, 'Зміна каналів')
  expect(campaignWrites(backend)).toHaveLength(1)
  expect(campaignWrites(backend)[0]!.body).toMatchObject({ channel: 'telegram', channel_strategy: 'single', segment_ids: [101], status: 'draft', metadata_json: { message_body: 'Незмінний текст {{client_name}}' } })
  checkBackend(backend)
})

test('a failed second segment page retains the first page and retry restores the missing selection', async ({ page }) => {
  const backend = await installBackend(page)
  backend.failSegmentPageOnce(100)
  await page.goto('/messaging/campaigns/new')
  await step(page, 2).click()
  await expect(page.getByRole('alert')).toContainText('Temporary segment error')
  await chooseSegment(page, 'Сегмент 001')
  await expect(segmentTrigger(page)).toContainText('1/20 вибрано')
  await page.getByRole('button', { name: 'Повторити', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await chooseSegment(page, 'Особлива аудиторія')
  await expect(segmentTrigger(page)).toContainText('2/20 вибрано')
  await expectSelectedSegment(page, 'Сегмент 001')
  expect(backend.segmentQueries.filter(url => url.searchParams.get('offset') === '100')).toHaveLength(3)
  expect(backend.writes).toEqual([])
  checkBackend(backend, true)
})

test('shared template identity survives campaign retry and pending double clicks create one draft', async ({ page }) => {
  const backend = await installBackend(page, 'light', segments, { templates: [sharedTemplate] })
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Повторна спроба')
  await page.getByText('Повернення неактивних клієнтів', { exact: true }).click()
  await page.getByRole('checkbox', { name: 'SMS', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Telegram', exact: true }).uncheck()
  await step(page, 2).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await step(page, 3).click()
  await chooseSelectOption(page, 'Шаблон', sharedTemplate.name)
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Власний текст {{client_name}}')
  await step(page, 6).click()
  backend.failCampaignOnce()
  const save = page.getByRole('button', { name: 'Створити кампанію', exact: true })
  await save.click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await expect(save).toBeEnabled()
  const release = backend.holdCampaignResponse()
  try {
    await save.evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click() })
    await expect.poll(() => campaignWrites(backend).length).toBe(2)
    await expect(page.getByRole('button', { name: 'Завантаження', exact: true })).toBeDisabled()
    expect(backend.writes.filter(write => write.path.endsWith('/templates'))).toHaveLength(0)
    expect(campaignWrites(backend).map(write => write.body)).toEqual([campaignWrites(backend)[0]!.body, campaignWrites(backend)[0]!.body])
  } finally { release() }
  await savedPage(page, 'Повторна спроба')
  expect(campaignWrites(backend)).toHaveLength(2)
  expect(campaignWrites(backend)[1]!.body).toMatchObject({ template_id: 41, status: 'draft', metadata_json: { message_body: 'Власний текст {{client_name}}' } })
  checkBackend(backend, true)
})

test('backend-shaped templates filter by active channel and channel changes reset identity but not text', async ({ page }) => {
  const telegramTemplate = { ...sharedTemplate, id: 42, name: 'Telegram шаблон', channel: 'telegram' }
  const inactiveTemplate = { ...sharedTemplate, id: 43, name: 'Архівний SMS шаблон', is_active: false }
  const backend = await installBackend(page, 'light', segments, { templates: [sharedTemplate, telegramTemplate, inactiveTemplate] })
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Перехід шаблону')
  await page.getByText('Повернення неактивних клієнтів', { exact: true }).click()
  await page.getByRole('checkbox', { name: 'SMS', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Telegram', exact: true }).uncheck()
  await step(page, 2).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await step(page, 3).click()
  await page.getByRole('button', { name: /^Шаблон(?:\s|$)/ }).click()
  await expect(page.getByRole('option', { name: telegramTemplate.name, exact: true })).toHaveCount(0)
  await expect(page.getByRole('option', { name: inactiveTemplate.name, exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: sharedTemplate.name, exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Текст/ })).toHaveValue(sharedTemplate.body)
  await step(page, 1).click()
  await expect(page.getByRole('radio', { name: /Повернення неактивних клієнтів/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'SMS', exact: true })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Telegram', exact: true }).check()
  await page.getByRole('checkbox', { name: 'SMS', exact: true }).uncheck()
  await step(page, 3).click()
  await expect(page.getByRole('button', { name: /^Шаблон(?:\s|$)/ })).toContainText('Кастомне повідомлення')
  await expect(page.getByRole('textbox', { name: /^Текст/ })).toHaveValue(sharedTemplate.body)
  await step(page, 6).click()
  await page.getByRole('button', { name: 'Створити кампанію', exact: true }).click()
  await savedPage(page, 'Перехід шаблону')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({ type: 're_engagement', channel: 'telegram', template_id: 71, status: 'draft', metadata_json: { message_body: sharedTemplate.body } })
  expect(backend.writes.filter(write => write.path.endsWith('/templates'))).toHaveLength(1)
  checkBackend(backend)
})

async function openCampaignDetails(page: Page) {
  const summary = page.locator('summary').filter({ hasText: 'Умови та повідомлення' })
  const details = page.locator('details').filter({ has: summary })
  await expect(summary).toBeVisible()
  if (await details.getAttribute('open') === null) await summary.click()
  await expect(details).toHaveJSProperty('open', true)
}

test('editing only an offer name reuses a backend-shaped template for re-engagement', async ({ page }) => {
  const template = { ...sharedTemplate, id: 71, body: 'До {{master_name}}: {{offer_link}}' }
  const campaign = {
    id: 501, name: 'Збережена пропозиція', type: 're_engagement', status: 'draft',
    channel: 'sms', channel_strategy: 'single', offer_audience_mode: 'segments',
    template_id: 71, segment_ids: [101], offer_master_id: 7, offer_promotion_id: 9,
    offer_service_ids: [11], master_name_for_message: 'Майстра', purpose: 'marketing', recipient: 'customer',
    metadata_json: { offer_audience_mode: 'segments' },
  }
  const backend = await installBackend(page, 'light', segments, { templates: [template], existingCampaign: campaign })
  await page.goto('/messaging/campaigns/501')
  await openCampaignDetails(page)
  await expect(page.getByTestId('campaign-view')).toBeVisible()
  await page.getByRole('button', { name: 'Редагувати', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Текст повідомлення', exact: true })).toHaveValue(template.body)
  await page.getByRole('textbox', { name: 'Назва', exact: true }).fill('Змінена назва пропозиції')
  const save = page.getByRole('button', { name: 'Зберегти зміни', exact: true })
  await expect(save).toBeEnabled()
  await save.click()
  await openCampaignDetails(page)
  await expect(page.getByTestId('campaign-view')).toBeVisible()
  expect(backend.writes).toHaveLength(1)
  expect(backend.writes[0]).toMatchObject({ path: '/backoffice/messaging/campaigns/501', body: { name: 'Змінена назва пропозиції', type: 're_engagement', template_id: 71, status: 'draft' } })
  checkBackend(backend)
})

test('backend templates cannot turn a booking notification into a manual campaign', async ({ page }) => {
  const notificationTemplate = { ...sharedTemplate, body: 'Запис: {manage_url} {cancel_url}' }
  const telegramTemplate = { ...sharedTemplate, id: 42, name: 'Telegram шаблон', channel: 'telegram' }
  const inactiveTemplate = { ...sharedTemplate, id: 43, name: 'Архівний SMS шаблон', is_active: false }
  const backend = await installBackend(page, 'light', segments, { templates: [notificationTemplate, telegramTemplate, inactiveTemplate] })
  await page.goto('/messaging/campaigns/new?kind=notifications')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Шаблон сповіщення')
  await step(page, 3).click()
  await page.getByRole('button', { name: /^Шаблон(?:\s|$)/ }).click()
  await expect(page.getByRole('option', { name: telegramTemplate.name, exact: true })).toHaveCount(0)
  await expect(page.getByRole('option', { name: inactiveTemplate.name, exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: notificationTemplate.name, exact: true }).click()
  await expect(next(page)).toBeEnabled()
  await step(page, 1).click()
  await expect(page.getByRole('radio', { name: /Підтвердження запису/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'SMS', exact: true })).toBeChecked()
  await step(page, 6).click()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await savedPage(page, 'Шаблон сповіщення')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({ type: 'booking_confirmation', channel: 'sms', template_id: 41, status: 'draft', purpose: 'transactional', metadata_json: { message_body: notificationTemplate.body } })
  expect(backend.writes.filter(write => write.path.endsWith('/templates'))).toHaveLength(0)
  checkBackend(backend)
})

test('personal offer toggles preserve separate text, channel and policy state without writes', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?segment_id=101')
  const offer = page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true })
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Загальна кампанія')
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Загальний текст')
  await step(page, 1).click()
  await offer.check()
  await page.getByRole('textbox', { name: 'Назва', exact: true }).fill('Персональна кампанія')
  await page.getByRole('checkbox', { name: 'Telegram', exact: true }).check()
  await step(page, 2).click()
  await page.getByRole('spinbutton', { name: 'Мінімум днів між маркетинговими контактами' }).fill('23')
  await step(page, 3).click()
  await page.getByRole('textbox', { name: 'Текст повідомлення', exact: true }).fill('{{discount_percent}} {{promotion_name_uk}} {{offer_link}}')
  await page.getByRole('textbox', { name: /Ім’я у повідомленні/ }).fill('Майстра')
  await step(page, 1).click()
  await offer.uncheck()
  await expect(page.getByRole('textbox', { name: 'Назва кампанії' })).toHaveValue('Загальна кампанія')
  await expect(page.getByRole('checkbox', { name: 'SMS', exact: true })).not.toBeChecked()
  await step(page, 3).click()
  await expect(page.getByRole('textbox', { name: /^Текст/ })).toHaveValue('Загальний текст')
  await step(page, 1).click()
  await offer.check()
  await expect(page.getByRole('checkbox', { name: 'SMS', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Telegram', exact: true })).toBeChecked()
  await step(page, 2).click()
  await expect(page.getByRole('spinbutton', { name: 'Мінімум днів між маркетинговими контактами' })).toHaveValue('23')
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await step(page, 3).click()
  await expect(page.getByRole('textbox', { name: 'Текст повідомлення', exact: true })).toHaveValue('{{discount_percent}} {{promotion_name_uk}} {{offer_link}}')
  await expect(next(page)).toBeEnabled()
  expect(backend.writes).toEqual([])
  checkBackend(backend)
})

test('broadcast starts with segments, searches all pages and saves a segment draft', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new')
  await expect(page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true })).not.toBeChecked()
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Осіння розсилка')
  await step(page, 2).click()
  await expect(audienceSource(page)).toContainText('Збережені сегменти')
  await expect.poll(() => backend.segmentQueries.some(url => url.searchParams.get('offset') === '100')).toBe(true)
  expect(backend.segmentQueries.every(url => url.searchParams.get('status') === 'active' && url.searchParams.get('limit') === '100')).toBe(true)
  await openSegments(page)
  await segmentSearch(page).fill('Особлива')
  await expect(segmentOption(page, 'Особлива аудиторія')).toBeVisible()
  await expect(segmentOption(page, 'Сегмент 001')).toHaveCount(0)
  await segmentOption(page, 'Особлива аудиторія').click()
  await closeSegments(page)
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Привіт, це осіння пропозиція.')
  await step(page, 6).click()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Осіння розсилка')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({ name: 'Осіння розсилка', type: 'manual', status: 'draft', segment_ids: [101], channel_strategy: 'single' })
  expect(backend.writes.filter(write => write.path.endsWith('/templates'))).toHaveLength(1)
  checkBackend(backend)
})

test('segment field tooltip click preserves selection and audience mode without opening the picker', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await expect(page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true })).not.toBeChecked()
  await step(page, 2).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  const audienceMode = audienceSource(page)
  const help = segmentPicker(page).getByRole('button', { name: 'Пояснення: Збережені сегменти', exact: true })
  await expect(audienceMode).toContainText('Збережені сегменти')
  await expect(audienceMode).toHaveAttribute('aria-expanded', 'false')
  await help.click()
  await expect(page.getByRole('tooltip')).toContainText('кожен клієнт потрапляє в аудиторію один раз')
  await expect(help).toHaveAttribute('aria-expanded', 'true')
  await expect(segmentTrigger(page)).toContainText('1/20 вибрано')
  await expect(segmentSearch(page)).toHaveCount(0)
  await expect(audienceMode).toContainText('Збережені сегменти')
  await expect(audienceMode).toHaveAttribute('aria-expanded', 'false')
  await help.click()
  await expect(help).toHaveAttribute('aria-expanded', 'false')
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await step(page, 1).click()
  await expect(page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true })).not.toBeChecked()
  expect(campaignWrites(backend)).toHaveLength(0)
  checkBackend(backend)
})

test('optional personal offer keeps draft state and legacy URL becomes canonical', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?kind=new-master&segment_id=101')
  await expect(page).toHaveURL('/messaging/campaigns/new?segment_id=101')
  await expect(page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true })).toBeChecked()
  await page.getByRole('textbox', { name: 'Назва' }).fill('Окрема акція')
  await step(page, 2).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await step(page, 1).click()
  await page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true }).uncheck()
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Окрема розсилка')
  await step(page, 2).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await step(page, 1).click()
  await page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true }).check()
  await expect(page.getByRole('textbox', { name: 'Назва' })).toHaveValue('Окрема акція')
  await step(page, 2).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  checkBackend(backend)
})

test('both selected channels create one Telegram-first fallback campaign', async ({ page }, testInfo) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await expect(page.getByText('Новий майстер · акція 30%', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Назва кампанії' })).toHaveValue('')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Кампанія з резервним SMS')
  await page.getByRole('checkbox', { name: 'SMS', exact: true }).check()
  await expect(page.getByRole('checkbox', { name: 'Telegram', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'SMS', exact: true })).toBeChecked()
  await expect(page.getByTestId('campaign-navigation')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await page.screenshot({ path: testInfo.outputPath('campaign-constructor.png'), fullPage: true, animations: 'disabled' })
  await step(page, 2).click()
  await expectInlineAudienceDisabled(page)
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Повідомлення {{client_name}}')
  await step(page, 6).click()
  await page.getByRole('button', { name: 'Створити кампанію', exact: true }).click()
  await savedPage(page, 'Кампанія з резервним SMS')
  expect(campaignWrites(backend)).toHaveLength(1)
  expect(campaignWrites(backend)[0]!.body).toMatchObject({ channel: 'telegram', channel_strategy: 'telegram_then_sms', status: 'draft' })
  expect(backend.writes.every(write => !write.path.endsWith('/runs'))).toBe(true)
  checkBackend(backend)
})

test('new master saves only a typed offer draft after all six steps', async ({ page }, testInfo) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true }).check()
  await page.getByRole('textbox', { name: 'Назва' }).fill('Новий майстер жовтень')
  await step(page, 2).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await step(page, 3).click()
  await expect(page.getByRole('textbox', { name: 'Текст повідомлення' })).toHaveValue('')
  await page.getByRole('textbox', { name: 'Текст повідомлення' }).fill('До {{master_name}}: {{offer_link}}')
  await page.getByRole('textbox', { name: /Ім’я у повідомленні/ }).fill('Тестового Майстра')
  await step(page, 4).click()
  await page.getByRole('button', { name: 'Майстер Оберіть майстра' }).click()
  await page.getByRole('option', { name: 'Тест Майстер' }).click()
  await page.getByRole('button', { name: 'Акція Оберіть акцію' }).click()
  await page.getByRole('option', { name: 'Знижка 30%' }).click()
  await chooseService(page, 'Стрижка')
  await step(page, 5).click()
  await step(page, 6).click()
  await expect(page.getByText('Тестового Майстра', { exact: false }).first()).toBeVisible()
  expect(backend.writes).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('campaign-final-review.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Новий майстер жовтень')
  expect(campaignWrites(backend)[0]!.body).toEqual({
    name: 'Новий майстер жовтень', type: 'manual', status: 'draft', channel: 'sms',
    channel_strategy: 'single', offer_audience_mode: 'segments', purpose: 'marketing', recipient: 'customer', timezone: 'Europe/Kyiv',
    template_id: 71, segment_ids: [101], offer_master_id: 7, offer_promotion_id: 9,
    offer_service_ids: [11], master_name_for_message: 'Тестового Майстра',
    sending_window: { start: '10:00', end: '18:00', days: [0, 1, 2, 3, 4, 5, 6] },
    sms_recipients_per_minute: 20, marketing_frequency_days: 7, marketing_max_contacts: 1,
    marketing_cap_days: 7, exclude_upcoming_booking: true, exclude_returned_since_snapshot: true,
    offer_starts_at: null, offer_expires_at: null,
  })
  await openCampaignDetails(page)
  await expect(page.getByTestId('campaign-view')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Назва', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('campaign-readonly.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Редагувати', exact: true }).click()
  await expect(page.getByTestId('new-master-review')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Назва', exact: true }).fill('Незбережена зміна')
  await page.getByRole('button', { name: 'Скасувати редагування' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Скасувати зміни', exact: true }).click()
  await openCampaignDetails(page)
  await expect(page.getByTestId('campaign-view')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Новий майстер жовтень', exact: true })).toBeVisible()
  expect(campaignWrites(backend)).toHaveLength(1)
  expect(backend.writes.filter(write => write.path.endsWith('/templates'))).toHaveLength(1)
  checkBackend(backend)
})

test('empty and failed segment catalogs show recovery without creating a draft', async ({ page }) => {
  const backend = await installBackend(page, 'light', [])
  backend.failSegmentsOnce()
  await page.goto('/messaging/campaigns/new')
  await step(page, 2).click()
  await expect(page.getByRole('alert')).toContainText('Temporary segment error')
  await page.getByRole('button', { name: 'Повторити' }).click()
  await expect(page.getByText('Активних сегментів немає.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Далі' })).toBeDisabled()
  expect(campaignWrites(backend)).toHaveLength(0)
  checkBackend(backend, true)
})

test('new master gates name, segment count, frequency and message template before step four', async ({ page }) => {
  test.setTimeout(60_000)
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true }).check()
  const name = page.getByRole('textbox', { name: 'Назва', exact: true })
  await name.fill('')
  await expect(next(page)).toBeDisabled()
  await name.fill('Валідація майстра')
  await page.getByRole('checkbox', { name: 'Telegram', exact: true }).check()
  await expect(next(page)).toBeEnabled()
  await next(page).click()

  await page.getByRole('button', { name: 'Прибрати сегмент Особлива аудиторія' }).click()
  await expect(next(page)).toBeDisabled()
  await chooseSegment(page, 'Особлива аудиторія')
  const frequency = page.getByRole('spinbutton', { name: 'Мінімум днів між маркетинговими контактами' })
  for (const invalid of ['', '0', '366', '1.5']) {
    await frequency.fill(invalid)
    await expect(next(page)).toBeDisabled()
  }
  await frequency.fill('14')
  await openSegments(page)
  for (let id = 1; id <= 19; id++) {
    const name = `Сегмент ${String(id).padStart(3, '0')}`
    await segmentSearch(page).fill(name)
    await segmentOption(page, name).click()
  }
  await expect(segmentTrigger(page)).toContainText('20/20 вибрано')
  await segmentSearch(page).fill('Сегмент 020')
  await expect(segmentOption(page, 'Сегмент 020')).toBeDisabled()
  await closeSegments(page)
  await page.getByRole('button', { name: 'Прибрати сегмент Сегмент 001' }).click()
  await openSegments(page)
  await segmentSearch(page).fill('Сегмент 020')
  await expect(segmentOption(page, 'Сегмент 020')).toBeEnabled()
  await closeSegments(page)
  await expect(next(page)).toBeEnabled()
  await next(page).click()

  const messageName = page.getByRole('textbox', { name: /Ім’я у повідомленні/ })
  const template = page.getByRole('textbox', { name: 'Текст повідомлення' })
  await expect(next(page)).toBeDisabled()
  await messageName.fill('Майстра')
  await template.fill('')
  await expect(next(page)).toBeDisabled()
  for (const invalid of ['Привіт {{unknown}}', 'Привіт {{master_name}', 'Привіт 😀']) {
    await template.fill(invalid)
    await expect(next(page)).toBeDisabled()
  }
  await template.fill('Привіт {{master_name}}. Запис: {{offer_link}}')
  await expect(next(page)).toBeEnabled()
  expect(campaignWrites(backend)).toHaveLength(0)
  checkBackend(backend)
})

test('new master validates offer dates and send policy, then retries a failed draft without sending', async ({ page }) => {
  test.setTimeout(60_000)
  const backend = await installBackend(page, 'light', segments, { masters: [master, otherMaster], promotions: [promotion, invalidPromotion] })
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true }).check()
  await page.getByRole('textbox', { name: 'Назва', exact: true }).fill('Акція з правилами')
  await page.getByRole('checkbox', { name: 'Telegram', exact: true }).check()
  await next(page).click()
  await page.getByRole('spinbutton', { name: 'Мінімум днів між маркетинговими контактами' }).fill('14')
  await next(page).click()
  await page.getByRole('textbox', { name: /Ім’я у повідомленні/ }).fill('Іншого Майстра')
  await page.getByRole('textbox', { name: 'Текст повідомлення' }).fill('До {{master_name}}: {{offer_link}}')
  await next(page).click()

  await page.getByRole('button', { name: 'Акція Оберіть акцію' }).click()
  await expect(page.getByRole('option', { name: 'Знижка 20%' })).toBeVisible()
  await page.getByRole('option', { name: 'Знижка 20%' }).click()
  await selectOfferOption(page, 'Майстер', 'Оберіть майстра', 'Тест Майстер')
  await chooseService(page, 'Стрижка')
  await selectOfferOption(page, 'Майстер', 'Тест Майстер', 'Інший Майстер')
  await expect(page.getByRole('checkbox', { name: 'Стрижка' })).toHaveCount(0)
  await expect(next(page)).toBeDisabled()
  await chooseService(page, 'Борода')
  const startLabel = 'Початок пропозиції · Europe/Kyiv'
  const endLabel = 'Кінець пропозиції · Europe/Kyiv'
  const start = await chooseCalendarToday(page, startLabel, '12:00')
  const end = await chooseCalendarToday(page, endLabel, '11:00')
  await expect(next(page)).toBeDisabled()
  await end.click()
  await page.getByRole('dialog', { name: endLabel }).getByLabel('Час').fill('17:00')
  await page.keyboard.press('Escape')
  await expect(next(page)).toBeEnabled()
  await start.click()
  await page.getByRole('dialog', { name: startLabel }).getByRole('button', { name: 'Очистити' }).click()
  await expect(start).toHaveValue('')
  await expect(next(page)).toBeEnabled()
  await chooseCalendarToday(page, startLabel, '12:00')
  await next(page).click()

  const rate = page.getByRole('spinbutton', { name: 'SMS за хвилину' })
  for (const invalid of ['', '0', '481']) { await rate.fill(invalid); await expect(next(page)).toBeDisabled() }
  await rate.fill('30')
  const cap = page.getByRole('spinbutton', { name: 'Максимум контактів' })
  for (const invalid of ['', '0', '101']) { await cap.fill(invalid); await expect(next(page)).toBeDisabled() }
  await cap.fill('2')
  const period = page.getByRole('spinbutton', { name: 'За період, днів' })
  for (const invalid of ['', '0', '366']) { await period.fill(invalid); await expect(next(page)).toBeDisabled() }
  await period.fill('10')
  const windowStart = page.getByRole('textbox', { name: 'Початок відправки' })
  const windowEnd = page.getByRole('textbox', { name: 'Кінець відправки' })
  await windowStart.fill('09:00')
  await expect(next(page)).toBeDisabled()
  await windowStart.fill('11:00')
  await windowEnd.fill('19:00')
  await expect(next(page)).toBeDisabled()
  await windowEnd.fill('17:00')
  for (const day of ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']) await page.getByRole('checkbox', { name: day, exact: true }).uncheck()
  await expect(next(page)).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Пн', exact: true }).check()
  await expect(next(page)).toBeEnabled()
  await next(page).click()
  await expect(page.getByRole('heading', { name: 'Перевірка кампанії' })).toBeVisible()
  await expect(page.getByText('Інший Майстер', { exact: false }).last()).toBeVisible()
  await expect(page.getByText('11:00–17:00', { exact: false })).toBeVisible()

  backend.failCampaignOnce()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect(page.getByRole('alert')).toContainText('Temporary draft error')
  await expect(page).toHaveURL(/\/messaging\/campaigns\/new/)
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(2)
  await savedPage(page, 'Акція з правилами')
  const body = campaignWrites(backend)[1]!.body
  expect(body).toMatchObject({
    name: 'Акція з правилами', status: 'draft', type: 'manual', channel: 'telegram',
    channel_strategy: 'telegram_then_sms', segment_ids: [101], offer_master_id: 8,
    offer_audience_mode: 'segments', offer_promotion_id: 10, offer_service_ids: [12], master_name_for_message: 'Іншого Майстра',
    sending_window: { start: '11:00', end: '17:00', days: [0] }, sms_recipients_per_minute: 30,
    marketing_frequency_days: 14, marketing_max_contacts: 2, marketing_cap_days: 10,
  })
  expect(body.offer_starts_at).toEqual(expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000Z$/))
  expect(body.offer_expires_at).toEqual(expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000Z$/))
  expect(Date.parse(String(body.offer_starts_at))).toBeLessThan(Date.parse(String(body.offer_expires_at)))
  expect(backend.writes.filter(write => write.path.endsWith('/templates'))).toHaveLength(1)
  checkBackend(backend, true)
})

test('broadcast retains every configured step in the draft payload after review', async ({ page }) => {
  test.setTimeout(60_000)
  const fillerTemplates = Array.from({ length: 100 }, (_, index) => ({ ...sharedTemplate, id: 1000 + index, name: `Шаблон ${index + 1}` }))
  const backend = await installBackend(page, 'light', segments, { templates: [...fillerTemplates, sharedTemplate] })
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Повна розсилка')
  await page.getByText('Повернення неактивних клієнтів', { exact: true }).click()
  await expect(page.getByRole('radio', { name: /Повернення неактивних клієнтів/ })).toBeChecked()
  await page.getByRole('checkbox', { name: 'SMS', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Telegram', exact: true }).uncheck()
  await expect(page.getByRole('checkbox', { name: 'SMS', exact: true })).toBeChecked()
  await next(page).click()
  await expectSelectedSegment(page, 'Особлива аудиторія')
  await expectInlineAudienceDisabled(page)
  await expect(page.getByText(/Для SMS виберіть збережений сегмент/)).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Стратегія каналів' })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Виключити клієнтів із майбутніми бронюваннями' }).uncheck()
  await page.getByRole('checkbox', { name: 'Виключити клієнтів, які повернулися після фіксації аудиторії' }).uncheck()
  const frequency = page.getByRole('spinbutton', { name: 'Мінімум днів між маркетинговими повідомленнями' })
  await frequency.fill('0')
  await expect(next(page)).toBeDisabled()
  await frequency.fill('12')
  await next(page).click()
  await chooseSelectOption(page, 'Шаблон', sharedTemplate.name)
  expect(backend.templateQueries.some(url => url.searchParams.get('page') === '2')).toBe(true)
  await expect(page.getByRole('textbox', { name: /^Текст/ })).toHaveValue(sharedTemplate.body)
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Оновлений текст {{client_name}}')
  await expect(page.getByRole('textbox', { name: 'Українська версія' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'English version' })).toHaveCount(0)
  await next(page).click()
  await chooseSelectOption(page, 'Платформа відгуку', 'Instagram')
  await page.getByRole('textbox', { name: 'Посилання' }).fill('https://example.test/review')
  await page.getByRole('textbox', { name: 'Промокод' }).fill('SOUL12')
  await expect(page.getByRole('textbox', { name: 'Текст кнопки Telegram' })).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: 'Follow-up через N днів' })).toHaveCount(0)
  await next(page).click()
  await page.getByRole('radio', { name: 'Запланувати' }).check()
  await expect(next(page)).toBeDisabled()
  const scheduled = await chooseCalendarNextMonth(page, 'Дата і час', '16:30')
  await expect(scheduled).toHaveValue(/T16:30$/)
  await chooseSelectOption(page, 'Часовий пояс', 'Варшава · Europe/Warsaw')
  const rate = page.getByRole('spinbutton', { name: 'Макс. повідомлень за хвилину' })
  for (const invalid of ['', '0', '481']) { await rate.fill(invalid); await expect(next(page)).toBeDisabled() }
  await rate.fill('50')
  await expect(page.getByRole('spinbutton', { name: 'Не дублювати протягом днів' })).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'Не надсилати вночі' })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Автоматично' })).toHaveCount(0)
  await next(page).click()
  await expect(page.getByRole('heading', { name: 'Фінальна перевірка' })).toBeVisible()
  await expect(page.getByText('Повна розсилка', { exact: true })).toBeVisible()
  await expect(page.getByText('later', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Повна розсилка')
  const body = campaignWrites(backend)[0]!.body
  expect(body).toMatchObject({
    name: 'Повна розсилка', type: 're_engagement', channel: 'sms', status: 'draft',
    template_id: 41, segment_ids: [101], channel_strategy: 'single',
    exclude_upcoming_booking: false, exclude_returned_since_snapshot: false,
    marketing_frequency_days: 12, review_platform: 'instagram', review_url: 'https://example.test/review',
    discount_code: 'SOUL12', timezone: 'Europe/Warsaw', sms_recipients_per_minute: 50,
    metadata_json: {
      message_body: 'Оновлений текст {{client_name}}', schedule_mode: 'later', max_messages_per_minute: 50,
    },
  })
  expect(body.scheduled_at).toEqual(expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000Z$/))
  const warsawTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(String(body.scheduled_at)))
  expect(warsawTime).toBe('16:30')
  expect(backend.writes.filter(write => write.path.endsWith('/templates'))).toHaveLength(0)
  checkBackend(backend)
})

test('inline audience gates incomplete master, service, date and inactive rules before saving', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Фільтрована розсилка')
  await next(page).click()
  await audienceSource(page).click()
  await page.getByRole('option', { name: 'Фільтри цієї кампанії', exact: true }).click()
  await expect(audienceSource(page)).toContainText('Фільтри цієї кампанії')
  await page.getByText('Клієнти майстра', { exact: true }).click()
  await expect(next(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Оберіть майстра' }).click()
  await page.getByRole('option', { name: 'Тест Майстер' }).click()
  await expect(next(page)).toBeEnabled()
  await page.getByText('Візити за період', { exact: true }).click()
  await expect(next(page)).toBeDisabled()
  await page.getByRole('textbox', { name: 'Дата від' }).click()
  await page.getByRole('dialog', { name: 'Дата від', exact: true }).getByRole('button', { name: 'Сьогодні' }).click()
  await expect(next(page)).toBeEnabled()
  await page.getByText('Неактивні клієнти', { exact: true }).click()
  await expect(next(page)).toBeDisabled()
  const inactiveDays = page.getByRole('spinbutton', { name: 'Днів без візиту' })
  for (const invalid of ['', '0', '-1', '1.5', '3651']) {
    await inactiveDays.fill(invalid)
    await expect(next(page), `Inactive days ${JSON.stringify(invalid)} must not become a valid default`).toBeDisabled()
    expect(backend.writes).toEqual([])
  }
  await inactiveDays.fill('90')
  await expect(next(page)).toBeEnabled()
  await page.getByText('Використали послугу', { exact: true }).click()
  await expect(next(page)).toBeDisabled()
  await chooseSelectOption(page, 'Послуга', `${service.name} #${service.id} · ${master.full_name}`)
  await expect(next(page)).toBeEnabled()
  await next(page).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Запрошення після стрижки.')
  await step(page, 6).click()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Фільтрована розсилка')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({
    name: 'Фільтрована розсилка', status: 'draft', segment_ids: [], audience: { service_ids: [11] },
    metadata_json: { audience_rules: [{ type: 'selected_service', service_id: 11 }] },
  })
  checkBackend(backend)
})

test('booking notification requires SMS variables and saves an event-driven draft through six steps', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?kind=notifications')
  await expect(page.getByRole('heading', { name: 'Нове сповіщення' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Подієве SMS')
  await page.getByRole('radio', { name: /Підтвердження запису/ }).check()
  await expect(page.getByRole('radio', { name: 'SMS', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: /^Telegram/ })).toBeDisabled()
  await next(page).click()
  await expect(page.getByText(/Сповіщення створюються за подіями/)).toBeVisible()
  await expect(audienceSource(page)).toHaveCount(0)
  await next(page).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Ваш запис підтверджено')
  await expect(page.getByText(/Не вистачає змінних:/)).toContainText('{manage_url}')
  await expect(next(page)).toBeDisabled()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Ваш запис: {manage_url} {cancel_url}')
  await expect(next(page)).toBeEnabled()
  await next(page).click()
  await expect(page.getByRole('heading', { name: 'Посилання та промокод', exact: true })).toBeVisible()
  await next(page).click()
  await expect(page.getByRole('heading', { name: 'Розклад та правила' })).toBeVisible()
  await expect(page.getByText(/Сповіщення надсилається автоматично/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Запланувати' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Після завершення візиту' })).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'Не надсилати вночі' })).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: 'Макс. повідомлень за хвилину' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Часовий пояс/ })).toHaveCount(0)
  await next(page).click()
  await expect(page.getByRole('button', { name: 'Активувати кампанію' })).toBeEnabled()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Подієве SMS')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({
    name: 'Подієве SMS', type: 'booking_confirmation', purpose: 'transactional', channel: 'sms',
    recipient: 'customer', location_key: 'sms_booking_confirmation', status: 'draft', segment_ids: [],
    metadata_json: { message_body: 'Ваш запис: {manage_url} {cancel_url}', schedule_mode: 'automated' },
  })
  checkBackend(backend)
})

test('review notification saves its chosen channel and quiet hours without a delay override', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?kind=notifications')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Запит відгуку')
  await page.getByText('Запит відгуку після візиту', { exact: true }).click()
  await expect(page.getByRole('radio', { name: /Запит відгуку після візиту/ })).toBeChecked()
  await page.getByRole('radio', { name: 'SMS', exact: true }).check()
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Дякуємо, {{client_name}}: {{review_link}}')
  await step(page, 4).click()
  await expect(page.getByRole('combobox', { name: 'Платформа відгуку' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Посилання' })).toHaveCount(0)
  await expect(page.getByText(/персональн.*посилання|посилання.*сервіс/i)).toBeVisible()
  await step(page, 5).click()
  await expect(page.getByRole('combobox', { name: 'Після завершення візиту' })).toHaveCount(0)
  await expect(page.getByText(/Запити відгуку плануються на наступний день/)).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Макс. повідомлень за хвилину' })).toHaveCount(0)
  const quiet = page.getByRole('switch', { name: 'Не надсилати вночі' })
  await expect(quiet).toBeChecked()
  const times = page.locator('input[type="time"]')
  await times.nth(0).fill('21:30')
  await times.nth(1).fill('21:30')
  await expect(next(page)).toBeDisabled()
  await times.nth(1).fill('08:15')
  await expect(next(page)).toBeEnabled()
  await next(page).click()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Запит відгуку')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({
    name: 'Запит відгуку', type: 'post_visit_review_request', purpose: 'review_request', recipient: 'customer',
    channel: 'sms', status: 'draft', review_platform: 'internal', review_url: null, review_delay_minutes: null,
    metadata_json: { primary_channel: 'sms', fallback_channel: null, quiet_hours_enabled: true, quiet_hours_from: '21:30', quiet_hours_to: '08:15', schedule_mode: 'automated' },
  })
  checkBackend(backend)
})

test('notification activation requires confirmation and only creates an active event rule', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?kind=notifications')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Активне підтвердження')
  await next(page).click()
  await next(page).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Запис підтверджено: {manage_url} {cancel_url}')
  await next(page).click()
  await next(page).click()
  await next(page).click()
  await expect(page.getByRole('heading', { name: 'Фінальна перевірка' })).toBeVisible()

  const activate = page.getByRole('button', { name: 'Активувати кампанію' })
  await activate.click()
  const confirmation = page.getByRole('dialog', { name: 'Діалогове вікно' })
  await expect(confirmation.getByRole('heading', { name: 'Активувати сповіщення?' })).toBeVisible()
  await expect(confirmation).toContainText('після відповідної сервісної події')
  await confirmation.getByRole('button', { name: 'Скасувати' }).click()
  await expect(confirmation).toHaveCount(0)
  expect(backend.writes).toEqual([])

  await activate.click()
  await confirmation.getByRole('button', { name: 'Активувати', exact: true }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Активне підтвердження')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({
    name: 'Активне підтвердження', type: 'booking_confirmation', purpose: 'transactional',
    recipient: 'customer', channel: 'sms', location_key: 'sms_booking_confirmation',
    status: 'active', segment_ids: [], metadata_json: { schedule_mode: 'automated', message_body: 'Запис підтверджено: {manage_url} {cancel_url}' },
  })
  expect(backend.writes.filter(write => write.path === '/backoffice/messaging/templates')).toHaveLength(1)
  expect(backend.writes).toHaveLength(2)
  checkBackend(backend)
})

test('master notification uses a master recipient and cannot select unsupported SMS', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?kind=notifications')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Графік майстрів')
  await page.getByText('Нагадування майстрам про графік', { exact: true }).click()
  await expect(page.getByRole('radio', { name: /Нагадування майстрам про графік/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: /^SMS/ })).toBeDisabled()
  await expect(page.getByRole('radio', { name: 'Telegram', exact: true })).toBeChecked()
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Будь ласка, відкрийте графік на наступний місяць.')
  await step(page, 5).click()
  await expect(page.getByRole('switch', { name: 'Не надсилати вночі' })).toHaveCount(0)
  await step(page, 6).click()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Графік майстрів')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({
    name: 'Графік майстрів', type: 'master_schedule_reminder', recipient: 'master', purpose: 'transactional',
    channel: 'telegram', status: 'draft', segment_ids: [],
  })
  checkBackend(backend)
})

test('notification creation refuses a second rule of the same type before any write', async ({ page }) => {
  const backend = await installBackend(page, 'light', segments, { existingNotifications: [{
    id: 77, name: 'Наявне підтвердження', type: 'booking_confirmation', channel: 'sms',
    status: 'draft', recipient: 'customer', created_at: '2026-01-01T00:00:00Z',
  }] })
  await page.goto('/messaging/campaigns/new?kind=notifications')
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Друге підтвердження')
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Запис: {manage_url} {cancel_url}')
  await step(page, 6).click()
  await page.getByRole('button', { name: /Створити (кампанію|сповіщення)/ }).click()
  await expect(page.getByRole('alert')).toContainText('Сповіщення цього типу вже існує')
  await expect(page.getByRole('link', { name: 'Налаштувати Наявне підтвердження' })).toHaveAttribute('href', '/messaging/campaigns/77')
  expect(backend.writes).toEqual([])
  checkBackend(backend)
})

test('non-admin cannot open or save the campaign wizard', async ({ page }) => {
  const backend = await installBackend(page, 'light', segments, { user: { ...admin, role: 'barber', is_superuser: false } })
  await page.goto('/messaging/campaigns/new')
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('heading', { name: 'Нова кампанія' })).toHaveCount(0)
  expect(campaignWrites(backend)).toHaveLength(0)
  checkBackend(backend)
})

for (const [theme, width, height] of [['light', 1440, 900], ['dark', 390, 844]] as const) {
  test(`${theme} wizard screenshot at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    const backend = await installBackend(page, theme)
    await page.goto('/messaging/campaigns/new')
    await expect(page.getByRole('checkbox', { name: 'Telegram', exact: true })).toBeVisible()
    await expect(page.getByTestId('campaign-navigation')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`campaign-constructor-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    await step(page, 4).click()
    await expect(page.getByRole('heading', { name: 'Відгук · необов’язково', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Промокод · необов’язково', exact: true })).toBeVisible()
    await expect(page.locator('select')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`campaign-links-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    await step(page, 5).click()
    await expect(page.getByRole('radio', { name: 'Після підтвердження запуску', exact: true })).toBeChecked()
    await expect(page.getByRole('button', { name: /^Часовий пояс/ })).toContainText('Київ')
    await expect(page.locator('select')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`campaign-schedule-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    await step(page, 2).click()
    await expect(audienceSource(page)).toContainText('Збережені сегменти')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`campaign-audience-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    await segmentPicker(page).getByRole('button', { name: 'Пояснення: Збережені сегменти', exact: true }).click()
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    const bounds = await tooltip.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height)
    await page.keyboard.press('Escape')
    await expect(tooltip).toHaveCount(0)
    if (theme === 'light') {
      await step(page, 1).click()
      await page.getByRole('checkbox', { name: 'Персональна пропозиція', exact: true }).check()
      await step(page, 4).click()
      await expect(page.getByRole('button', { name: 'Майстер Оберіть майстра' })).toBeVisible()
    } else {
      await step(page, 2).click()
      await openSegments(page)
      await segmentSearch(page).fill('Особлива')
      await expect(segmentOption(page, 'Особлива аудиторія')).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath(`campaign-wizard-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    await closeSegments(page)
    await step(page, 2).click()
    await chooseSegment(page, 'Особлива аудиторія')
    await chooseSegment(page, 'Сегмент 001')
    await expect(segmentTrigger(page)).toContainText('2/20 вибрано')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`campaign-audience-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    const help = segmentPicker(page).getByRole('button', { name: 'Пояснення: Збережені сегменти', exact: true })
    const iconBounds = await help.locator('svg').boundingBox()
    expect(iconBounds?.width).toBeGreaterThanOrEqual(16)
    expect(iconBounds?.height).toBeGreaterThanOrEqual(16)
    await help.click()
    await expect(tooltip).toBeVisible()
    await expect(segmentTrigger(page)).toContainText('2/20 вибрано')
    await page.screenshot({ path: testInfo.outputPath(`campaign-audience-help-${theme}-${width}.png`), animations: 'disabled' })
    await help.click()
    checkBackend(backend)
  })
}
