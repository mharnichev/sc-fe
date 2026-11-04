import { expect, test, type Page } from '@playwright/test'
const startDate = '2026-11-03'
const service = (id: number, base: number, duration = 30) => ({ id, base_service_id: base, name: base === 1 ? 'Стрижка тестова' : 'Борода тестова', title_uk: base === 1 ? 'Стрижка тестова' : 'Борода тестова', price: '500', duration_minutes: duration, description: '', is_active: true })
const masters = [
  { id: 91001, name: 'Олександр Тест', full_name_uk: 'Олександр Тест', is_active: true, services: [service(91101, 1), service(91102, 2)] },
  { id: 91002, name: 'Гліб Тест', full_name_uk: 'Гліб Тест', is_active: true, services: [service(91201, 1, 45), service(91202, 2)] },
]
const catalog = [1, 2].map(base => ({ ...service(base, base), catalog_id: `base-${base}`, source_type: 'base', barber_services: masters.map(master => ({ ...master.services[base - 1], barber_id: master.id })) }))
type Options = { empty?: boolean, fail?: boolean, hold?: Promise<void>, rangeFail?: boolean, promotion?: boolean, quoteHold?: Promise<void>, homeHash?: boolean }
async function setup(page: Page, options: Options = {}) {
  await page.clock.install({ time: new Date('2026-11-03T10:00:00+02:00') })
  const quoteCalls: any[] = []
  const observations: any[] = [], events: any[] = [], writes: string[] = [], ranges: URL[] = []
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (url.origin !== 'http://127.0.0.1:3313') return route.abort()
    if (!path.startsWith('/api/v1/')) return route.continue()
    if (path.endsWith('/booking-funnel/observations')) { observations.push(req.postDataJSON()); return route.fulfill({ status: 202, json: { status: 'recorded' } }) }
    if (path.endsWith('/booking-funnel/events') || path.endsWith('/booking-recovery/events')) { events.push(req.postDataJSON()); return route.fulfill({ status: 202, json: { status: 'recorded' } }) }
    if (path.endsWith('/booking-alternatives')) return route.fulfill({ json: { same_master: [], other_masters: [], search_context_id: 'fixture-search-12345', next_offset: null } })
    if (path.endsWith('/public/bookings/quote')) {
      quoteCalls.push(req.postDataJSON())
      if (options.quoteHold) await options.quoteHold
      return route.fulfill({ json: options.promotion
        ? { subtotal_amount: 1200, discount_amount: 240, total_amount: 960, applied_promotion: { id: 91999, code: null, name_uk: 'Перший візит', name_en: 'First visit', discount_percent: 20, application_mode: 'automatic', eligibility_type: 'first_visit' }, eligibility: { status: 'applied', explanation: 'Fixture eligibility verified' } }
        : { subtotal_amount: 1000, discount_amount: 0, total_amount: 1000, applied_promotion: null, eligibility: { status: 'not_available', explanation: 'Fixture regular price' } } })
    }
    if (req.method() !== 'GET') { writes.push(path); return route.fulfill({ status: 403, json: {} }) }
    if (path.endsWith('/service-catalog')) return route.fulfill({ json: options.promotion ? catalog.map(item => ({ ...item, price: '600', barber_services: item.barber_services.map(service => ({ ...service, price: '600' })) })) : catalog })
    if (path.endsWith('/masters')) return route.fulfill({ json: options.promotion ? masters.map(master => ({ ...master, services: master.services.map(service => ({ ...service, price: '600' })) })) : masters })
    if (path.endsWith('/availability-range')) {
      ranges.push(url)
      if (options.rangeFail) return route.fulfill({ status: 503, json: {} })
      const days = []
      for (let date = url.searchParams.get('start_date')!; date <= url.searchParams.get('end_date')!;) {
        days.push({ date, status: !options.promotion && path.includes('/91001/') ? 'unavailable' : 'available' })
        date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)
      }
      return route.fulfill({ json: { days } })
    }
    if (path.endsWith('/available-slots')) {
      if (options.hold) await options.hold
      if (options.fail) return route.fulfill({ status: 503, json: {} })
      const date = url.searchParams.get('date') || startDate
      return route.fulfill({ json: options.empty ? [] : [{ start_at: `${date}T15:07:00+02:00`, end_at: `${date}T16:22:00+02:00` }] })
    }
    return route.fulfill({ json: [] })
  })
  await page.goto(options.homeHash ? '/#booking' : '/booking')
  const form = page.locator('#regular-booking-service').locator('..').locator('..')
  await page.locator('.booking-service__item').filter({ hasText: 'Стрижка тестова' }).getByRole('button').first().click()
  await page.locator('.booking-service__item').filter({ hasText: 'Борода тестова' }).getByRole('button').first().click()
  await page.locator('.booking-step-actions').getByRole('button', { name: 'Обрати майстра', exact: true }).click()
  await expect(page.getByRole('button', { name: /Олександр Тест/ })).toBeVisible()
  return { observations, events, writes, ranges, form, quoteCalls }
}
for (const width of [390, 1440]) {
  test(`availability is honest before selection and Next requires slot at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    let release!: () => void
    const hold = new Promise<void>(resolve => { release = resolve })
    const h = await setup(page, { hold })
    await expect(page.getByRole('button', { name: /Олександр Тест/ })).toContainText('Немає відповідного вільного часу')
    await expect(page.getByRole('button', { name: /Гліб Тест/ })).toContainText('Є відповідний вільний час')
    expect(h.ranges).toHaveLength(2)
    const second = h.ranges.find(url => url.pathname.includes('/91002/'))!
    expect(second.searchParams.get('duration_minutes')).toBe('75')
    expect(second.searchParams.getAll('service_ids')).toEqual(['91201', '91202'])
    await page.getByRole('button', { name: /Гліб Тест/ }).focus()
    await page.keyboard.press('Enter')
    const next = page.locator('.booking-step-actions').getByRole('button', { name: /^(Далі|Наступний крок)$/ })
    await expect(next).toBeDisabled()
    await expect(next).toHaveAttribute('aria-describedby', 'regular-booking-time-guidance')
    await expect(page.locator('#regular-booking-time-guidance')).toBeVisible()
    release()
    await page.getByRole('button', { name: '15:07', exact: true }).click()
    await expect(page.locator('#regular-booking-contact')).toBeVisible()
    const book = page.locator('.booking-step-actions').getByRole('button').last()
    await expect(book).toBeDisabled()
    await page.getByRole('textbox', { name: 'Ім’я', exact: true }).fill('А')
    await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill('+380501234567')
    await expect(book).toBeDisabled()
    await page.getByRole('textbox', { name: 'Ім’я', exact: true }).fill('Тестовий Клієнт')
    await expect(book).toBeEnabled()
    await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill('123')
    await expect(book).toBeDisabled()
    await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill('+380501234567')
    await expect(book).toBeEnabled()
    await page.locator('.booking-step-actions').getByRole('button', { name: /Назад/ }).click()
    await expect(page.getByRole('button', { name: '15:07', exact: true })).toBeVisible()
    await expect.poll(() => h.observations.filter(e => e.event_type === 'time_step_viewed').length).toBe(2)
    expect(h.observations.some(e => e.event_type === 'availability_result' && e.slot_count === 1)).toBe(true)
    await page.screenshot({ path: `output/booking-statistics/public-${width}.png`, fullPage: true })
    expect(h.writes).toEqual([])
  })
}
test('default initial empty produces result zero, guidance and existing waitlist, not fake legacy no_slot', async ({ page }) => {
  const h = await setup(page, { empty: true })
  await page.getByRole('button', { name: /Олександр Тест/ }).click()
  await expect(page.locator('.booking-step-actions').getByRole('button', { name: /^(Далі|Наступний крок)$/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Повідомити мене, якщо звільниться вікно', exact: true })).toBeVisible()
  await expect.poll(() => h.observations.some(e => e.event_type === 'availability_result' && e.slot_count === 0 && e.trigger === 'initial')).toBe(true)
  expect(h.events.some(e => e.event_type === 'no_slot')).toBe(false)
  await page.getByRole('button', { name: 'Повідомити мене, якщо звільниться вікно', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Стати в лист очікування', exact: true })).toBeVisible()
  expect(h.writes).toEqual([])
})
test('request failure is distinct from empty and retry recovers', async ({ page }) => {
  const options = { fail: true, rangeFail: true }
  const h = await setup(page, options)
  await expect(page.getByRole('button', { name: /Олександр Тест/ })).toContainText('Не вдалося перевірити час')
  await page.getByRole('button', { name: /Олександр Тест/ }).click()
  await expect(page.getByText('Не вдалося завантажити слоти.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Повідомити мене, якщо звільниться вікно', exact: true })).toHaveCount(0)
  options.fail = false
  await page.getByRole('button', { name: 'Спробувати ще раз', exact: true }).click()
  await expect(page.getByRole('button', { name: '15:07', exact: true })).toBeVisible()
  await expect.poll(() => h.observations.some(e => e.event_type === 'availability_failed' && e.error_code === 'http_5xx')).toBe(true)
  expect(h.writes).toEqual([])
})

for (const width of [390, 1440]) for (const change of ['back', 'master', 'date']) {
  test(`applied promotion leaves accessibility promptly on ${change} at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const options: Options = { promotion: true }
    const h = await setup(page, options)
    await page.getByRole('button', { name: /Гліб Тест/ }).click()
    await page.getByRole('button', { name: '15:07', exact: true }).click()
    await page.getByRole('textbox', { name: 'Ім’я', exact: true }).fill('Тестовий Клієнт')
    await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill('+380501234567')
    const panel = page.locator('.booking-price-review--promotion')
    await expect(panel.locator('del')).toHaveText(/1[\s\u00a0\u202f]?200/)
    await expect(panel.locator('strong')).toHaveText(/960/)
    await expect(page.locator('.booking-step-actions').getByRole('button').last()).toBeEnabled()
    const motion = await panel.evaluate(element => ({ animationName: getComputedStyle(element).animationName, animationDuration: getComputedStyle(element).animationDuration, animationIterationCount: getComputedStyle(element).animationIterationCount, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }))
    expect(motion.animationName).toMatch(/^booking-price-background(?:-[a-f0-9]+)?$/)
    expect(motion).toMatchObject({ animationDuration: '14s', animationIterationCount: 'infinite', reducedMotion: false })
    await info.attach('applied-quote-normal-motion.json', { body: JSON.stringify({ subtotal: 1200, discount: 240, total: 960, ...motion }), contentType: 'application/json' })
    await page.locator('.booking-step-actions').getByRole('button', { name: 'Назад', exact: true }).click()
    // Opacity/height alone must not retain an obsolete price in the accessibility tree.
    await expect.poll(async () => (await page.locator('body').ariaSnapshot()).includes('До сплати'), { timeout: 1200 }).toBe(false)
    await expect(page.locator('.booking-price-review')).toHaveCount(0, { timeout: 1200 })
    const previousQuotes = h.quoteCalls.length
    let release!: () => void
    options.quoteHold = new Promise<void>(resolve => { release = resolve })
    try {
      if (change === 'master') {
        await page.getByRole('button', { name: 'Майстер', exact: true }).click()
        await page.getByRole('button', { name: /Олександр Тест/ }).focus()
        await page.keyboard.press('Enter')
        await expect(page.locator('.booking-step-actions').getByRole('button', { name: /^(Далі|Наступний крок)$/ })).toBeDisabled()
      }
      if (change === 'date') {
        await page.getByRole('button', { name: /^середа, 4 листопада 2026/ }).click()
        await expect(page.locator('.booking-step-actions').getByRole('button', { name: /^(Далі|Наступний крок)$/ })).toBeDisabled()
        await expect.poll(() => h.observations.some(event => event.event_type === 'availability_result' && event.target_date === '2026-11-04')).toBe(true)
      }
      await page.getByRole('button', { name: '15:07', exact: true }).click()
      if (change === 'back') await page.getByRole('textbox', { name: 'Телефон', exact: true }).fill('+380501234568')
      await expect.poll(() => h.quoteCalls.length).toBeGreaterThan(previousQuotes)
      await expect(page.locator('.booking-step-actions').getByRole('button').last()).toBeDisabled()
      await expect(page.locator('.booking-price-review').getByRole('status')).toContainText('Перевіряємо доступність знижки та ціну')
      await expect(page.locator('.booking-price-review strong')).toHaveCount(0, { timeout: 1200 })
      await expect.poll(async () => (await page.locator('body').ariaSnapshot()).includes('До сплати'), { timeout: 1200 }).toBe(false)
      const fresh = h.quoteCalls.at(-1)
      expect(fresh.service_ids).toHaveLength(2)
      if (change === 'master') expect(fresh.master_id).toBe(91001)
      if (change === 'date') expect(fresh.start_at).toContain('2026-11-04')
    }
    finally { release() }
    await expect(page.locator('.booking-price-review--promotion strong')).toHaveText(/960/)
    await expect(page.locator('.booking-step-actions').getByRole('button').last()).toBeEnabled()
    expect(h.writes).toEqual([])
  })
}

for (const width of [390, 1440]) {
  test(`home booking calendar input cancels app anchor scrolling at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.addInitScript(() => {
      const probe = { calls: [] as Array<{ target: string, at: number }> }
      ;(window as any).__bookingAnchorProbe = probe
      const original = Element.prototype.scrollIntoView
      Element.prototype.scrollIntoView = function (options) {
        if (this.matches('.booking-section:not(.booking-section--drawer), #booking-stepper, #team, #reviews')) {
          probe.calls.push({ target: this.id || 'booking', at: performance.now() })
        }
        return original.call(this, options)
      }
    })
    const h = await setup(page, { homeHash: true, promotion: true })
    await page.getByRole('button', { name: /Гліб Тест/ }).click()
    await expect(page.getByRole('button', { name: '15:07', exact: true })).toBeVisible()
    if (width < 768) await page.getByRole('button', { name: /^Обрана дата/ }).click()
    await page.evaluate(() => { (window as any).__bookingAnchorProbe.calls = [] })
    await page.getByRole('button', { name: /^середа, 4 листопада 2026/ }).click()
    await expect.poll(() => h.observations.some(event => event.event_type === 'availability_result' && event.target_date === '2026-11-04')).toBe(true)
    // Advance two known 100ms retry turns plus a frame, rather than sleeping or
    // suppressing scrolling. CSS motion stays enabled and the native method runs.
    await page.clock.runFor(250)
    const calls = await page.evaluate(() => (window as any).__bookingAnchorProbe.calls)
    await info.attach('post-calendar-anchor-calls.json', { body: JSON.stringify(calls), contentType: 'application/json' })
    expect(calls).toEqual([])
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false)
    await expect(page.getByRole('button', { name: '15:07', exact: true })).toBeVisible()
    expect(h.writes).toEqual([])
  })
}
