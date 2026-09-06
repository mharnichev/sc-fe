import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// Opt-in: all successful responses are produced by the real disposable FastAPI/PostgreSQL harness.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const sandboxURL = env.SEGMENTS_SANDBOX_URL || ''
test.skip(!sandboxURL, 'Requires the disposable segment sandbox; never uses another configured backend.')
test.describe.configure({ mode: 'serial' })

type Rule = Record<string, unknown>
type SandboxFixture = {
  evaluated_at: string
  master_id: number
  service_id: number
  other_master_id: number
  other_service_id: number
  campaign_id: number
  customers: Record<string, number>
}
let fixture: SandboxFixture
let root: string
let headers: Record<string, string>
let auth: { access_token: string; user: unknown }

async function bootstrap(request: APIRequestContext) {
  expect(new URL(sandboxURL).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/)
  const response = await request.get(`${sandboxURL}/__sandbox`)
  await expect(response).toBeOK()
  const state = await response.json()
  expect(state.sandbox).toBe(true)
  expect(state.schema).toMatch(/^segments_browser_test_/)
  auth = state
  headers = { Authorization: `Bearer ${state.access_token}` }
  root = `${sandboxURL}/api/v1/backoffice`
}
async function signIn(page: Page) {
  await page.addInitScript(state => {
    localStorage.setItem('soulcuts-backoffice-theme', 'light')
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: state.access_token, refreshToken: 'sandbox-unused', user: state.user }))
  }, auth)
}
const rules = (conditions: Rule[], exclusions: Rule[] = [], combine = 'all') => ({ combine, conditions, exclusions })
async function preview(request: APIRequestContext, conditions: Rule[], exclusions: Rule[] = [], combine = 'all') {
  const response = await request.post(`${root}/segments/preview`, { headers, data: { rules: rules(conditions, exclusions, combine), evaluated_at: fixture.evaluated_at, limit: 200 } })
  await expect(response).toBeOK()
  const body = await response.json()
  expect(Date.parse(body.evaluated_at)).toBe(Date.parse(fixture.evaluated_at))
  expect(body.timezone).toBe('Europe/Kyiv')
  return body as { total: number; items: Array<{customer_id: number; history_state: string; completed_visit_count: number; last_visit_at: string | null; first_completed_visit_at: string | null; conditions: Array<{matched: boolean;value: unknown;period_start?: string;period_end?: string}>}> }
}
const ids = (body: {items: Array<{customer_id: number}>}) => body.items.map(item => item.customer_id)
const has = (body: {items: Array<{customer_id: number}>}, ...names: string[]) => names.forEach(name => expect(ids(body), `expected ${name}`).toContain(fixture.customers[name]))
const lacks = (body: {items: Array<{customer_id: number}>}, ...names: string[]) => names.forEach(name => expect(ids(body), `excluded ${name}`).not.toContain(fixture.customers[name]))

async function createSegment(request: APIRequestContext, name: string, conditions: Rule[] = [{type:'upcoming_booking',present:false}]) {
  const response = await request.post(`${root}/segments`, {headers, data:{name, rules:rules(conditions)}})
  expect(response.status()).toBe(201)
  return response.json()
}

test.beforeAll(async ({ request }) => {
  await bootstrap(request)
  await expect(await request.post(`${sandboxURL}/__sandbox/reset`)).toBeOK()
  await bootstrap(request)
  const response = await request.post(`${sandboxURL}/__sandbox/rules-fixtures`)
  await expect(response).toBeOK()
  fixture = await response.json()
  expect(fixture.evaluated_at).toBeTruthy()
})
test.afterAll(async ({ request }) => {
  if (fixture) await expect(await request.post(`${sandboxURL}/__sandbox/reset`)).toBeOK()
})

test('real rules: calendar-month and fixed-day boundaries honor inclusive and exclusive operators', async ({ request }) => {
  const calendar = await preview(request,[{type:'last_visit_age',min:3,max:12,unit:'calendar_months'}])
  has(calendar,'boundary_min_older','boundary_max_exact','imported_only')
  lacks(calendar,'boundary_min_exact','boundary_max_older','days90','unknown','explicit_new')
  const inclusive = await preview(request,[{type:'last_visit_age',min:3,max:12,unit:'calendar_months',min_inclusive:true,max_inclusive:false}])
  has(inclusive,'boundary_min_exact')
  lacks(inclusive,'boundary_max_exact')
  const days = await preview(request,[{type:'last_visit_age',min:90,max:90,unit:'days',min_inclusive:true,max_inclusive:true}])
  has(days,'days90')
  lacks(days,'boundary_min_exact')
})

test('real rules: observed counts and first visits keep imported and unknown history distinct', async ({ request }) => {
  const count = await preview(request,[{type:'completed_visit_count',min:3,max:3}])
  has(count,'rich')
  lacks(count,'imported_only','unknown','explicit_new','first_recent')
  const period = await preview(request,[{type:'completed_visit_count',min:2,max:2,period:{last:3,unit:'calendar_months'}}])
  has(period,'rich')
  const rich = period.items.find(item => item.customer_id === fixture.customers.rich)!
  expect(rich.conditions[0].value).toBe(2)
  expect(rich.completed_visit_count).toBe(3)
  expect(rich.conditions[0].period_start).toBeTruthy()
  const first = await preview(request,[{type:'first_visit',period:{start:'2026-08-01T00:00:00+03:00',end:'2026-09-01T00:00:00+03:00'}}])
  has(first,'first_recent')
  lacks(first,'rich','imported_only','unknown')
  const zero = await preview(request,[{type:'completed_visit_count',min:0,max:0}])
  has(zero,'explicit_new')
  lacks(zero,'imported_only','unknown')
  const all = await preview(request,[{type:'upcoming_booking',present:false}])
  const imported = all.items.find(item => item.customer_id === fixture.customers.imported_only)!
  const unknown = all.items.find(item => item.customer_id === fixture.customers.unknown)!
  expect(imported).toMatchObject({history_state:'known',completed_visit_count:0,first_completed_visit_at:null})
  expect(imported.last_visit_at).toBeTruthy()
  expect(unknown).toMatchObject({history_state:'unknown',completed_visit_count:0,last_visit_at:null})
})

test('real rules: latest master, period master, inactive historical service, ALL/ANY and exclusions', async ({ request }) => {
  const latest = await preview(request,[{type:'visited_master',master_ids:[fixture.master_id],mode:'last'}])
  has(latest,'rich')
  lacks(latest,'imported_only','unknown')
  const historical = await preview(request,[{type:'visited_master',master_ids:[fixture.other_master_id],mode:'within_period',period:{start:'2026-05-01T00:00:00+03:00',end:'2026-06-01T00:00:00+03:00'}}])
  has(historical,'rich')
  const service = await preview(request,[{type:'received_service',service_ids:[fixture.service_id],period:{last:3,unit:'calendar_months'}}])
  has(service,'rich','first_recent')
  const combinedAll = await preview(request,[{type:'completed_visit_count',min:3},{type:'last_visit_age',max:30,unit:'days'}])
  has(combinedAll,'rich')
  lacks(combinedAll,'first_recent','boundary_min_older')
  const combinedAny = await preview(request,[{type:'completed_visit_count',min:3},{type:'last_visit_age',min:3,max:12,unit:'calendar_months'}],[],'any')
  has(combinedAny,'rich','boundary_min_older')
  const upcoming = await preview(request,[{type:'upcoming_booking',present:true}])
  has(upcoming,'upcoming')
  const excluded = await preview(request,[{type:'completed_visit_count',min:1},{type:'last_visit_age',min:0,unit:'days'}],[{type:'upcoming_booking',present:true}],'any')
  has(excluded,'rich')
  lacks(excluded,'upcoming')
})

test('real rules: campaign receipt and recent marketing contact use accepted messages, not failed attempts', async ({ request }) => {
  const receipt = await preview(request,[{type:'received_campaign',campaign_id:fixture.campaign_id,period:{last:30,unit:'days'}}])
  has(receipt,'rich')
  lacks(receipt,'failed_only','first_recent')
  const contact = await preview(request,[{type:'marketing_contact',present:true,period:{last:30,unit:'days'}}])
  has(contact,'rich')
  lacks(contact,'failed_only')
  const noContact = await preview(request,[{type:'marketing_contact',present:false,period:{last:30,unit:'days'}}])
  has(noContact,'failed_only','first_recent')
  lacks(noContact,'rich')
  const oldPeriod = await preview(request,[{type:'received_campaign',campaign_id:fixture.campaign_id,period:{start:'2026-08-01T00:00:00Z',end:'2026-08-20T00:00:00Z'}}])
  lacks(oldPeriod,'rich')
})

test('real validation: unsupported, incomplete and oversized rules reject before evaluating membership', async ({ request }) => {
  const invalid: unknown[] = [
    rules([]),
    rules([{type:'last_visit_age',unit:'days'}]),
    rules([{type:'last_visit_age',min:12,max:3,unit:'calendar_months'}]),
    rules([{type:'completed_visit_count',min:1.5}]),
    rules([{type:'visited_master',master_ids:[],mode:'last'}]),
    rules([{type:'visited_master',master_ids:[fixture.master_id],mode:'within_period'}]),
    rules([{type:'received_service',service_ids:[fixture.service_id]}]),
    rules([{type:'received_campaign',campaign_id:0}]),
    rules([{type:'first_visit',period:{start:'2026-01-01T00:00:00',end:'2026-02-01T00:00:00'}}]),
    rules([{type:'marketing_contact',period:{last:121,unit:'calendar_months'}}]),
    rules([{type:'arbitrary_expression',value:'anything'}]),
    rules(Array(21).fill({type:'upcoming_booking',present:false})),
    rules([{type:'upcoming_booking',present:false}],Array(21).fill({type:'upcoming_booking',present:true})),
    rules([{type:'received_service',service_ids:Array(51).fill(fixture.service_id),period:{last:3,unit:'days'}}]),
  ]
  for (const ruleSet of invalid) {
    const response = await request.post(`${root}/segments/preview`,{headers,data:{rules:ruleSet,evaluated_at:fixture.evaluated_at}})
    expect(response.status(),JSON.stringify(ruleSet)).toBe(422)
  }
  const twenty = await preview(request,Array(20).fill({type:'upcoming_booking',present:false}))
  expect(twenty.total).toBeGreaterThan(20)
})

test('real browser: member pages remain bounded and reuse the evaluation timestamp', async ({ page, request }) => {
  await signIn(page)
  const segment = await createSegment(request,`Pagination rules ${Date.now()}`)
  const calls: string[] = []
  page.on('request',request => { if (request.url().includes(`/segments/${segment.id}/members`)) calls.push(request.url()) })
  await page.goto(`/customers/segments/${segment.id}`)
  const table = page.getByRole('table',{name:'Клієнти сегмента'})
  await expect(table.locator('tbody tr')).toHaveCount(20)
  const firstIds = await table.locator('a[href^="/customers/"]').evaluateAll(links => links.map(link => link.getAttribute('href')))
  await page.getByRole('button',{name:'Наступна',exact:true}).click()
  await expect(page.getByText('Сторінка 2',{exact:true})).toBeVisible()
  expect(await table.locator('tbody tr').count()).toBeLessThanOrEqual(20)
  const secondIds = await table.locator('a[href^="/customers/"]').evaluateAll(links => links.map(link => link.getAttribute('href')))
  expect(secondIds.some(id => firstIds.includes(id))).toBe(false)
  expect(calls).toHaveLength(2)
  expect(new URL(calls[1]!).searchParams.get('offset')).toBe('20')
  expect(new URL(calls[1]!).searchParams.get('evaluated_at')).toBeTruthy()
})

test('real browser: an optimistic concurrency conflict preserves the newer saved segment', async ({ page, request }) => {
  await signIn(page)
  const segment = await createSegment(request,`Concurrent rules ${Date.now()}`)
  await page.goto(`/customers/segments/${segment.id}/edit`)
  await expect(page.getByRole('textbox',{name:'Назва сегмента',exact:true})).toHaveValue(segment.name)
  const updated = await request.patch(`${root}/segments/${segment.id}`,{headers,data:{name:'Newer server revision',expected_revision:1}})
  expect(updated.status()).toBe(200)
  await page.getByRole('textbox',{name:'Назва сегмента',exact:true}).fill('Stale browser change')
  await page.getByRole('button',{name:'Зберегти сегмент',exact:true}).click()
  await expect(page.getByRole('alert').filter({hasText:'Сегмент змінено іншим адміністратором або архівовано'})).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/customers/segments/${segment.id}/edit$`))
  const actual = await (await request.get(`${root}/segments/${segment.id}`,{headers})).json()
  expect(actual).toMatchObject({name:'Newer server revision',revision:2})
})

test('real browser: archive filters, duplication and archived campaign-reference protection', async ({ page, request }) => {
  await signIn(page)
  const name = `Archive rules ${Date.now()}`
  const segment = await createSegment(request,name)
  const archived = await request.post(`${root}/segments/${segment.id}/archive`,{headers})
  expect(archived.status()).toBe(200)
  const archiveState = await archived.json()
  const repeat = await (await request.post(`${root}/segments/${segment.id}/archive`,{headers})).json()
  expect(repeat.revision).toBe(archiveState.revision)
  expect((await request.patch(`${root}/segments/${segment.id}`,{headers,data:{expected_revision:repeat.revision,name:'Should not overwrite'}})).status()).toBe(409)
  const prohibited = await request.post(`${root}/messaging/campaigns`,{headers,data:{name:'Archived segment draft',type:'manual',purpose:'marketing',channel:'telegram',segment_ids:[segment.id],metadata_json:{message_body:'Sandbox only'}}})
  expect(prohibited.status()).toBe(409)
  await page.goto('/customers/segments')
  await page.getByRole('button',{name:/^Статус сегмента/}).click()
  await page.getByRole('option',{name:'Архівні',exact:true}).click()
  await expect(page.getByRole('link',{name,exact:true})).toBeVisible()
  await page.getByRole('link',{name,exact:true}).click()
  await expect(page.getByRole('link',{name:'Редагувати',exact:true})).toHaveCount(0)
  await expect(page.getByRole('link',{name:'Створити кампанію',exact:true})).toHaveCount(0)
  await page.getByRole('link',{name:'Дублювати',exact:true}).click()
  await page.getByRole('button',{name:'Зберегти сегмент',exact:true}).click()
  await expect(page.getByRole('heading',{name:`${name} — копія`,exact:true})).toBeVisible()
  await expect(page.getByText('Активний',{exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Створити кампанію',exact:true})).toBeVisible()
})

test('real browser: absolute period controls submit timezone-aware dates and rule count stays within20', async ({ page, request }) => {
  await signIn(page)
  await page.goto('/customers/segments/new')
  await page.getByRole('button',{name:/^Параметр/}).click()
  await page.getByRole('option',{name:'Перший завершений візит',exact:true}).click()
  await page.getByRole('button',{name:/^Період/}).click()
  await page.getByRole('option',{name:'Конкретні дати',exact:true}).click()
  await expect(page.getByRole('button',{name:'Оцінити аудиторію',exact:true})).toBeDisabled()
  await page.getByRole('textbox',{name:'Початок включно',exact:true}).focus()
  await page.getByRole('button',{name:'10',exact:true}).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('textbox',{name:'Кінець невключно',exact:true}).click()
  await page.getByRole('button',{name:'20',exact:true}).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog',{name:'Кінець невключно',exact:true})).toHaveCount(0)
  await expect(page.getByRole('textbox',{name:'Кінець невключно',exact:true})).toBeFocused()
  const sent = page.waitForRequest(request => request.url().endsWith('/segments/preview') && request.method() === 'POST')
  await page.getByRole('button',{name:'Оцінити аудиторію',exact:true}).click()
  const body = (await sent).postDataJSON()
  expect(body.rules.conditions[0].period.start).toMatch(/Z$/)
  expect(body.rules.conditions[0].period.end).toMatch(/Z$/)
  expect(Date.parse(body.rules.conditions[0].period.start)).toBeLessThan(Date.parse(body.rules.conditions[0].period.end))
  await expect(page.getByText(/^Клієнтів в аудиторії:/)).toBeVisible()
  for (let index = 1; index < 20; index++) await page.getByRole('button',{name:'Додати умову',exact:true}).click()
  await expect(page.getByRole('group',{name:/^Умова \d+$/})).toHaveCount(20)
  await expect(page.getByRole('button',{name:'Додати умову',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Видалити умову 20',exact:true}).click()
  await expect(page.getByRole('button',{name:'Додати умову',exact:true})).toBeEnabled()
})
