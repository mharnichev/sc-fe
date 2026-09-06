import { expect, test, type Page, type APIRequestContext } from '@playwright/test'

// Opt-in real integration. No successful segment/campaign response is mocked.
// Start e2e/support/segments-sandbox.py and the UI with its API base, then run:
// SEGMENTS_SANDBOX_URL=http://127.0.0.1:58001 PLAYWRIGHT_PORT=4041 pnpm test:e2e customer-segments
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const sandboxURL = env.SEGMENTS_SANDBOX_URL || ''
test.skip(!sandboxURL, 'Requires the disposable real FastAPI/PostgreSQL sandbox; never falls back to the configured backend.')

async function connect(page: Page, request: APIRequestContext) {
  expect(new URL(sandboxURL).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/)
  const response = await request.get(`${sandboxURL}/__sandbox`)
  expect(response.ok()).toBeTruthy()
  const state = await response.json()
  expect(state.sandbox).toBe(true)
  expect(state.schema).toMatch(/^segments_browser_test_/)
  await page.addInitScript(state => {
    window.localStorage.setItem('soulcuts-backoffice-theme', 'light')
    window.localStorage.setItem('backoffice-auth', JSON.stringify({
      accessToken: state.access_token, refreshToken: 'sandbox-unused', user: state.user,
    }))
  }, state)
  return {
    headers: { Authorization: `Bearer ${state.access_token}` },
    root: `${sandboxURL}/api/v1/backoffice`,
  }
}

const rules = {
  combine: 'all',
  conditions: [{ type: 'last_visit_age', min: 3, max: 12, unit: 'calendar_months' }],
  exclusions: [{ type: 'upcoming_booking', present: true }],
}

test('real backend: validation, deduplicated reachability, draft safety, sandbox run and immutable archived history', async ({ page, request }, testInfo) => {
  const { root, headers } = await connect(page, request)
  const invalid = await request.post(`${root}/segments/preview`, {
    headers, data: { rules: { ...rules, conditions: [{ ...rules.conditions[0], min: 12, max: 3 }] } },
  })
  expect(invalid.status()).toBe(422)
  const create = await request.post(`${root}/segments`, { headers, data: { name: `API sandbox ${Date.now()}`, rules } })
  expect(create.status()).toBe(201)
  const segment = await create.json()
  const members = await (await request.get(`${root}/segments/${segment.id}/members?limit=2`, { headers })).json()
  expect(members.total).toBe(3)
  expect(members.items).toHaveLength(2)
  const rest = await (await request.get(`${root}/segments/${segment.id}/members`, {
    headers, params: { limit: 2, offset: 2, evaluated_at: members.evaluated_at },
  })).json()
  expect(rest.evaluated_at).toBe(members.evaluated_at)
  const names = [...members.items, ...rest.items].map(member => member.name)
  expect(names).toEqual(['Sandbox completed', 'Sandbox imported', 'Sandbox opted out'])
  expect(members.items[0].conditions[0].matched).toBe(true)
  const draftResponse = await request.post(`${root}/messaging/campaigns`, { headers, data: {
    name: `API sandbox campaign ${Date.now()}`, type: 'manual', purpose: 'marketing', channel: 'telegram',
    segment_ids: [segment.id], channel_strategy: 'telegram_then_sms',
    metadata_json: { message_body: 'Sandbox {{client_name}}' },
  } })
  expect(draftResponse.status()).toBe(201)
  const draft = await draftResponse.json()
  expect(draft.status).toBe('draft')
  const emptyRuns = await (await request.get(`${root}/messaging/campaigns/${draft.id}/runs`, { headers })).json()
  expect(emptyRuns.total).toBe(0)
  const audience = await (await request.post(`${root}/messaging/campaigns/${draft.id}/audience-preview`, { headers })).json()
  expect(audience.total).toBe(3)
  expect(audience.items.filter((item: { eligible: boolean }) => item.eligible)).toHaveLength(2)
  expect(audience.items.find((item: { name: string }) => item.name === 'Sandbox opted out').exclusion_reason).toBeTruthy()
  // Only this explicitly guarded test-only harness can process messages.
  const runResponse = await request.post(`${root}/messaging/campaigns/${draft.id}/runs`, {
    headers, data: { idempotency_key: `browser-sandbox-${Date.now()}` },
  })
  expect(runResponse.status()).toBe(201)
  const run = await runResponse.json()
  expect(run.audience_count).toBe(3)
  await request.post(`${sandboxURL}/__sandbox/process`)
  const detail = await (await request.get(`${root}/messaging/campaigns/${draft.id}/runs/${run.id}`, { headers })).json()
  expect(detail.delivery_counts.sent).toBe(2)
  expect(detail.delivery_counts.skipped).toBe(1)
  const edit = await request.patch(`${root}/segments/${segment.id}`, { headers, data: { name: 'Edited after snapshot', expected_revision: 1 } })
  expect(edit.status()).toBe(200)
  expect((await request.patch(`${root}/segments/${segment.id}`, { headers, data: { name: 'Stale', expected_revision: 1 } })).status()).toBe(409)
  expect((await request.post(`${root}/segments/${segment.id}/archive`, { headers })).ok()).toBeTruthy()
  const snapshot = await (await request.get(`${root}/messaging/campaigns/${draft.id}/runs/${run.id}`, { headers })).json()
  expect(snapshot.segment_snapshots[0].revision).toBe(1)
  expect(snapshot.segment_snapshots[0].name).toBe(segment.name)
  await page.goto(`/messaging/campaigns/${draft.id}`)
  await expect(page.getByText(draft.name, { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: `Переглянути запуск ${run.id}`, exact: true }).click()
  await expect(page.getByRole('heading', { name: `Запуск #${run.id} · незмінний знімок`, exact: true })).toBeVisible()
  await expect(page.getByText(`${segment.name} · зафіксована версія 1`, { exact: true })).toBeVisible()
  const snapshotArticle = page.locator('article').filter({ has: page.getByRole('heading', { name: `Запуск #${run.id} · незмінний знімок`, exact: true }) })
  await expect(snapshotArticle.getByText('Надіслано (прийнято провайдером)', { exact: true }).first().locator('..')).toContainText('2')
  await expect(snapshotArticle.getByText('Пропущено', { exact: true }).first().locator('..')).toContainText('1')
  await page.screenshot({ path: testInfo.outputPath('sandbox-run-snapshot-desktop.png'), fullPage: true, animations: 'disabled' })
})

test('real backend browser: historical campaigns and event notifications remain separate', async ({ page, request }) => {
  await connect(page, request)
  await page.goto('/messaging/campaigns')
  await expect(page.getByText('Sandbox legacy campaign', { exact: true })).toBeVisible()
  await expect(page.getByText('Sandbox booking notification', { exact: true })).toHaveCount(0)
  await page.goto('/messaging/notifications')
  await expect(page.getByText('Sandbox booking notification', { exact: true })).toBeVisible()
  await expect(page.getByText('Sandbox legacy campaign', { exact: true })).toHaveCount(0)
})

test('real backend browser: editing an existing inline campaign preserves its audience and metadata', async ({ page, request }) => {
  const { root, headers } = await connect(page, request)
  const response = await request.post(`${root}/messaging/campaigns`, { headers, data: {
    name: `Legacy edit ${Date.now()}`, type: 'manual', channel: 'telegram',
    audience: { inactive_days: 45, barber_ids: [1], limit: 10 },
    metadata_json: { message_body: 'Original sandbox text', sandbox_preserved: 'keep this value' },
  } })
  expect(response.status()).toBe(201)
  const original = await response.json()
  const persistedBeforeEdit = await (await request.get(`${root}/messaging/campaigns/${original.id}`, { headers })).json()
  await page.goto(`/messaging/campaigns/${original.id}`)
  await page.getByLabel('Повідомлення', { exact: true }).fill('Edited sandbox text')
  await page.getByRole('button', { name: 'Зберегти зміни', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Зберегти зміни', exact: true })).toBeDisabled()
  const updated = await (await request.get(`${root}/messaging/campaigns/${original.id}`, { headers })).json()
  expect(updated.audience).toEqual(persistedBeforeEdit.audience)
  expect(updated.metadata_json.sandbox_preserved).toBe('keep this value')
  expect(updated.metadata_json.message_body).toBe('Edited sandbox text')
})

test('real backend browser: starter audience, inclusion reasons, save, edit and segment-to-campaign draft entry', async ({ page, request }, testInfo) => {
  test.setTimeout(60_000)
  await connect(page, request)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/customers/segments/new')
  const name = `Browser segment ${Date.now()}`
  await expect(page.getByRole('checkbox', { name: 'Виключити клієнтів із майбутніми записами', exact: true })).toBeChecked()
  await page.getByRole('textbox', { name: 'Назва сегмента', exact: true }).fill(name)
  await page.getByRole('button', { name: 'Оцінити аудиторію', exact: true }).click()
  await expect(page.getByText('Sandbox completed', { exact: true })).toBeVisible()
  await expect(page.getByText('Sandbox imported', { exact: true })).toBeVisible()
  await expect(page.getByText('Sandbox opted out', { exact: true })).toBeVisible()
  await expect(page.getByText('Sandbox upcoming', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Sandbox unknown', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Не вдалося завантажити всі довідники майстрів, послуг або кампаній.', { exact: true })).toHaveCount(0)
  await page.getByText('Факти та умови клієнта #1', { exact: true }).click()
  await expect(page.getByText(/Виключення не спрацювало:/).first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('segment-preview-desktop.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Зберегти сегмент', exact: true }).click()
  await expect(page).toHaveURL(/\/customers\/segments\/\d+$/)
  const segmentURL = page.url()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  await expect(page.getByText('Клієнтів в аудиторії: 3', { exact: true })).toBeVisible()
  await expect(page.getByText('Шукаємо кампанії…', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Світла тема', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('segment-detail-mobile.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('link', { name: 'Створити кампанію', exact: true }).click()
  await expect(page).toHaveURL(/\/messaging\/campaigns\/new\?.*segment/)
  await page.getByLabel('Назва кампанії', { exact: true }).fill(`Campaign for ${name}`)
  await page.getByRole('button', { name: 'Далі', exact: true }).click()
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked()
  await page.getByRole('combobox', { name: 'Стратегія каналів', exact: true }).selectOption('telegram_then_sms')
  await page.getByRole('button', { name: 'Далі', exact: true }).click()
  await page.getByRole('textbox', { name: /^Текст/ }).fill('Sandbox {{client_name}}, welcome back')
  await page.getByRole('button', { name: /^(?:Крок )?6(?::|\s|$)/ }).click()
  await page.getByRole('button', { name: 'Зберегти чернетку', exact: true }).click()
  await expect(page).toHaveURL(/\/messaging\/campaigns\/\d+$/)
  await page.getByRole('button', { name: 'Перевірити отримувачів', exact: true }).click()
  await expect(page.getByText('Загальна аудиторія без дублікатів', { exact: true })).toBeVisible()
  await expect(page.getByText('Sandbox completed', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: testInfo.outputPath('campaign-audience-desktop.png'), fullPage: true, animations: 'disabled' })
  await page.goto(segmentURL)
  await page.getByRole('link', { name: 'Редагувати', exact: true }).click()
  await page.getByLabel('Опис', { exact: true }).fill('Edited in a real browser')
  await page.getByRole('button', { name: 'Зберегти сегмент', exact: true }).click()
  await expect(page.getByText('Edited in a real browser', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Дублювати', exact: true }).click()
  await page.getByRole('button', { name: 'Зберегти сегмент', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${name} — копія`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Архівувати', exact: true }).click()
  await page.getByRole('button', { name: 'Архівувати сегмент', exact: true }).click()
  await expect(page.getByText('Архівний', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Створити кампанію', exact: true })).toHaveCount(0)
})

test('real backend browser: keyboard validation, loading, stale responses, empty audiences and injected network failure', async ({ page, request }) => {
  await connect(page, request)
  await page.goto('/customers/segments/new')
  await page.getByRole('button', { name: 'Зберегти сегмент', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Вкажіть назву сегмента.', { exact: true })).toBeVisible()
  const minimum = page.getByLabel('Нижня межа (необов’язково)', { exact: true })
  const maximum = page.getByLabel('Верхня межа (необов’язково)', { exact: true })
  await minimum.fill('13')
  await expect(page.getByRole('button', { name: 'Оцінити аудиторію', exact: true })).toBeDisabled()
  await minimum.fill('3')

  let releaseFirst!: () => void
  const firstMayFinish = new Promise<void>(resolve => { releaseFirst = resolve })
  let firstReachedBackend!: () => void
  const reachedBackend = new Promise<void>(resolve => { firstReachedBackend = resolve })
  let previewRequests = 0
  let finishedResponses = 0
  await page.route('**/backoffice/segments/preview', async route => {
    previewRequests += 1
    const response = await route.fetch() // Real backend computes all successful data.
    if (previewRequests === 1) {
      firstReachedBackend()
      await firstMayFinish
    }
    await route.fulfill({ response })
    finishedResponses += 1
  })
  await page.getByRole('button', { name: 'Оцінити аудиторію', exact: true }).click()
  await reachedBackend
  await expect(page.getByText('Оцінюємо аудиторію…', { exact: true })).toBeVisible()
  await maximum.fill('36')
  await minimum.fill('24')
  await page.getByRole('button', { name: 'Оцінити аудиторію', exact: true }).click()
  await expect(page.getByText('Клієнтів в аудиторії: 0', { exact: true })).toBeVisible()
  releaseFirst()
  await expect.poll(() => finishedResponses).toBe(2)
  await expect(page.getByText('Sandbox completed', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Клієнтів в аудиторії: 0', { exact: true })).toBeVisible()
  expect(previewRequests).toBe(2)
  await page.unroute('**/backoffice/segments/preview')
  // Failure injection is deliberately labelled; it supplies no successful data.
  await page.route('**/backoffice/segments/preview', route => route.fulfill({ status: 503, json: { detail: 'Injected sandbox preview outage' } }))
  await page.getByRole('button', { name: 'Оновити оцінку', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Injected sandbox preview outage' })).toBeVisible()
})

test('real backend browser: service conditions use the lazy historical barber-service catalog', async ({ page, request }) => {
  await connect(page, request)
  const catalogRequests: string[] = []
  page.on('request', request => {
    if (/\/backoffice\/barbers\/\d+\/services/.test(request.url())) catalogRequests.push(request.url())
  })
  await page.goto('/customers/segments/new')
  await expect(page.getByRole('button', { name: 'Оцінити аудиторію', exact: true })).toBeEnabled()
  expect(catalogRequests).toHaveLength(0)
  await page.getByRole('button', { name: /^Параметр/ }).click()
  await page.getByRole('option', { name: 'Отримані послуги', exact: true }).click()
  await expect.poll(() => catalogRequests.length).toBe(1)
  await page.getByRole('button', { name: /^Додати послугу/ }).click()
  await page.getByRole('option', { name: /Sandbox haircut #1/ }).click()
  await expect(page.getByRole('button', { name: /Прибрати Sandbox haircut #1/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Оцінити аудиторію', exact: true })).toBeEnabled()
})
