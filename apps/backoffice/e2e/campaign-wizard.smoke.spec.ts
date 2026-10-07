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
const service = { id: 11, name: 'Стрижка', title_uk: 'Стрижка', is_active: true }
const otherService = { id: 12, name: 'Борода', title_uk: 'Борода', is_active: true }
const sharedTemplate = { id: 41, name: 'Готовий шаблон', campaign_type: 're_engagement', channel: 'sms', language: 'uk', message_body: 'Готове повідомлення {{client_name}}', variables: [], is_active: true, is_default: false }
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
}

type Backend = {
  writes: Array<{ path: string; body: Record<string, unknown> }>
  segmentQueries: URL[]
  templateQueries: URL[]
  unexpected: string[]
  errors: string[]
  failSegmentsOnce: () => void
  failCampaignOnce: () => void
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
      return json({ id: 501, ...body, created_at: '2026-01-01T00:00:00Z' }, 201)
    }
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/501') {
      const body = writes.findLast(item => item.path === '/backoffice/messaging/campaigns')?.body || {}
      return json({ id: 501, ...body, created_at: '2026-01-01T00:00:00Z' })
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
  return { writes, segmentQueries, templateQueries, unexpected, errors, failSegmentsOnce: () => { segmentFailures += 2 }, failCampaignOnce: () => { campaignFailures++ } }
}

function checkBackend(backend: Backend, expectedFailure = false) {
  expect(backend.unexpected, 'Every API request must be explicitly mocked').toEqual([])
  expect(backend.errors.filter(error => !(expectedFailure && /^Console error: .*503/.test(error))), 'Browser exceptions, console errors and failed API calls must be visible').toEqual([])
  expect(backend.writes.filter(write => /\/runs|\/send|\/status/.test(write.path)), 'Saving a draft must never run or send it').toEqual([])
}

const step = (page: Page, number: number) => page.getByRole('button', { name: new RegExp(`^Крок ${number}:`) })
const campaignWrites = (backend: Backend) => backend.writes.filter(write => write.path === '/backoffice/messaging/campaigns')
const next = (page: Page) => page.getByRole('button', { name: 'Далі', exact: true })
const selectOfferOption = async (page: Page, field: string, current: string, option: string) => {
  await page.getByRole('button', { name: `${field} ${current}` }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
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
  const dialog = page.getByRole('dialog', { name: 'Вибір дати', exact: true })
  await dialog.getByRole('button', { name: 'Наступний місяць' }).click()
  await dialog.getByRole('button', { name: '15', exact: true }).click()
  await dialog.getByLabel('Час').fill(time)
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue(new RegExp(`-15T${time}$`))
  return input
}

test('broadcast starts with segments, searches all pages and saves a segment draft', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new')
  await expect(page.getByRole('radio', { name: /Звичайна розсилка/ })).toBeChecked()
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Осіння розсилка')
  await step(page, 2).click()
  await expect(page.getByRole('radio', { name: 'Збережені сегменти' })).toBeChecked()
  await expect.poll(() => backend.segmentQueries.some(url => url.searchParams.get('offset') === '100')).toBe(true)
  expect(backend.segmentQueries.every(url => url.searchParams.get('status') === 'active' && url.searchParams.get('limit') === '100')).toBe(true)
  await page.getByRole('searchbox', { name: 'Пошук сегмента' }).fill('Особлива')
  await expect(page.getByRole('checkbox', { name: /Особлива аудиторія/ })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Сегмент 001/ })).toHaveCount(0)
  await page.getByRole('checkbox', { name: /Особлива аудиторія/ }).check()
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Привіт, це осіння пропозиція.')
  await step(page, 6).click()
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Осіння розсилка')
  expect(campaignWrites(backend)[0]!.body).toMatchObject({ name: 'Осіння розсилка', type: 'manual', status: 'draft', segment_ids: [101], channel_strategy: 'single' })
  expect(backend.writes.filter(write => write.path.endsWith('/templates'))).toHaveLength(1)
  checkBackend(backend)
})

test('switching scenarios keeps each draft state and legacy URL becomes canonical', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?kind=new-master&segment_id=101')
  await expect(page).toHaveURL('/messaging/campaigns/new?segment_id=101')
  await expect(page.getByRole('radio', { name: /Новий майстер/ })).toBeChecked()
  await page.getByRole('textbox', { name: 'Назва' }).fill('Окрема акція')
  await step(page, 2).click()
  await expect(page.getByRole('checkbox', { name: /Особлива аудиторія/ })).toBeChecked()
  await step(page, 1).click()
  await page.getByRole('radio', { name: /Звичайна розсилка/ }).check()
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Окрема розсилка')
  await step(page, 2).click()
  await expect(page.getByRole('checkbox', { name: /Особлива аудиторія/ })).toBeChecked()
  await step(page, 1).click()
  await page.getByRole('radio', { name: /Новий майстер/ }).check()
  await expect(page.getByRole('textbox', { name: 'Назва' })).toHaveValue('Окрема акція')
  await step(page, 2).click()
  await expect(page.getByRole('checkbox', { name: /Особлива аудиторія/ })).toBeChecked()
  checkBackend(backend)
})

test('new master saves only a typed offer draft after all six steps', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/new?segment_id=101')
  await page.getByRole('radio', { name: /Новий майстер/ }).check()
  await page.getByRole('textbox', { name: 'Назва' }).fill('Новий майстер жовтень')
  await step(page, 2).click()
  await expect(page.getByRole('checkbox', { name: /Особлива аудиторія/ })).toBeChecked()
  await step(page, 3).click()
  await page.getByRole('textbox', { name: /Ім’я у повідомленні/ }).fill('Тестового Майстра')
  await step(page, 4).click()
  await page.getByRole('button', { name: 'Майстер Оберіть майстра' }).click()
  await page.getByRole('option', { name: 'Тест Майстер' }).click()
  await page.getByRole('button', { name: 'Акція 30% Оберіть акцію' }).click()
  await page.getByRole('option', { name: 'Знижка 30%' }).click()
  await page.getByRole('checkbox', { name: /Стрижка/ }).check()
  await step(page, 5).click()
  await step(page, 6).click()
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Новий майстер жовтень')
  expect(campaignWrites(backend)[0]!.body).toEqual({
    name: 'Новий майстер жовтень', type: 're_engagement', status: 'draft', channel: 'sms',
    channel_strategy: 'single', purpose: 'marketing', recipient: 'customer', timezone: 'Europe/Kyiv',
    template_id: 71, segment_ids: [101], offer_master_id: 7, offer_promotion_id: 9,
    offer_service_ids: [11], master_name_for_message: 'Тестового Майстра',
    sending_window: { start: '10:00', end: '18:00', days: [0, 1, 2, 3, 4, 5, 6] },
    sms_recipients_per_minute: 20, marketing_frequency_days: 7, marketing_max_contacts: 1,
    marketing_cap_days: 7, exclude_upcoming_booking: true, exclude_returned_since_snapshot: true,
    offer_starts_at: null, offer_expires_at: null,
  })
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
  await page.getByRole('radio', { name: /Новий майстер/ }).check()
  const name = page.getByRole('textbox', { name: 'Назва', exact: true })
  await name.fill('')
  await expect(next(page)).toBeDisabled()
  await name.fill('Валідація майстра')
  await selectOfferOption(page, 'Канал', 'SMS', 'Telegram → SMS, якщо Telegram недоступний')
  await expect(next(page)).toBeEnabled()
  await next(page).click()

  await page.getByRole('button', { name: 'Прибрати сегмент Особлива аудиторія' }).click()
  await expect(next(page)).toBeDisabled()
  await page.getByRole('checkbox', { name: /Особлива аудиторія/ }).check()
  const frequency = page.getByRole('spinbutton', { name: 'Мінімум днів між маркетинговими контактами' })
  for (const invalid of ['', '0', '366', '1.5']) {
    await frequency.fill(invalid)
    await expect(next(page)).toBeDisabled()
  }
  await frequency.fill('14')
  for (let id = 1; id <= 19; id++) await page.getByRole('checkbox', { name: `Сегмент ${String(id).padStart(3, '0')}` }).check()
  await expect(page.getByText('Вибрано 20 із 20')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Сегмент 020' })).toBeDisabled()
  await page.getByRole('button', { name: 'Прибрати сегмент Сегмент 001' }).click()
  await expect(page.getByRole('checkbox', { name: 'Сегмент 020' })).toBeEnabled()
  await expect(next(page)).toBeEnabled()
  await next(page).click()

  const messageName = page.getByRole('textbox', { name: /Ім’я у повідомленні/ })
  const template = page.getByRole('textbox', { name: 'SMS шаблон' })
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
  await page.getByRole('radio', { name: /Новий майстер/ }).check()
  await page.getByRole('textbox', { name: 'Назва', exact: true }).fill('Акція з правилами')
  await selectOfferOption(page, 'Канал', 'SMS', 'Telegram → SMS, якщо Telegram недоступний')
  await next(page).click()
  await page.getByRole('spinbutton', { name: 'Мінімум днів між маркетинговими контактами' }).fill('14')
  await next(page).click()
  await page.getByRole('textbox', { name: /Ім’я у повідомленні/ }).fill('Іншого Майстра')
  await page.getByRole('textbox', { name: 'SMS шаблон' }).fill('До {{master_name}}: {{offer_link}}')
  await next(page).click()

  await page.getByRole('button', { name: 'Акція 30% Оберіть акцію' }).click()
  await expect(page.getByRole('option', { name: 'Знижка 20%' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Знижка 30%' }).click()
  await selectOfferOption(page, 'Майстер', 'Оберіть майстра', 'Тест Майстер')
  await page.getByRole('checkbox', { name: 'Стрижка' }).check()
  await selectOfferOption(page, 'Майстер', 'Тест Майстер', 'Інший Майстер')
  await expect(page.getByRole('checkbox', { name: 'Стрижка' })).toHaveCount(0)
  await expect(next(page)).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Борода' }).check()
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
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
  await expect(page.getByRole('alert')).toContainText('Temporary draft error')
  await expect(page).toHaveURL(/\/messaging\/campaigns\/new/)
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(2)
  await savedPage(page, 'Акція з правилами')
  const body = campaignWrites(backend)[1]!.body
  expect(body).toMatchObject({
    name: 'Акція з правилами', status: 'draft', type: 're_engagement', channel: 'sms',
    channel_strategy: 'telegram_then_sms', segment_ids: [101], offer_master_id: 8,
    offer_promotion_id: 9, offer_service_ids: [12], master_name_for_message: 'Іншого Майстра',
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
  await page.getByText('SMS', { exact: true }).click()
  await expect(page.getByRole('radio', { name: 'SMS', exact: true })).toBeChecked()
  await next(page).click()
  await expect(page.getByRole('checkbox', { name: /Особлива аудиторія/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: /Фільтри цієї кампанії/ })).toBeDisabled()
  await expect(page.getByText(/Для SMS виберіть збережений сегмент/)).toBeVisible()
  await page.getByRole('combobox', { name: 'Стратегія каналів' }).selectOption('sms_then_telegram')
  await page.getByRole('checkbox', { name: 'Виключити клієнтів із майбутніми бронюваннями' }).uncheck()
  await page.getByRole('checkbox', { name: 'Виключити клієнтів, які повернулися після фіксації аудиторії' }).uncheck()
  const frequency = page.getByRole('spinbutton', { name: 'Мінімум днів між маркетинговими повідомленнями' })
  await frequency.fill('0')
  await expect(next(page)).toBeDisabled()
  await frequency.fill('12')
  await next(page).click()
  await page.getByRole('combobox', { name: 'Шаблон' }).selectOption('41')
  expect(backend.templateQueries.some(url => url.searchParams.get('page') === '2')).toBe(true)
  await expect(page.getByRole('textbox', { name: /^Текст/ })).toHaveValue(sharedTemplate.message_body)
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Оновлений текст {{client_name}}')
  await expect(page.getByRole('textbox', { name: 'Українська версія' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'English version' })).toHaveCount(0)
  await next(page).click()
  await page.getByRole('combobox', { name: 'Платформа відгуку' }).selectOption('instagram')
  await page.getByRole('textbox', { name: 'Посилання' }).fill('https://example.test/review')
  await page.getByRole('textbox', { name: 'Промокод' }).fill('SOUL12')
  await expect(page.getByRole('textbox', { name: 'Текст кнопки Telegram' })).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: 'Follow-up через N днів' })).toHaveCount(0)
  await next(page).click()
  await page.getByRole('radio', { name: 'Запланувати' }).check()
  await expect(next(page)).toBeDisabled()
  const scheduled = await chooseCalendarNextMonth(page, 'Дата і час', '16:30')
  await expect(scheduled).toHaveValue(/T16:30$/)
  await page.getByRole('combobox', { name: 'Timezone' }).selectOption('Europe/Warsaw')
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
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
  await expect.poll(() => campaignWrites(backend).length).toBe(1)
  await savedPage(page, 'Повна розсилка')
  const body = campaignWrites(backend)[0]!.body
  expect(body).toMatchObject({
    name: 'Повна розсилка', type: 're_engagement', channel: 'sms', status: 'draft',
    template_id: 41, segment_ids: [101], channel_strategy: 'sms_then_telegram',
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
  await page.getByRole('radio', { name: /Фільтри цієї кампанії/ }).check()
  await page.getByText('Клієнти майстра', { exact: true }).click()
  await expect(next(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Оберіть майстра' }).click()
  await page.getByRole('option', { name: 'Тест Майстер' }).click()
  await expect(next(page)).toBeEnabled()
  await page.getByText('Візити за період', { exact: true }).click()
  await expect(next(page)).toBeDisabled()
  await page.getByRole('textbox', { name: 'Дата від' }).click()
  await page.getByRole('dialog', { name: 'Вибір дати' }).getByRole('button', { name: 'Сьогодні' }).click()
  await expect(next(page)).toBeEnabled()
  await page.getByText('Неактивні клієнти', { exact: true }).click()
  await expect(next(page)).toBeDisabled()
  await page.getByRole('spinbutton', { name: 'Днів без візиту' }).fill('90')
  await expect(next(page)).toBeEnabled()
  await page.getByText('Використали послугу', { exact: true }).click()
  await expect(next(page)).toBeDisabled()
  await page.getByRole('combobox', { name: 'Послуга' }).selectOption('11')
  await expect(next(page)).toBeEnabled()
  await next(page).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Запрошення після стрижки.')
  await step(page, 6).click()
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
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
  await expect(page.getByRole('radio', { name: /Звичайна розсилка/ })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Назва кампанії' }).fill('Подієве SMS')
  await page.getByRole('radio', { name: /Підтвердження запису/ }).check()
  await expect(page.getByRole('radio', { name: 'SMS', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: /^Telegram/ })).toBeDisabled()
  await next(page).click()
  await expect(page.getByText(/Сповіщення створюються за подіями/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Збережені сегменти' })).toHaveCount(0)
  await next(page).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Ваш запис підтверджено')
  await expect(page.getByText(/Не вистачає змінних:/)).toContainText('{manage_url}')
  await expect(next(page)).toBeDisabled()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Ваш запис: {manage_url} {cancel_url}')
  await expect(next(page)).toBeEnabled()
  await next(page).click()
  await expect(page.getByRole('heading', { name: 'Відгук та промо' })).toBeVisible()
  await next(page).click()
  await expect(page.getByRole('heading', { name: 'Розклад та правила' })).toBeVisible()
  await expect(page.getByText(/Сповіщення надсилається автоматично/)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Запланувати' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Після завершення візиту' })).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'Не надсилати вночі' })).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: 'Макс. повідомлень за хвилину' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Timezone' })).toHaveCount(0)
  await next(page).click()
  await expect(page.getByRole('button', { name: 'Активувати кампанію' })).toBeEnabled()
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
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
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
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
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
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
  await page.getByRole('button', { name: 'Зберегти чернетку' }).click()
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
    if (theme === 'light') {
      await page.getByRole('radio', { name: /Новий майстер/ }).check()
      await step(page, 4).click()
      await expect(page.getByRole('button', { name: 'Майстер Оберіть майстра' })).toBeVisible()
    } else {
      await step(page, 2).click()
      await page.getByRole('searchbox', { name: 'Пошук сегмента' }).fill('Особлива')
      await expect(page.getByRole('checkbox', { name: /Особлива аудиторія/ })).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath(`campaign-wizard-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    checkBackend(backend)
  })
}
