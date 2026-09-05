import { expect, test, type Page, type Request, type Route } from '@playwright/test'

const adminUser = {
  id: 1,
  email: 'smoke@soulcuts.test',
  full_name: 'Smoke Admin',
  role: 'admin',
  master_id: null,
  is_active: true,
  is_superuser: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const master = {
  id: 7,
  admin_user_id: 77,
  first_name_uk: 'Тест',
  last_name_uk: 'Майстер',
  full_name: 'Тест Майстер',
  position_uk: 'Барбер',
  is_active: true,
}

const service = {
  id: 11,
  name: 'Тестова стрижка',
  name_uk: 'Тестова стрижка',
  duration_minutes: 60,
  price: 500,
  is_active: true,
}

const pageFixture = (url: URL, items: unknown[] = [], total = 41) => ({
  items,
  total,
  page: Number(url.searchParams.get('page') || 1),
  page_size: Number(url.searchParams.get('page_size') || 20),
})

const reviewMetricsFixture = {
  date_from: null,
  date_to: null,
  timezone: 'Europe/Kyiv',
  cohort_definition: 'Completed visits in the selected period.',
  eligible_completed_visits: 0,
  requests_scheduled: 0,
  requests_sent: 0,
  requests_delivered: 0,
  review_form_opens: 0,
  review_form_opens_status: 'available',
  review_form_open_tracking_started_at: '2026-01-01T00:00:00Z',
  submitted_reviews: 0,
  approved_reviews: 0,
  review_conversion_rate: null,
  sent_to_open_rate: null,
  opened_to_submitted_rate: null,
  sent_and_submitted_count: 0,
  sent_and_opened_count: 0,
  opened_and_submitted_count: 0,
  submitted_without_sent_count: 0,
  average_moderation_time_minutes: null,
  average_rating_by_master: [],
}

const emptyMonthlyStatistics = {
  year: 2026,
  month: 9,
  barber: null,
  total_income: 0,
  completed_appointments: 0,
  unique_clients: 0,
  total_services_performed: 0,
  most_popular_services: [],
  revenue_by_service: [],
  average_check_per_appointment: 0,
  average_revenue_per_client: 0,
  clients: { new_clients: 0, returning_clients: 0 },
  cancelled_appointments: 0,
  no_show_appointments: 0,
  workload_by_day: [],
  workload_by_week: [],
  best_revenue_day: null,
  service_category_breakdown: [],
  tips: 0,
  bonuses: 0,
}

const dashboardFixture = {
  period: {
    current: { date_from: '2026-09-01', date_to: '2026-09-04', days: 4 },
    previous: null,
    timezone: 'Europe/Kyiv',
    applied_master_id: null,
    comparison_requested: false,
    max_range_days: 366,
    definitions: {
      gross_revenue: 'Completed booking totals.',
      available_minutes: 'Availability less time blocks.',
      booked_minutes: 'Bookings inside availability.',
      cancellation_rate: 'Cancelled divided by scheduled.',
      retention_cohort: 'Clients with an observable repeat window.',
      service_allocation: 'Allocated service snapshots.',
      no_show: 'Unavailable.',
      prime_time: 'Kyiv local prime time.',
    },
    signal_thresholds: {
      pending_bookings_min_count: 1,
      cancellation_min_count: 3,
      cancellation_min_rate_percent: 15,
      cancellation_min_increase_percentage_points: 5,
      unfilled_capacity_min_minutes: 120,
      unfilled_capacity_min_percent: 30,
      review_moderation_backlog_min_count: 1,
      failed_review_delivery_min_count: 1,
    },
  },
  executive: Object.fromEntries([
    'gross_revenue',
    'completed_visits',
    'unique_clients',
    'new_database_customers',
    'average_check',
    'booking_subtotal',
    'promotion_discount_amount',
  ].map(key => [key, { current: 0, previous: null, percent_change: null }])),
  capacity_and_leakage: {
    available_minutes: 0,
    booked_minutes: 0,
    utilisation_rate: 0,
    cancelled_visits: 0,
    cancellation_rate: { current: 0, previous: null, change_percentage_points: null },
    pending_unconfirmed_upcoming_bookings: 0,
    empty_upcoming_capacity_minutes: 0,
    empty_upcoming_capacity_rate: 0,
    prime_time_empty_windows: [],
    no_show_visits: null,
    no_show_status: 'unavailable',
  },
  retention: {
    new_clients: 0,
    returning_clients: 0,
    repeat_30_day: { window_days: 30, repeated_clients: 0, eligible_clients: 0, repeat_rate: null },
    repeat_45_day: { window_days: 45, repeated_clients: 0, eligible_clients: 0, repeat_rate: null },
    repeat_60_day: { window_days: 60, repeated_clients: 0, eligible_clients: 0, repeat_rate: null },
  },
  masters: [],
  services: [],
  booking_funnel: {
    calculation_version: 2,
    timezone: 'Europe/Kyiv',
    cohort_definition: 'Attempts started in the selected period.',
    master_attribution_definition: 'Early steps use the selected master.',
    status: 'empty',
    status_reason: 'No booking funnel events.',
    tracking_gap_count: 0,
    steps: [],
    step_to_step_conversion: [],
    overall_conversion: null,
    drop_offs: [],
    operational_alerts: [],
    alert_thresholds: {
      no_slot_min_count: 3,
      no_slot_rate_percent: 20,
      stale_schedule_count: 1,
      booking_error_count: 1,
      meaningful_step_sessions: 5,
    },
    no_slot_dates: [],
    no_slot_contexts: [],
    no_slot_context_limit: 250,
    no_slot_contexts_truncated: false,
    no_slot_unknown_date_count: 0,
    unattributed_booking_successes: 0,
    weekly_insight_uk: 'За вибраний період подій ще немає.',
    recommended_action: null,
    latest_weekly_digest: null,
  },
  telegram_bookings: {
    calculation_version: 1,
    timezone: 'Europe/Kyiv',
    period_basis: 'booking_created_at',
    created_bookings: { current: 0, previous: null, percent_change: null },
    unique_clients: { current: 0, previous: null, percent_change: null },
    status_counts: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
    historical_data_status: 'partial_before_source_tracking',
  },
  actionable_signals: [],
}

const responseFor = (url: URL, method: string): unknown => {
  const path = url.pathname.replace(/.*\/api\/v1/, '')
  if (path === '/backoffice/auth/me') return adminUser

  if (path === '/backoffice/reviews/metrics') return reviewMetricsFixture
  if (path === '/backoffice/reviews/masters/statistics') return []
  if (path === '/backoffice/reviews/request-settings') {
    return {
      enabled: true,
      delay_minutes: 30,
      schedule_mode: 'next_day',
      send_time: '10:00',
      primary_channel: 'sms',
      sms_fallback_enabled: false,
      quiet_hours_enabled: true,
      quiet_hours_from: '21:00',
      quiet_hours_to: '09:00',
      frequency_cap_count: 1,
      frequency_cap_days: 30,
      submitted_frequency_cap_days: 90,
      exclusions: [],
      template_preview: '',
    }
  }
  if (path === '/backoffice/reviews') return pageFixture(url)

  if (path === '/backoffice/statistics/admin/dashboard') return dashboardFixture
  if (path === '/backoffice/booking-recovery/summary') {
    return {
      timezone: 'Europe/Kyiv',
      date_from: '2026-09-01',
      date_to: '2026-09-04',
      no_slot_sessions: 0,
      alternatives_requested: 0,
      alternatives_returned: 0,
      alternative_slots_returned: 0,
      alternative_slots_selected: 0,
      bookings_after_alternative: 0,
      alternative_recovery_rate_percent: null,
      waitlist_requests: 0,
      offers_sent: 0,
      offers_delivered: 0,
      offers_claimed: 0,
      offers_expired: 0,
      cancelled_slots_refilled: 0,
      average_cancellation_to_refill_seconds: null,
    }
  }
  if (path === '/backoffice/statistics/admin/monthly') {
    return {
      year: Number(url.searchParams.get('year') || 2026),
      month: Number(url.searchParams.get('month') || 9),
      barber_id: null,
      total_barbershop_monthly_revenue: 0,
      total_clients: 0,
      total_completed_appointments: 0,
      total_cancelled_appointments: 0,
      aggregate: emptyMonthlyStatistics,
      top_barbers: [],
      most_popular_services: [],
    }
  }
  if (path === '/backoffice/statistics/admin/barbers-comparison') {
    return {
      year: Number(url.searchParams.get('year') || 2026),
      month: Number(url.searchParams.get('month') || 9),
      barbers: [],
      top_performing_barbers: [],
    }
  }

  if (path === '/backoffice/blog/statistics') {
    return {
      period_start: '2026-08-05T00:00:00Z',
      period_end: '2026-09-04T23:59:59Z',
      total_subscribers: 0,
      active_subscribers: 0,
      unsubscribed_subscribers: 0,
      subscribe_events: 0,
      unsubscribe_events: 0,
      net_growth: 0,
      unsubscribe_rate: 0,
      events: [],
      by_date: [],
      by_source: [],
      by_language: [],
      unsubscribe_reasons: [],
    }
  }
  if (path === '/backoffice/blog/subscriptions' || path === '/backoffice/blog/events') return pageFixture(url, [], 0)

  if (path === '/backoffice/messaging/dashboard') {
    return {
      active_campaigns: 0,
      scheduled_campaigns: 0,
      messages_sent: 0,
      failed_messages: 0,
      delivery_rate: 0,
      review_requests_sent: 0,
    }
  }
  if (path === '/backoffice/messaging/audience/estimate') return { total: 0, eligible: 0, missing_chat_id: 0 }
  if (path === '/backoffice/messaging/audience/preview') return []
  if (path === '/backoffice/messaging/campaigns' || path === '/backoffice/messaging/sms-campaigns') return pageFixture(url)
  if (path === '/backoffice/messaging/templates') return pageFixture(url)

  if (path === '/backoffice/categories/tree') return []
  if (path === '/backoffice/categories') {
    return pageFixture(url, [{ id: 3, name: 'Тестова категорія', slug: 'smoke', is_active: true }])
  }
  if (path === '/backoffice/brands') return pageFixture(url, [{ id: 5, name: 'Тестовий бренд', is_active: true }], 1)
  if (path === '/backoffice/products') return pageFixture(url)
  if (path === '/backoffice/customers') return pageFixture(url)
  if (path === '/backoffice/masters') return pageFixture(url, [master])
  if (path === '/backoffice/admin/services') return pageFixture(url)
  if (path === '/backoffice/booking-services') return pageFixture(url, [service])
  if (path === '/backoffice/promotions') return pageFixture(url)

  if (path === '/public/masters') return [master]
  if (path === '/public/services') return [service]
  if (
    path === '/backoffice/calendar/bookings'
    || path === '/backoffice/calendar/time-blocks'
    || path === '/backoffice/calendar-holds'
    || path === '/backoffice/availability'
    || path === '/backoffice/masters/me/calendar'
    || path === '/backoffice/masters/me/calendar-capacity'
    || path === '/backoffice/masters/me/calendar-holds'
    || path === '/backoffice/masters/me/availability'
  ) return []
  if (path === '/backoffice/masters/me/bookings' || path === '/backoffice/masters/me/time-blocks') return []
  if (path === '/backoffice/messaging/masters/me/telegram-connect-link') {
    return { master_id: 7, bot_username: 'smoke_bot', connect_link: '', expires_in_days: 1, telegram_connected: false }
  }

  if (method === 'GET') return []
  return {}
}

const installBackend = async (page: Page, requests: Request[] = []) => {
  await page.addInitScript(user => {
    window.localStorage.setItem('backoffice-auth', JSON.stringify({
      accessToken: 'smoke-access-token',
      refreshToken: 'smoke-refresh-token',
      user,
    }))
  }, adminUser)

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request()
    requests.push(request)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: responseFor(new URL(request.url()), request.method()),
    })
  })
}

const apiRequests = (requests: Request[], path: string) => requests.filter(request => new URL(request.url()).pathname.endsWith(path))

test('mobile menu contains scrolling and restores the page on close and desktop resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await installBackend(page)
  await page.goto('/customers')
  await expect(page.getByRole('button', { name: 'Відкрити меню', exact: true })).toBeVisible()
  await page.locator('main').evaluate(element => { element.style.minHeight = '3000px' })
  await page.evaluate(() => window.scrollTo(0, 300))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300)
  // Open from an already-scrolled page, without auto-scrolling the trigger into view.
  await page.getByRole('button', { name: 'Відкрити меню', exact: true }).evaluate((element: HTMLButtonElement) => element.click())
  const menu = page.locator('#backoffice-mobile-menu')
  await expect(menu).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('fixed')
  const mainTop = await page.locator('main').evaluate(element => element.getBoundingClientRect().top)
  await expect.poll(() => menu.evaluate(element => Math.round(element.getBoundingClientRect().bottom))).toBe(700)
  await menu.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect(menu.getByRole('button', { name: 'Вийти', exact: true })).toBeVisible()
  await menu.hover()
  await page.mouse.wheel(0, 2000)
  await expect.poll(() => page.locator('main').evaluate(element => element.getBoundingClientRect().top)).toBe(mainTop)
  await expect(page.getByRole('button', { name: 'Закрити меню', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Закрити меню', exact: true }).click()
  await expect(menu).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300)
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('')

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole('button', { name: 'Відкрити меню', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(menu).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('')
  await page.setViewportSize({ width: 390, height: 700 })
  await page.getByRole('button', { name: 'Відкрити меню', exact: true }).click()
  await menu.getByRole('link', { name: 'Бренди', exact: true }).click()
  await expect(page).toHaveURL(/\/brands$/)
  await expect(menu).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('')
})

test('brands: effective visibility includes all product pages and toggle failures preserve state', async ({ page }) => {
  await installBackend(page)
  const brands = ['Видимий', 'Закрита категорія', 'Закритий предок', 'Неактивні товари', 'Порожній', 'Вручну', 'Змішані категорії']
    .map((name, index) => ({ id: index + 1, name, slug: `brand-${index + 1}`, description: null, is_active: index !== 5 }))
  const product = (brand_id: number, is_active: boolean, hidden_reason: string | null) => ({
    brand_id, is_active, hidden_reason, is_effectively_visible: is_active && hidden_reason === null,
  })
  const productPages = [
    [product(1, false, 'product'), product(2, true, 'category'), product(3, true, 'parent_category'), product(4, false, 'product')],
    [product(1, true, null), product(6, true, null), product(7, true, 'category'), product(7, true, 'parent_category')],
  ]
  const loadedPages: number[] = []
  await page.route('**/backoffice/products?*', route => {
    const currentPage = Number(new URL(route.request().url()).searchParams.get('page'))
    loadedPages.push(currentPage)
    return route.fulfill({ json: { items: productPages[currentPage - 1], total: 8, page: currentPage, page_size: 4 } })
  })
  await page.route('**/backoffice/brands?*', route => route.fulfill({
    json: { items: brands, total: brands.length, page: 1, page_size: 200 },
  }))
  let failUpdate = false
  await page.route('**/backoffice/brands/2', async route => {
    expect(route.request().method()).toBe('PUT')
    if (failUpdate) return route.fulfill({ status: 500, json: { detail: 'Test update failure' } })
    brands[1]!.is_active = route.request().postDataJSON().is_active
    await route.fulfill({ json: brands[1] })
  })

  await page.goto('/brands')
  const card = (name: string) => page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
  await expect(card('Видимий')).toContainText('Показаний у магазині')
  expect(loadedPages).toEqual([1, 2])
  await expect(card('Закрита категорія')).toContainText('Активні товари приховані через закриті категорії.')
  await expect(card('Закритий предок')).toContainText('Активні товари приховані через закриті батьківські категорії.')
  await expect(card('Неактивні товари')).toContainText('Усі товари бренду неактивні.')
  await expect(card('Порожній')).toContainText('У бренду ще немає товарів.')
  await expect(card('Вручну')).toContainText('Приховано вручну.')
  await expect(card('Змішані категорії')).toContainText('закриті категорії та закриті батьківські категорії')

  const categoryCard = card('Закрита категорія')
  await categoryCard.getByText('Показувати бренд', { exact: true }).click()
  await expect(categoryCard.getByRole('switch')).not.toBeChecked()
  await expect(categoryCard).toContainText('Приховано вручну.')
  await expect(categoryCard.getByRole('switch')).toBeEnabled()
  await categoryCard.getByText('Показувати бренд', { exact: true }).click()
  await expect(categoryCard.getByRole('switch')).toBeChecked()
  await expect(categoryCard).toContainText('Прихований у магазині')
  await expect(categoryCard).toContainText('Активні товари приховані через закриті категорії.')

  failUpdate = true
  await expect(categoryCard.getByRole('switch')).toBeEnabled()
  await categoryCard.getByText('Показувати бренд', { exact: true }).click()
  await expect(page.getByText('Test update failure', { exact: true })).toBeVisible()
  await expect(categoryCard.getByRole('switch')).toBeChecked()
  await expect(categoryCard.getByRole('switch')).toBeEnabled()
})

const assertSingleRequest = async (
  requests: Request[],
  path: string,
  before: number,
) => {
  await expect.poll(() => apiRequests(requests, path).length).toBe(before + 1)
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(apiRequests(requests, path)).toHaveLength(before + 1)
  return new URL(apiRequests(requests, path).at(-1)!.url())
}

const selectOption = async (page: Page, panel: ReturnType<Page['locator']>, label: string, option: string) => {
  const trigger = panel.getByRole('button', { name: label, exact: true })
  await trigger.evaluate(element => element.scrollIntoView({ block: 'center' }))
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

const migratedRoutes = [
  '/products',
  '/brands',
  '/categories',
  '/customers',
  '/masters',
  '/services',
  '/promotions',
  '/messaging/templates',
  '/messaging',
  '/reviews',
  '/my-bookings',
  '/my-time-blocks',
  '/bookings',
  '/time-blocks',
  '/admin/dashboards/barbershop',
  '/blog/statistics',
  '/admin/statistics',
] as const

test.describe('migrated filter panels', () => {
  test.beforeEach(async ({ page }) => {
    await installBackend(page)
  })

  test('every migrated route renders a filter panel without browser errors', async ({ page }) => {
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(`page: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`)
    })

    for (const route of migratedRoutes) {
      await test.step(route, async () => {
        errors.length = 0
        await page.goto(route)
        await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}(?:\\?.*)?$`))
        await expect(page.getByTestId('base-filter-panel').first()).toBeVisible()
        await page.waitForTimeout(75)
        expect(errors, `Browser errors on ${route}`).toEqual([])
      })
    }
  })

  test('representative panels remain usable at a mobile viewport', async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 390, height: 844 })
    for (const route of ['/products', '/bookings', '/messaging', '/reviews', '/admin/statistics']) {
      await test.step(route, async () => {
        await page.goto(route)
        const trigger = page.getByTestId('base-filter-trigger').first()
        await expect(trigger).toBeVisible()
        await trigger.click()
        const panelId = await trigger.getAttribute('aria-controls')
        expect(panelId).toBeTruthy()
        const panel = page.locator(`#${panelId}`)
        await expect(panel).toBeVisible()
        await expect(panel).toHaveAttribute('role', 'dialog')
        if (route === '/products') {
          const panelBox = await panel.boundingBox()
          expect(panelBox?.height).toBeCloseTo(844 * 0.9, 0)
        }
        await expect(panel.getByRole('button').first()).toBeVisible()
        await panel.getByRole('button', { name: 'Закрити фільтри' }).click()
        await expect(panel).toBeHidden()
      })
    }
  })
})

test('brands: search filters by name and exposes active mobile state', async ({ page }) => {
  await installBackend(page)
  await page.goto('/brands')
  const panel = page.getByTestId('base-filter-panel')
  const search = panel.getByLabel('Пошук брендів за назвою')

  await expect(page.getByRole('heading', { name: 'Тестовий бренд' })).toBeVisible()
  await search.fill('відсутній')
  await panel.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await expect(page.getByText('Брендів не знайдено')).toBeVisible()
  await expect(page.getByTestId('base-filter-trigger')).toHaveAttribute('data-active', 'true')

  await panel.getByRole('button', { name: 'Очистити', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Тестовий бренд' })).toBeVisible()
})

test('mobile filters: portalled select stays usable and Apply exposes active state', async ({ page }) => {
  const requests: Request[] = []
  await installBackend(page, requests)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/products')

  const trigger = page.getByTestId('base-filter-trigger')
  await trigger.click()
  const panelId = await trigger.getAttribute('aria-controls')
  expect(panelId).toBeTruthy()
  const panel = page.locator(`#${panelId}`)
  await expect.poll(async () => {
    const box = await panel.boundingBox()
    return box ? Math.round(box.y + box.height) : Number.POSITIVE_INFINITY
  }).toBeLessThanOrEqual(845)
  const panelBox = await panel.boundingBox()
  const clearButton = panel.getByRole('button', { name: 'Очистити', exact: true })
  const clearButtonBox = await clearButton.boundingBox()
  expect((panelBox?.y || 0) + (panelBox?.height || 0) - ((clearButtonBox?.y || 0) + (clearButtonBox?.height || 0))).toBeLessThan(48)

  await panel.getByRole('button', { name: 'Категорія', exact: true }).click()
  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  const listboxBox = await listbox.boundingBox()
  expect((listboxBox?.y || 0) + (listboxBox?.height || 0)).toBeLessThanOrEqual(844)
  await listbox.getByRole('option', { name: 'Тестова категорія', exact: true }).click()
  const filteredRequest = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.pathname.endsWith('/backoffice/products') && url.searchParams.get('category_id') === '3'
  })
  await panel.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await filteredRequest

  await expect(panel).toBeHidden()
  await expect(trigger).toHaveAttribute('data-active', 'true')
  await expect(trigger).toContainText('Активні: 1')
  await expect(trigger).toHaveCSS('color', 'rgb(172, 215, 183)')
})

for (const width of [390, 1024]) {
  test(`sticky actions remain accessible while scrolling at ${width}px`, async ({ page }) => {
    await installBackend(page, [])
    await page.route('**/backoffice/products?*', route => route.fulfill({
      json: pageFixture(new URL(route.request().url()), [{
        id: 1, name: 'Тестовий товар', price: 500, stock_quantity: 10, is_active: true,
      }]),
    }))
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/products')
    const table = page.getByRole('table')
    const scroll = page.getByRole('region', { name: 'Каталог товарів' })
    const action = table.getByRole('link', { name: 'Переглянути товар' })
    await expect(action).toBeVisible()
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => document.documentElement.dataset.backofficeTheme = theme, theme)
      for (const fraction of [0, 0.5, 1]) {
        await scroll.evaluate((element, fraction) => {
          element.scrollLeft = (element.scrollWidth - element.clientWidth) * fraction
        }, fraction)
        const bounds = await scroll.boundingBox()
        expect(bounds).not.toBeNull()
        for (const cell of [table.locator('thead th').last(), table.locator('tbody tr').first().locator('td').last()]) {
          const box = await cell.boundingBox()
          expect(box).not.toBeNull()
          expect(Math.abs(box!.x + box!.width - (bounds!.x + bounds!.width))).toBeLessThan(3)
          await expect(cell).toHaveCSS('background-color', theme === 'dark' ? 'rgb(17, 17, 17)' : 'rgb(255, 255, 255)')
        }
        await action.click({ trial: true })
      }
    }
    await page.screenshot({ path: `/tmp/backoffice-sticky-actions-${width}.png` })
  })
}

test('products: Apply, Enter, pagination reset and Clear keep the request contract', async ({ page }) => {
  const requests: Request[] = []
  await installBackend(page, requests)
  await page.goto('/products')
  const panel = page.getByTestId('base-filter-panel')
  const search = panel.getByLabel('Пошук товарів за назвою')
  await expect(panel.getByRole('button', { name: 'Застосувати', exact: true })).toBeEnabled()
  await expect.poll(() => apiRequests(requests, '/backoffice/products').length).toBeGreaterThanOrEqual(1)

  let before = apiRequests(requests, '/backoffice/products').length
  await page.getByRole('button', { name: 'Наступна', exact: true }).click()
  let requestUrl = await assertSingleRequest(requests, '/backoffice/products', before)
  expect(requestUrl.searchParams.get('page')).toBe('2')

  await search.fill('pomade')
  before = apiRequests(requests, '/backoffice/products').length
  await panel.getByRole('button', { name: 'Застосувати', exact: true }).click()
  requestUrl = await assertSingleRequest(requests, '/backoffice/products', before)
  expect(requestUrl.searchParams.get('page')).toBe('1')
  expect(requestUrl.searchParams.get('search')).toBe('pomade')

  await search.fill('clay')
  before = apiRequests(requests, '/backoffice/products').length
  await search.press('Enter')
  requestUrl = await assertSingleRequest(requests, '/backoffice/products', before)
  expect(requestUrl.searchParams.get('search')).toBe('clay')

  before = apiRequests(requests, '/backoffice/products').length
  await panel.getByRole('button', { name: 'Очистити', exact: true }).click()
  requestUrl = await assertSingleRequest(requests, '/backoffice/products', before)
  expect(requestUrl.searchParams.get('page')).toBe('1')
  expect(requestUrl.searchParams.has('search')).toBe(false)
  await expect(search).toHaveValue('')
})

test('bookings: master filter and Clear update calendar parameters', async ({ page }) => {
  const requests: Request[] = []
  await installBackend(page, requests)
  await page.goto('/bookings')
  const panel = page.getByTestId('base-filter-panel')
  await expect(panel.getByRole('button', { name: 'Застосувати', exact: true })).toBeEnabled()

  const masterTrigger = panel.locator('.base-select__trigger').filter({ hasText: 'Усі майстри' })
  const selectedRequest = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.pathname.endsWith('/backoffice/calendar/bookings') && url.searchParams.get('master_id') === '7'
  })
  await masterTrigger.click()
  await page.getByRole('option').filter({ hasText: 'Тест Майстер' }).click()
  const selectedUrl = new URL((await selectedRequest).url())
  expect(selectedUrl.searchParams.get('date_from')).toBeTruthy()
  expect(selectedUrl.searchParams.get('date_to')).toBeTruthy()

  const statusTrigger = panel.locator('.base-select__trigger').filter({ hasText: 'Будь-який статус' })
  await statusTrigger.evaluate(element => element.scrollIntoView({ block: 'center' }))
  await statusTrigger.click()
  await page.getByRole('option').filter({ hasText: 'Очікує підтвердження' }).click()

  const applied = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.pathname.endsWith('/backoffice/calendar/bookings') && url.searchParams.get('master_id') === '7'
  })
  await panel.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await applied
  await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('pending')

  const cleared = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.pathname.endsWith('/backoffice/calendar/bookings') && !url.searchParams.has('master_id')
  })
  await panel.getByRole('button', { name: 'Очистити', exact: true }).click()
  await cleared
  await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBeNull()
  await expect(masterTrigger).toContainText('Усі майстри')
})

test('messaging: campaign status Apply and Clear reset page and stale params', async ({ page }) => {
  const requests: Request[] = []
  await installBackend(page, requests)
  await page.goto('/messaging')
  const section = page.locator('#campaigns')
  const panel = section.getByTestId('base-filter-panel')
  const mainCampaignRequests = () => apiRequests(requests, '/backoffice/messaging/campaigns')
    .filter(request => !new URL(request.url()).searchParams.has('recipient'))
  await expect(panel.getByRole('button', { name: 'Застосувати', exact: true })).toBeEnabled()
  await expect.poll(() => mainCampaignRequests().length).toBeGreaterThanOrEqual(1)

  let before = mainCampaignRequests().length
  await section.getByRole('button', { name: 'Наступна', exact: true }).click()
  await expect.poll(() => mainCampaignRequests().length).toBe(before + 1)
  expect(new URL(mainCampaignRequests().at(-1)!.url()).searchParams.get('page')).toBe('2')

  await selectOption(page, panel, 'Статус кампанії', 'Чернетка')
  before = mainCampaignRequests().length
  await panel.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await expect.poll(() => mainCampaignRequests().length).toBe(before + 1)
  let requestUrl = new URL(mainCampaignRequests().at(-1)!.url())
  expect(requestUrl.searchParams.get('page')).toBe('1')
  expect(requestUrl.searchParams.get('status')).toBe('draft')
  await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('draft')

  before = mainCampaignRequests().length
  await panel.getByRole('button', { name: 'Очистити', exact: true }).click()
  await expect.poll(() => mainCampaignRequests().length).toBe(before + 1)
  requestUrl = new URL(mainCampaignRequests().at(-1)!.url())
  expect(requestUrl.searchParams.get('page')).toBe('1')
  expect(requestUrl.searchParams.has('status')).toBe(false)
  await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBeNull()
})

test('reviews: list filter Apply and Clear reset pagination and query parameters', async ({ page }) => {
  const requests: Request[] = []
  await installBackend(page, requests)
  await page.goto('/reviews')
  const listPanel = page.getByTestId('base-filter-panel').filter({ has: page.getByRole('button', { name: 'Очистити', exact: true }) })
  await expect(listPanel.getByRole('button', { name: 'Застосувати', exact: true })).toBeEnabled()
  await expect.poll(() => apiRequests(requests, '/backoffice/reviews').length).toBeGreaterThanOrEqual(1)

  let before = apiRequests(requests, '/backoffice/reviews').length
  await page.getByRole('button', { name: 'Далі', exact: true }).click()
  let requestUrl = await assertSingleRequest(requests, '/backoffice/reviews', before)
  expect(requestUrl.searchParams.get('page')).toBe('2')

  await selectOption(page, listPanel, 'Статус модерації відгуку', 'Очікує модерації')
  before = apiRequests(requests, '/backoffice/reviews').length
  await listPanel.getByRole('button', { name: 'Застосувати', exact: true }).click()
  requestUrl = await assertSingleRequest(requests, '/backoffice/reviews', before)
  expect(requestUrl.searchParams.get('page')).toBe('1')
  expect(requestUrl.searchParams.get('moderation_status')).toBe('pending')
  await expect.poll(() => new URL(page.url()).searchParams.get('moderation_status')).toBe('pending')

  before = apiRequests(requests, '/backoffice/reviews').length
  await listPanel.getByRole('button', { name: 'Очистити', exact: true }).click()
  requestUrl = await assertSingleRequest(requests, '/backoffice/reviews', before)
  expect(requestUrl.searchParams.get('page')).toBe('1')
  expect(requestUrl.searchParams.has('moderation_status')).toBe(false)
  await expect.poll(() => new URL(page.url()).searchParams.get('moderation_status')).toBeNull()
})

test('statistics: month selection auto-applies and refresh preserves parameters', async ({ page }) => {
  const requests: Request[] = []
  await installBackend(page, requests)
  await page.goto('/admin/statistics')
  const panel = page.getByTestId('base-filter-panel')
  const refreshButton = panel.getByRole('button', { name: 'Оновити', exact: true })
  await expect(refreshButton).toBeEnabled()
  await expect.poll(() => apiRequests(requests, '/backoffice/statistics/admin/monthly').length).toBeGreaterThanOrEqual(1)

  const beforeSelection = apiRequests(requests, '/backoffice/statistics/admin/monthly').length
  await panel.locator('.base-select__trigger').first().click()
  await page.getByRole('option', { name: 'Січень', exact: true }).click()
  await expect.poll(() => apiRequests(requests, '/backoffice/statistics/admin/monthly').length).toBe(beforeSelection + 1)
  let requestUrl = new URL(apiRequests(requests, '/backoffice/statistics/admin/monthly').at(-1)!.url())
  expect(requestUrl.searchParams.get('month')).toBe('1')

  const beforeRefresh = apiRequests(requests, '/backoffice/statistics/admin/monthly').length
  await refreshButton.click()
  await expect.poll(() => apiRequests(requests, '/backoffice/statistics/admin/monthly').length).toBe(beforeRefresh + 1)
  requestUrl = new URL(apiRequests(requests, '/backoffice/statistics/admin/monthly').at(-1)!.url())
  expect(requestUrl.searchParams.get('month')).toBe('1')
  expect(requestUrl.searchParams.get('year')).toMatch(/^20\d{2}$/)
})
