import { expect, test, type Page, type Route } from '@playwright/test'

const admin = {
  id: 1, email: 'detail@soulcuts.test', full_name: 'Detail Admin', role: 'admin',
  master_id: null, is_active: true, is_superuser: true,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
const master = { id: 7, first_name_uk: 'Тест', last_name_uk: 'Майстер', full_name: 'Тест Майстер', full_name_uk: 'Тест Майстер', is_active: true }
const promotion = { id: 9, name_uk: 'Знижка 30%', discount_percent: 30, discount_type: 'percent', recipient_offer_only: true, is_active: true }
const service = { id: 11, name: 'Стрижка', title_uk: 'Стрижка', is_active: true, duration_minutes: 30, price: 500 }
const segment = {
  id: 101, name: 'Особлива аудиторія', status: 'active', revision: 1, description: null,
  rules: { combine: 'all', conditions: [{ type: 'last_visit_age', min: 3, max: 12, unit: 'calendar_months' }], exclusions: [] },
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', archived_at: null,
}
const offerCampaign = {
  id: 11, name: 'Пропозиція для клієнтів', type: 're_engagement', status: 'draft', channel: 'sms',
  channel_strategy: 'single', purpose: 'marketing', recipient: 'customer', template_id: 71,
  segment_ids: [101], audience_size: 0, sent_count: 0, failed_count: 0, scheduled_at: null,
  created_by: 'Detail Admin', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z',
  timezone: 'Europe/Kyiv', offer_audience_mode: 'segments', offer_master_id: 7, offer_promotion_id: 9,
  offer_service_ids: [11], master_name_for_message: 'Тестового Майстра',
  offer_starts_at: '2026-11-01T09:00:00Z', offer_expires_at: '2026-11-30T16:00:00Z',
  sending_window: { start: '10:00', end: '18:00', days: [0, 1, 2, 3, 4, 5, 6] },
  sms_recipients_per_minute: 20, marketing_frequency_days: 7, marketing_max_contacts: 1,
  marketing_cap_days: 7, exclude_upcoming_booking: true, exclude_returned_since_snapshot: true,
  metadata_json: {},
}
const template = {
  id: 71, name: 'Пропозиція template', campaign_type: 're_engagement', channel: 'sms', language: 'uk',
  message_body: 'Запис до {{master_name}}: {{offer_link}}', variables: [], is_active: true, is_default: false,
}
const preview = {
  evaluated_at: '2026-10-08T09:00:00Z', total: 3, page: 1, page_size: 50,
  communication_eligible_recipients: 2, sms_eligible_recipients: 2, telegram_eligible_recipients: 0,
  estimated_sms_parts: 2, estimated_cost: { status: 'available', amount: 2, currency: 'UAH' },
  balance: { status: 'available', amount: 100, currency: 'UAH' },
  items: [
    { customer_id: 21, name: 'Олена', eligible: true, exclusion_reason: null, channel: 'sms', reachability: { sms: true }, facts: {}, provider_supported: true, rendered_message: 'Запис до Тестового Майстра: https://soulcuts.test/offer/21', sms_parts: 1 },
    { customer_id: 22, name: 'Іван', eligible: false, exclusion_reason: 'upcoming_booking', channel: null, reachability: { sms: true }, facts: {}, provider_supported: true, rendered_message: null, sms_parts: null },
  ],
}
const analytics = {
  period_basis: 'run_cohort', audience_size: 0, communication_eligible_recipients: 0,
  provider_accepted: 0, delivered: 0, raw_link_requests: 0, confirmed_page_opens: 0,
  unique_confirmed_openers: 0, bookings_created: 0, cancelled_bookings: 0, no_show: 0,
  completed_visits: 0, unique_customers_redeemed: 0, total_discount_amount: 0,
  observed_completed_revenue: 0, booking_conversion_percent: null, redemption_conversion_percent: null,
}
const run = {
  id: 44, campaign_id: 11, idempotency_key: 'local-read-only-run', status: 'scheduled',
  scheduled_at: '2026-11-01T09:00:00Z', evaluated_at: null, segment_snapshots: [],
  campaign_snapshot: { message_body: template.message_body, master_name_for_message: 'Тестового Майстра', promotion_name_uk: 'Знижка 30%' },
  audience_count: 2, created_at: '2026-10-08T09:00:00Z', updated_at: '2026-10-08T09:00:00Z',
}
const pageOf = (url: URL, items: unknown[]) => ({ items, total: items.length, page: Number(url.searchParams.get('page') || 1), page_size: Number(url.searchParams.get('page_size') || 50) })

type Backend = {
  unexpected: string[]
  errors: string[]
  mutations: string[]
  previews: URL[]
}

async function installBackend(page: Page, campaign: Record<string, unknown> = offerCampaign, theme: 'light' | 'dark' = 'light', ready = true): Promise<Backend> {
  await page.addInitScript(({ theme, user }) => {
    localStorage.setItem('soulcuts-backoffice-theme', theme)
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'detail-local-only', refreshToken: 'unused', user }))
  }, { theme, user: admin })
  const unexpected: string[] = []
  const errors: string[] = []
  const mutations: string[] = []
  const previews: URL[] = []
  page.on('pageerror', error => errors.push(`Page error: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') errors.push(`Console error: ${message.text()}`) })
  page.on('requestfailed', request => { if (request.url().includes('/api/v1/')) errors.push(`Failed API request: ${request.url()} ${request.failure()?.errorText}`) })
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api\/v1/, '')
    const method = request.method()
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', json: body })
    if (method === 'GET' && path === '/backoffice/auth/me') return json(admin)
    if (method === 'GET' && path === '/public/masters') return json([master])
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/11') return json(campaign)
    if (method === 'GET' && path === '/backoffice/messaging/templates/71') return json(template)
    if (method === 'GET' && path === '/backoffice/masters') return json(pageOf(url, [master]))
    if (method === 'GET' && path === '/backoffice/promotions') return json(pageOf(url, [promotion]))
    if (method === 'GET' && path === '/backoffice/barbers/7/services') return json([service])
    if (method === 'GET' && path === '/backoffice/segments/101') return json(segment)
    if (method === 'GET' && path === '/backoffice/segments') return json({ items: [segment], total: 1, limit: 100, offset: 0 })
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/11/logs') return json(pageOf(url, []))
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/11/recipients') return json(pageOf(url, []))
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/11/runs') return json(pageOf(url, campaign.status === 'draft' ? [] : [run]))
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/11/runs/44') return json({ ...run, delivery_counts: { sent: 0, delivered: 0, failed: 0, skipped: 0 } })
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/11/runs/44/members') return json(pageOf(url, []))
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/11/runs/44/queue') return json({
      total: 2, counts: { pending: 2 }, dispatching: 0, paused: campaign.status === 'paused', cancelled: false,
      sms_recipients_per_minute: 20, estimated_remaining_seconds: 60, estimated_completion_at: '2026-11-01T09:01:00Z',
      next_window_at: null, estimate_kind: 'dispatch', estimate_note: 'Локальний тестовий стан',
    })
    if (method === 'GET' && path === '/backoffice/messaging/campaigns/11/readiness') return json({
      ready, checks: ready ? [{ code: 'offer_dates', status: 'ok', detail: 'Дати задано.' }] : [{ code: 'offer_dates', status: 'blocked', detail: 'Вкажіть початок і завершення пропозиції.' }],
      runtime_verification: ready ? 'ready' : 'blocked', balance: { status: 'available', amount: 100, currency: 'UAH' },
    })
    if (method === 'GET' && path === '/backoffice/messaging/campaign-offer-analytics' && url.searchParams.get('campaign_id') === '11') return json(analytics)
    if (method === 'POST' && path === '/backoffice/messaging/campaigns/11/audience-preview') {
      previews.push(url)
      return json(preview)
    }
    if (method !== 'GET') mutations.push(`${method} ${path}`)
    unexpected.push(`${method} ${url.href}`)
    return json({ detail: 'Unexpected request in campaign detail smoke test' }, 599)
  })
  return { unexpected, errors, mutations, previews }
}

const checkBackend = (backend: Backend) => {
  expect(backend.unexpected, 'Every API request must be explicitly mocked').toEqual([])
  expect(backend.errors, 'Browser and API errors must remain visible').toEqual([])
  expect(backend.mutations, 'Read-only detail checks must not alter a campaign or send messages').toEqual([])
}
const loaded = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Пропозиція для клієнтів', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Запуск кампанії' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Розділи кампанії' })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

test('draft without offer dates explains the launch gate even after a fresh preview', async ({ page }) => {
  const backend = await installBackend(page, { ...offerCampaign, offer_starts_at: null, offer_expires_at: null }, 'light', false)
  await page.goto('/messaging/campaigns/11')
  await loaded(page)
  await expect(page.getByText('Задайте початок і кінець пропозиції в умовах кампанії.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Перевірити та запустити' })).toBeDisabled()
  await page.getByText('Умови та повідомлення', { exact: true }).click()
  await expect(page.getByText('Без початку')).toBeVisible()
  await expect(page.getByText('Без завершення')).toBeVisible()
  await page.getByRole('button', { name: 'Створити свіжий перегляд' }).click()
  await expect(page.getByText('Не готово до запуску')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Перевірити та запустити' })).toBeDisabled()
  await page.getByText('Усі технічні перевірки', { exact: true }).click()
  await expect(page.getByText('Вкажіть початок і завершення пропозиції.')).toBeVisible()
  expect(backend.previews).toHaveLength(1)
  checkBackend(backend)
})

test('fresh audience preview enables launch review, and cancelling leaves the draft untouched', async ({ page }) => {
  const backend = await installBackend(page)
  await page.goto('/messaging/campaigns/11')
  await loaded(page)
  const launch = page.getByRole('button', { name: 'Перевірити та запустити' })
  await expect(launch).toBeDisabled()
  await page.getByRole('button', { name: 'Створити свіжий перегляд' }).click()
  await expect(page.getByText('Готово до запуску')).toBeVisible()
  await expect(page.getByText('Запис до Тестового Майстра: https://soulcuts.test/offer/21')).toBeVisible()
  await expect(page.getByText('Технічна оцінка відправки', { exact: true })).toBeVisible()
  await page.getByText('Технічна оцінка відправки', { exact: true }).click()
  await expect(page.getByText('Оцінка вартості: 2 UAH', { exact: true })).toBeVisible()
  await expect(page.getByText('Баланс: 100 UAH', { exact: true })).toBeVisible()
  await expect(launch).toBeEnabled()
  await launch.click()
  const confirmation = page.getByRole('dialog', { name: 'Діалогове вікно' })
  await expect(confirmation.getByRole('heading', { name: 'Підтвердити реальний запуск?' })).toBeVisible()
  await expect(confirmation).toContainText('Тест Майстер')
  await expect(confirmation).toContainText('Знижка 30%')
  await confirmation.getByRole('button', { name: 'Скасувати' }).click()
  await expect(confirmation).toHaveCount(0)
  expect(backend.previews).toHaveLength(1)
  checkBackend(backend)
})

for (const status of ['active', 'paused'] as const) {
  test(`${status} offer detail shows status-specific controls without a mutation`, async ({ page }) => {
    const backend = await installBackend(page, { ...offerCampaign, status })
    await page.goto('/messaging/campaigns/11')
    await loaded(page)
    await expect(page.getByText(status === 'active' ? 'Кампанію активовано. Стан черги та результати дивіться нижче.' : 'Відправку призупинено. Уже надіслані повідомлення залишаються в історії.')).toBeVisible()
    await page.getByText('Умови та повідомлення', { exact: true }).click()
    await expect(page.getByText('Умови запущеної кампанії доступні для перегляду.', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Редагувати' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Перевірити та запустити' })).toBeDisabled()
    await page.getByRole('button', { name: 'Запуск #44' }).click()
    await expect(page.getByRole('heading', { name: /Запуск #44/ })).toBeVisible()
    await expect(page.getByRole('button', { name: status === 'active' ? 'Пауза' : 'Поновити' })).toBeVisible()
    checkBackend(backend)
  })
}

test('generic campaign detail keeps its audience, launch and delivery sections', async ({ page }) => {
  const backend = await installBackend(page, {
    ...offerCampaign, name: 'Звичайна кампанія', type: 'manual', channel: 'telegram',
    offer_master_id: null, offer_promotion_id: null, offer_service_ids: null,
    segment_ids: [], template_id: null, message_body: 'Вітаємо клієнтів',
    audience_rules: [{ type: 'specific_clients', client_ids: [21, 22] }],
  })
  await page.goto('/messaging/campaigns/11')
  await expect(page.getByRole('heading', { name: 'Звичайна кампанія', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Аудиторія та запуск' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Умови кампанії' })).toBeVisible()
  await expect(page.getByText('Вибрані клієнти · №21, №22')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Доставка' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Підготовка та запуск' })).toHaveAttribute('href', '#campaign-launch')
  await page.waitForLoadState('networkidle')
  checkBackend(backend)
})

test('notification detail explains event-driven status without campaign launch controls', async ({ page }) => {
  const backend = await installBackend(page, {
    ...offerCampaign, name: 'Підтвердження запису', type: 'booking_confirmation', status: 'active',
    channel: 'sms', recipient: 'customer', purpose: 'transactional', location_key: 'sms_booking_confirmation',
    offer_master_id: null, offer_promotion_id: null, offer_service_ids: null,
    segment_ids: [], template_id: null, message_body: 'Запис підтверджено: {manage_url} {cancel_url}',
  })
  await page.goto('/messaging/campaigns/11')
  await expect(page.getByRole('heading', { name: 'Підтвердження запису', exact: true })).toBeVisible()
  await expect(page.getByText('Правило увімкнене: повідомлення створюються після відповідної сервісної події.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'До сповіщень' })).toHaveAttribute('href', '/messaging/notifications')
  await expect(page.getByRole('link', { name: 'Підготовка та запуск' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Доставка' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  checkBackend(backend)
})

for (const [theme, width, height] of [['light', 1440, 900], ['dark', 390, 844]] as const) {
  test(`${theme} offer detail screenshot at ${width}px has no horizontal overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    const backend = await installBackend(page, offerCampaign, theme)
    await page.goto('/messaging/campaigns/11')
    await loaded(page)
    await expect(page.getByText('Тест Майстер', { exact: false }).first()).toBeVisible()
    const pageWidth = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
    expect(pageWidth.document).toBeLessThanOrEqual(pageWidth.viewport + 1)
    await page.screenshot({ path: testInfo.outputPath(`campaign-detail-${theme}-${width}.png`), fullPage: true, animations: 'disabled' })
    checkBackend(backend)
  })
}
