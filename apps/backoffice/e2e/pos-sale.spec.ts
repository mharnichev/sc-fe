import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library'
import { test, expect, type Page } from '@playwright/test'
import type { PosCheckout } from '../types/posSale'
const offer = {id:101,name:'Reuzel Blue',brand_name:'Reuzel',sku:'R-001',barcode:'00000101',image_url:'/media/pos-test.svg',variant_label:'113 г',amount_minor:31000,currency:'UAH',available_quantity:2,can_sell:true,blocking_reasons:[]}
const uuid='22222222-2222-4222-8222-222222222222'
async function setup(page:Page, options:{role?:'master'|'admin';lostCreate?:boolean;priceChange?:boolean;lostHandover?:boolean;manualRefresh?:boolean; secondOffer?:boolean; lostBeforeCommit?:boolean; promotions?:boolean; projectCheckout?: (checkout: PosCheckout) => PosCheckout}={}) {
 const role=options.role || 'master', user={id:role==='admin'?18:17,is_active:true,is_superuser:role==='admin',role:role==='admin'?'admin':'barber',master_id:role==='admin'?null:42,can_record_sales:true,can_accept_qr_payments:true,email:'synthetic@example.test'}
 let current:any=null, revoked=false, paused=false, handovers=0, creates=0
 const firstRevision='1'.repeat(64), changedRevision='2'.repeat(64)
 function quote(items: {product_id:number; quantity:number}[], code: string | null, promotion: number | null, changed = false) {
  const priced = items.map(item => {
   const automatic = options.promotions && item.product_id === 101
   const selected = promotion === 12 && item.product_id === 102
   const base = changed ? 32000 : 31000, net = code ? 28000 : selected ? 27000 : automatic ? 29000 : base
   return {...item, base_unit_minor: base, unit_minor: net, subtotal_minor: base * item.quantity,
    discount_minor: (base - net) * item.quantity, amount_minor: net * item.quantity,
    discount_source: code ? 'promo_code' : selected ? 'selected_promotion' : automatic ? 'automatic' : null,
    promotion_id: code ? 77 : selected ? 12 : automatic ? 11 : null,
    promotion_name: code ? 'Синтетична акція' : selected ? 'Акція для Green' : automatic ? 'Автоакція Blue' : null, promotion_code: code}
  })
  const subtotal = priced.reduce((sum,item) => sum + item.quantity * item.base_unit_minor, 0)
  const amount = priced.reduce((sum,item) => sum + item.quantity * item.unit_minor, 0)
  return {items:priced, currency:'UAH', subtotal_minor:subtotal, discount_minor:subtotal-amount, amount_minor:amount, applied_promo_code:code, promotion_id:promotion,
   available_promotions:options.promotions && items.some(item=>item.product_id===102) ? [{id:12,name:'Акція для Green',product_ids:[102]}] : [],
   quote_revision:changed ? changedRevision : firstRevision}
 }
 const requests:{path:string;method:string;body:any;key?:string;query:URLSearchParams}[]=[], external:string[]=[], consoleErrors:string[]=[]
 page.on('pageerror',e=>consoleErrors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('Failed to resolve component'))consoleErrors.push(m.text())})
 await page.addInitScript(user=>localStorage.setItem('backoffice-auth',JSON.stringify({accessToken:'synthetic-only',user})),user)
 await page.route('**/*',async route=>{
  const req=route.request(), url=new URL(req.url())
  if(!['127.0.0.1','localhost'].includes(url.hostname)){external.push(url.origin);return route.abort()}
  if(url.pathname==='/media/pos-test.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/><circle cx="32" cy="32" r="22" fill="navy"/></svg>'})
  if(!url.pathname.includes('/api/v1/'))return route.continue()
  if(url.pathname.endsWith('/auth/me'))return route.fulfill({json:user})
  if(url.pathname.endsWith('/receipt/pdf'))return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'})
  if(url.pathname.endsWith('/backoffice/products/101/images')) {
   requests.push({path:url.pathname,method:req.method(),body:null,query:url.searchParams})
   return route.fulfill({json:[
    {id:3,product_id:101,sort_order:30,is_active:false,image_url:'/media/pos-test.svg?inactive'},
    {id:2,product_id:101,sort_order:20,is_active:true,image_url:'/media/pos-test.svg?side'},
    {id:1,product_id:101,sort_order:10,is_active:true,image_url:'/media/pos-test.svg?front'},
   ]})
  }
  if(!url.pathname.includes('/backoffice/pos/'))return route.fulfill({json:[]})
  const path=url.pathname.split('/backoffice/pos')[1],body=req.postData()?req.postDataJSON():null
  requests.push({path,method:req.method(),body,key:req.headers()['idempotency-key'],query:url.searchParams})
  if(revoked)return route.fulfill({status:403,json:{detail:{code:'permission_denied'}}})
  if(path==='/capabilities')return route.fulfill({json:{mode:'mono_checkbox',currency:'UAH',max_quantity:1,cart_limits:{max_items:100,max_quantity:100},can_search:true,can_start:!paused,can_view_admin_sales:role==='admin',automatic_reconciliation_enabled:options.manualRefresh !== true,poll_after_ms:30000,blocking_reasons:[]}})
  if(path==='/products')return route.fulfill({json:{items:[offer,{...offer,id:102,name:'Reuzel Green',sku:'R-002',barcode:'00000102',available_quantity:options.secondOffer?4:0,can_sell:!!options.secondOffer}],total:2,page:1,page_size:20}})
  if(path==='/checkouts/active')return route.fulfill({json:{items:current&&current.status!=='completed'?[current]:[],total:current?1:0,page:1,page_size:20}})
  if(path.startsWith('/checkouts/by-intent/'))return current?route.fulfill({json:current}):route.fulfill({status:404,json:{detail:{code:'missing'}}})
  if(path==='/cart/quote') {
   if(body.promo_code && body.promo_code !== 'SYNTHETIC')return route.fulfill({status:409,json:{detail:{code:'promo_not_applicable'}}})
   if (body.promotion_id && !body.items.some((item:{product_id:number})=>item.product_id===102))return route.fulfill({status:409,json:{detail:{code:'promotion_not_applicable'}}})
   return route.fulfill({json:quote(body.items,body.promo_code,body.promotion_id)})
  }
  if(path==='/checkouts'){
   creates++
   if(options.lostBeforeCommit&&creates===1)return route.abort('failed')
   if(options.priceChange && body.quote_revision!==changedRevision)return route.fulfill({status:409,json:{detail:{code:'price_changed',current_quote:quote(body.items,body.promo_code,body.promotion_id,true)}}})
   const priced=quote(body.items,body.promo_code,body.promotion_id,options.priceChange)
   current={checkout_id:uuid,intent_id:body.intent_id,order_id:9001,revision:3,created_at:'2026-11-06T10:00:00Z',employee:{user_id:user.id,master_id:user.master_id,display_name:'Synthetic seller'},items:priced.items.map(item=>({...item,name:item.product_id===101?offer.name:'Reuzel Green',sku:offer.sku,barcode:offer.barcode,image_url:offer.image_url,variant_label:offer.variant_label,total_minor:item.unit_minor*item.quantity})),order_status:'pending',amount_minor:priced.amount_minor,currency:'UAH',status:'awaiting_payment',payment:{provider:'monobank',status:'pending',invoice_id:'POS_SYNTHETIC_INVOICE_101',confirmed_at:null,qr_payload:'https://pay.mbnk.biz/POS_SYNTHETIC_INVOICE_101'},receipt:{issuer:'checkbox',status:'not_requested',recorded_at:null,pdf_url:null},handover:{status:'not_ready',actor_user_id:null,handed_over_at:null},actions:{can_resume:false,can_refresh:true,can_handover:false,can_recover_invoice:false,can_start_new:false},poll_after_ms:30000,blocking_reasons:[]}
   if (options.projectCheckout) current = options.projectCheckout(current)
   if(options.lostCreate&&creates===1)return route.abort('failed')
   return route.fulfill({status:201,json:current})
  }
  if(path.endsWith('/handover')){handovers++;current={...current,revision:current.revision+1,status:'completed',order_status:'completed',handover:{status:'handed_over',actor_user_id:user.id,handed_over_at:'2026-11-06T10:05:00Z'},actions:{...current.actions,can_handover:false,can_start_new:true}};if(options.lostHandover&&handovers===1)return route.abort('failed');return route.fulfill({json:current})}
  if(path.startsWith('/checkouts/'))return route.fulfill({json:current})
  if(path.startsWith('/sales')){
   if(role!=='admin')return route.fulfill({status:403,json:{detail:{code:'permission_denied'}}})
   const summary={order_id:7001,checkout_id:null,intent_id:null,created_at:'2026-11-06T10:00:00Z',employee:{user_id:17,master_id:42,display_name:'Інший продавець'},items:[{product_id:101,name:'Reuzel Blue',sku:'R-001',quantity:2,unit_minor:31000,total_minor:62000},{product_id:102,name:'Reuzel Green',sku:'R-002',quantity:3,unit_minor:20000,total_minor:60000}],amount_minor:122000,currency:'UAH',order_status:'completed',status:'completed',payment_status:'paid',receipt_status:'accepted',handover_status:'handed_over',source:'existing_mono_pos'}
   if(path==='/sales')return route.fulfill({json:{items:[summary],total:21,page:Number(url.searchParams.get('page')||1),page_size:20}})
   return route.fulfill({json:{...summary,payment:{provider:'monobank',status:'paid',invoice_id:'synthetic',confirmed_at:'2026-11-06T10:01:00Z',qr_payload:null},receipt:{issuer:'checkbox',status:'accepted',recorded_at:'2026-11-06T10:02:00Z',pdf_url:null},handover:{status:'handed_over',actor_user_id:17,handed_over_at:'2026-11-06T10:05:00Z'},actions:{can_resume:false,can_refresh:false,can_handover:false,can_recover_invoice:false,can_start_new:false}}})
  }
  return route.fulfill({status:404,json:{detail:{code:'missing'}}})
 })
 return {requests,external,consoleErrors,get current(){return current},get handovers(){return handovers},truth(status:'pending'|'receipt_error'|'ready'|'unknown'){
  current={...current,revision:current.revision+1,status:status==='ready'?'ready_to_handover':status==='unknown'?'requires_review':'paid_receipt_pending',payment:{...current.payment,status:status==='unknown'?'unknown':'paid',qr_payload:status==='unknown'?current.payment.qr_payload:null},receipt:{...current.receipt,status:status==='ready'?'accepted':status==='receipt_error'?'failed':'pending',pdf_url:status==='ready'?'/api/v1/backoffice/master-mono/orders/9001/receipt/pdf':null},handover:{...current.handover,status:status==='ready'?'ready':'not_ready'},actions:{...current.actions,can_handover:status==='ready'}}
 },revoke(){revoked=true},pause(){paused=true}}
}
async function select(page:Page){await page.getByLabel('Знайти товар',{exact:true}).fill('00000101');await page.getByLabel('Знайти товар',{exact:true}).press('Enter');await page.getByRole('button',{name:/Додати: Reuzel Blue/}).click();await page.getByRole('region',{name:'Панель кошика'}).getByText('310,00', {exact:false}).waitFor();await page.getByRole('button',{name:'Перейти до оплати',exact:true}).click()}

const opaquePaymentUrl = 'https://pay.mbnk.biz/i/pay?session=synthetic%2Btoken%3D'
const shortPaymentUrl = 'https://pay.mbnk.biz/sensitive-provider-data-never-log'
const providerInvoiceId = 'p2_synthetic_provider'

for (const [kind, paymentUrl] of [['nested opaque', opaquePaymentUrl], ['short opaque', shortPaymentUrl]] as const) {
test(`authorized master gets a QR for the exact verified ${kind} URL after one checkout`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = await setup(page, {
    projectCheckout: checkout => ({
      ...checkout,
      payment: { ...checkout.payment, invoice_id: providerInvoiceId, qr_payload: paymentUrl },
    }),
  })
  await page.goto('/orders/pos')
  await select(page)

  const sale = page.getByRole('region', { name: 'Поточний продаж' })
  const qr = sale.getByRole('img', { name: 'QR для оплати mono' })
  await expect(qr).toBeVisible()
  await expect(sale.getByText(/адміністратор/i)).toHaveCount(0)
  const screenshot = await qr.screenshot({ path: testInfo.outputPath('opaque-mono-qr.png') })
  const rendered = await page.evaluate(async bytes => {
    const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const rgba = context.getImageData(0, 0, image.width, image.height).data
    const pixels = Array.from({ length: image.width * image.height }, (_, i) => {
      const offset = i * 4
      return (rgba[offset]! << 16) | (rgba[offset + 1]! << 8) | rgba[offset + 2]!
    })
    return { width: image.width, height: image.height, pixels }
  }, Array.from<number>(screenshot))
  const source = new RGBLuminanceSource(Int32Array.from(rendered.pixels), rendered.width, rendered.height)
  const decoded = new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(source))).getText()
  expect(decoded).toBe(paymentUrl)
  expect(fixture.requests.filter(request => request.method === 'POST' && request.path.startsWith('/checkouts'))
    .map(request => request.path)).toEqual(['/checkouts'])
  expect(fixture.external).toEqual([])
})
}

for (const [name, qrPayload, orderStatus, paymentStatus, invoiceId] of [
  ['foreign host', 'https://pay.mbnk.biz.example.test/i/pay?session=synthetic', 'pending', 'pending'],
  ['credentials', 'https://pay.mbnk.biz@other.test/i/pay?session=synthetic', 'pending', 'pending'],
  ['unsafe path', 'https://pay.mbnk.biz/i/%2e%2e/pay?session=synthetic', 'pending', 'pending'],
  ['malformed encoding', 'https://pay.mbnk.biz/i/pay?session=bad%zz', 'pending', 'pending'],
  ['missing invoice identity', shortPaymentUrl, 'pending', 'pending', null],
  ['missing URL', null, 'pending', 'pending'],
  ['paid', shortPaymentUrl, 'paid', 'paid'],
  ['cancelled', shortPaymentUrl, 'cancelled', 'pending'],
] as const) {
  test(`POS omits the payment QR for ${name}`, async ({ page }) => {
    const fixture = await setup(page, {
      projectCheckout: checkout => ({
        ...checkout,
        order_status: orderStatus,
        payment: { ...checkout.payment, status: paymentStatus, qr_payload: qrPayload, invoice_id: invoiceId === null ? null : checkout.payment.invoice_id },
      }),
    })
    await page.goto('/orders/pos')
    await select(page)
    const sale = page.getByRole('region', { name: 'Поточний продаж' })
    await expect(sale.getByRole('heading', { name: 'Стан продажу' })).toBeVisible()
    await expect(sale.getByRole('img', { name: 'QR для оплати mono' })).toHaveCount(0)
    if (orderStatus === 'pending') {
      await expect(sale.getByText(/QR для оплати поки недоступний/)).toBeVisible()
      await sale.getByRole('button', { name: 'Перечитати стан', exact: true }).click()
      await expect.poll(() => fixture.requests.filter(request => request.method === 'GET' && request.path === `/checkouts/${uuid}`).length).toBe(1)
    }
    expect(fixture.requests.filter(request => request.method === 'POST' && request.path.startsWith('/checkouts'))
      .map(request => request.path)).toEqual(['/checkouts'])
    expect(fixture.external).toEqual([])
  })
}

for(const role of ['master','admin'] as const)test(`${role}: same cart sale, QR, backend receipt then one explicit handover`,async({page})=>{
 await page.clock.install();const f=await setup(page,{role,lostHandover:true});await page.goto('/orders/pos')
 expect(f.requests.filter(r=>r.path==='/checkouts'&&r.method==='POST')).toHaveLength(0)
 await select(page);await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible();expect(f.requests.find(r=>r.path==='/products')?.query.get('q')).toBe('00000101')
 const create=f.requests.find(r=>r.path==='/checkouts')!;expect(Object.keys(create.body).sort()).toEqual(['currency','intent_id','items','promo_code','promotion_id','quote_revision']);expect(create.body.items).toEqual([{product_id:101,quantity:1}]);expect(f.current.employee.user_id).toBe(role==='admin'?18:17)
 f.truth('pending');await page.clock.runFor(30000);await expect(page.getByRole('img',{name:'QR для оплати mono'})).toHaveCount(0);await expect(page.getByText(/Повторно платити не потрібно/)).toBeVisible();await expect(page.getByRole('button',{name:'Товар видано',exact:true})).toHaveCount(0)
 f.truth('receipt_error');await page.clock.runFor(30000);await expect(page.getByText(/Не вдалося підтвердити чек/)).toBeVisible();expect(f.requests.filter(r=>r.path==='/checkouts')).toHaveLength(1)
 f.truth('ready');await page.clock.runFor(30000);const handover=page.getByRole('button',{name:'Товар видано',exact:true});await expect(handover).toBeEnabled();expect((await handover.boundingBox())!.height).toBeGreaterThanOrEqual(44);await handover.focus();await expect(handover).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Товар видано',exact:true})).not.toBeFocused();await handover.evaluate((button:HTMLButtonElement)=>{button.click();button.click()})
 await expect(page.getByRole('button',{name:'Перечитати стан',exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Продаж завершено. Товар видано.',{exact:true})).toBeVisible();expect(f.handovers).toBe(1)
 await expect(page.getByRole('button',{name:'Новий продаж',exact:true})).toBeVisible();expect(f.external).toEqual([]);expect(f.consoleErrors).toEqual([])
})
test('changed price is confirmed explicitly and the same intent/key survives reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const f=await setup(page,{priceChange:true});await page.goto('/orders/pos');await select(page);await expect(page.getByText('Розрахунок кошика змінився',{exact:true})).toBeVisible();await page.screenshot({path:test.info().outputPath('changed-quote-master-dark-390.png'),animations:'disabled'});const first=f.requests.find(r=>r.path==='/checkouts')!;await page.reload();expect(f.requests.filter(r=>r.path==='/checkouts')).toHaveLength(1);await page.getByRole('button',{name:'Погоджуюсь на нову суму'}).click();await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible();const posts=f.requests.filter(r=>r.path==='/checkouts');expect(posts[1].key).toBe(first.key);expect(posts[1].body.intent_id).toBe(first.body.intent_id);expect(posts[1].body.quote_revision).toBe('2'.repeat(64))
})
test('lost create resumes by intent; unknown state cannot expose QR or offer a new invoice',async({page})=>{
 await page.setViewportSize({width:390,height:844});const f=await setup(page,{lostCreate:true,manualRefresh:true});await page.goto('/orders/pos');await select(page);await expect(page.getByRole('button',{name:'Відновити цей продаж',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible();expect(f.requests.filter(r=>r.path==='/checkouts')).toHaveLength(1);f.truth('unknown');await page.getByRole('button',{name:'Оновити стан',exact:true}).click();await expect(page.getByText('Стан оплати потребує уточнення',{exact:true})).toBeVisible();await page.screenshot({path:test.info().outputPath('unknown-master-dark-390.png'),animations:'disabled'});await expect(page.getByRole('img',{name:'QR для оплати mono'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Новий продаж',exact:true})).toHaveCount(0)
})
test('revoked access suppresses QR and all handover actions',async({page})=>{
 const f=await setup(page,{manualRefresh:true});await page.goto('/orders/pos');await select(page);await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible();f.revoke();await page.getByRole('button',{name:'Оновити стан',exact:true}).click();await expect(page.getByText(/Доступ до продажу втрачено/)).toBeVisible();await expect(page.getByRole('img',{name:'QR для оплати mono'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Товар видано',exact:true})).toHaveCount(0)
})
test('admin history preserves multi-item quantities and sends server filters before paging',async({page})=>{
 const f=await setup(page,{role:'admin'});await page.goto('/admin/product-sales');await expect(page.getByRole('table',{name:'Історія реальних POS-продажів'})).toBeVisible();await expect(page.getByText('Reuzel Blue × 2',{exact:true})).toBeVisible();await page.getByLabel('Пошук продажу').fill('Reuzel');await page.getByLabel('Статус замовлення',{exact:true}).click();await page.getByRole('option',{name:'Завершено',exact:true}).click();await page.getByRole('button',{name:'Застосувати фільтри'}).click();await expect.poll(()=>f.requests.filter(r=>r.path==='/sales'&&r.query.get('order_status')==='completed').length).toBe(1);await page.getByRole('button',{name:'Далі',exact:true}).click();await expect.poll(()=>f.requests.filter(r=>r.path==='/sales'&&r.query.get('page')==='2'&&r.query.get('order_status')==='completed').length).toBe(1);await page.getByRole('button',{name:'Деталі продажу #7001'}).click();const dialog=page.getByRole('dialog',{name:'Деталі продажу'});await expect(dialog.getByText('Існуючий реальний mono-продаж · Лише перегляд',{exact:true})).toBeVisible();await expect(dialog.getByText('Reuzel Green · 3 шт.',{exact:true})).toBeVisible();expect(f.requests.every(r=>r.method==='GET')).toBe(true)
})
test('master cannot fetch admin history',async({page})=>{
 const f=await setup(page);await page.goto('/admin/product-sales');await expect(page).toHaveURL(/orders\/pos/);expect(f.requests.some(r=>r.path.startsWith('/sales'))).toBe(false)
})
for(const theme of ['light','dark'])for(const role of ['master','admin'] as const)test(`render ${role} ${theme} at 320/390/1440`,async({page},testInfo)=>{
 const f=await setup(page,{role});await page.addInitScript(theme=>localStorage.setItem('soulcuts-backoffice-theme',theme),theme);await page.goto('/orders/pos');await select(page);await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible();const measurements=[]
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});const qr=page.getByRole('img',{name:'QR для оплати mono'});const box=await qr.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(240);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(await page.locator('html').getAttribute('data-backoffice-theme')).toBe(theme);measurements.push({width,qr:box,overflow:await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)});await page.screenshot({path:test.info().outputPath(`pos-${role}-${theme}-${width}.png`),fullPage:true})}
 await testInfo.attach('measurements',{body:JSON.stringify(measurements),contentType:'application/json'});expect(f.external).toEqual([]);expect(f.consoleErrors).toEqual([])
})


test('admin date filters and narrow read-only history are usable without page overflow',async({page},testInfo)=>{
 const f=await setup(page,{role:'admin'});await page.setViewportSize({width:320,height:900});await page.goto('/admin/product-sales')
 await page.getByLabel('ID працівника',{exact:true}).fill('17')
 await page.getByLabel('Продажі з',{exact:true}).click()
 const start=page.getByRole('dialog',{name:'Продажі з',exact:true})
 await expect(start).toBeVisible()
 const openOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)
 await start.getByRole('button',{name:'5',exact:true}).first().click()
 await page.getByLabel('Продажі до',{exact:true}).click()
 await page.getByRole('dialog',{name:'Продажі до',exact:true}).getByRole('button',{name:'6',exact:true}).first().click()
 await page.getByRole('button',{name:'Застосувати фільтри'}).click()
 await expect.poll(()=>f.requests.filter(r=>r.path==='/sales'&&r.query.get('employee_user_id')==='17'&&r.query.has('date_from')&&r.query.has('date_to')).length).toBe(1)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBe(0)
 await page.screenshot({path:test.info().outputPath('admin-history-320.png'),fullPage:true})
 await testInfo.attach('history-calendar-measurement',{body:JSON.stringify({width:320,openOverflow,filters:Object.fromEntries(f.requests.filter(r=>r.path==='/sales').at(-1)!.query)}),contentType:'application/json'})
 expect(openOverflow).toBe(0)
})


test('pause creation after payment still restores and hands over the existing sale exactly once',async({page})=>{
 const f=await setup(page,{lostHandover:true});await page.goto('/orders/pos');await select(page);await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible()
 f.truth('ready');f.pause();await page.reload()
 const hand=page.getByRole('button',{name:'Товар видано',exact:true});await expect(hand).toBeEnabled()
 await page.screenshot({path:test.info().outputPath('paused-ready-mobile.png'),fullPage:true})
 await hand.evaluate((button:HTMLButtonElement)=>{button.click();button.click()});await expect(page.getByRole('button',{name:'Перечитати стан',exact:true})).toBeVisible()
 const sent=f.requests.find(r=>r.path.endsWith('/handover'))!;expect(sent.key).toMatch(/^[0-9a-f-]{36}$/)
 await page.reload();await expect(page.getByText('Продаж завершено. Товар видано.',{exact:true})).toBeVisible();expect(f.handovers).toBe(1);expect(f.requests.filter(r=>r.path==='/checkouts')).toHaveLength(1)
 await expect(page.getByRole('button',{name:'Новий продаж',exact:true})).toHaveCount(0)
})
test('debounced typing and Enter produce one retail GET, never a checkout POST',async({page})=>{
 const f=await setup(page);await page.goto('/orders/pos');const input=page.getByLabel('Знайти товар',{exact:true})
 await input.fill('Re');await input.fill('Reuzel');await expect(page.getByRole('button',{name:/Додати: Reuzel Blue/})).toBeVisible()
 expect(f.requests.filter(r=>r.path==='/products').length).toBe(1);expect(f.requests.filter(r=>r.path==='/checkouts'&&r.method==='POST')).toHaveLength(0)
 await input.fill('SKU');await input.press('Enter');await page.waitForTimeout(400)
 expect(f.requests.filter(r=>r.path==='/products'&&r.query.get('q')==='SKU')).toHaveLength(1)
 expect(f.requests.filter(r=>r.path==='/checkouts'&&r.method==='POST')).toHaveLength(0)
})
test('leading-zero POS camera uses only exact lean retail lookup plus UPC fallback, without cost DTO',async({page})=>{
 const f=await setup(page);const retail:string[]=[],leaks:string[]=[]
 await page.route('**/inventory/**',route=>{leaks.push(route.request().url());return route.fulfill({json:{barcode:'0123456789012',purchase_unit_cost:'12.34'}})})
 await page.route('**/pos/products?**',route=>{const url=new URL(route.request().url());retail.push(url.searchParams.get('q')!);return route.fulfill({json:{items:[{...offer,barcode:url.searchParams.get('q')==='0123456789012'?'other':'123456789012'}],total:1,page:1,page_size:Number(url.searchParams.get('page_size'))}})})
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}})
  Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{configurable:true,writable:true,value:null});HTMLMediaElement.prototype.play=async()=>{}
  Object.defineProperties(HTMLVideoElement.prototype,{videoWidth:{configurable:true,get:()=>1280},videoHeight:{configurable:true,get:()=>720},readyState:{configurable:true,get:()=>4}})
  CanvasRenderingContext2D.prototype.drawImage=()=>{}
  ;(window as unknown as {Worker:unknown}).Worker=class{onmessage?: (event:{data:unknown})=>void;constructor(){setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),0)}postMessage(){setTimeout(()=>this.onmessage?.({data:{type:'result',barcode:'0123456789012'}}),0)}terminate(){}}
 })
 await page.goto('/orders/pos');await page.getByRole('button',{name:'Сканувати штрихкод',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Сканування штрихкоду',exact:true})).toHaveCount(0)
 await expect(page.getByLabel('Знайти товар',{exact:true})).toHaveValue('123456789012');await expect(page.getByRole('button',{name:/Додати: Reuzel Blue/})).toBeVisible()
 expect(retail).toEqual(['0123456789012','123456789012','123456789012']);expect(leaks).toEqual([]);expect(f.requests.filter(r=>r.path==='/checkouts'&&r.method==='POST')).toHaveLength(0);expect(f.external).toEqual([])
})


test('typing stays editable during a retail GET and older replies cannot replace newer candidates',async({page})=>{
 const f=await setup(page);let release:()=>void=()=>{};let started=false
 const slow=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/pos/products?**',async route=>{
  const q=new URL(route.request().url()).searchParams.get('q')
  if(q==='slow'){started=true;await slow}
  await route.fulfill({json:{items:[{...offer,name:q==='slow'?'Old response':'Fresh response'}],total:1,page:1,page_size:20}})
 })
 await page.goto('/orders/pos');const input=page.getByLabel('Знайти товар',{exact:true})
 await input.fill('slow');await input.press('Enter');await expect.poll(()=>started).toBe(true);await expect(input).toBeEnabled()
 await input.fill('fresh');await input.press('Enter');await expect(page.getByRole('button',{name:/Додати: Fresh response/})).toBeVisible()
 release();await page.waitForTimeout(350);await expect(page.getByRole('button',{name:/Додати: Old response/})).toHaveCount(0)
 expect(f.requests.filter(r=>r.path==='/checkouts'&&r.method==='POST')).toHaveLength(0)
})
for(const theme of ['light','dark'])for(const role of ['master','admin'] as const)test(`search render ${role} ${theme} at 320/390/1440`,async({page},testInfo)=>{
 const f=await setup(page,{role});await page.addInitScript(theme=>localStorage.setItem('soulcuts-backoffice-theme',theme),theme);await page.goto('/orders/pos')
 await page.getByLabel('Знайти товар',{exact:true}).fill('Reuzel');await expect(page.getByRole('button',{name:/Додати: Reuzel Blue/})).toBeVisible()
 const measurements=[]
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});const input=page.getByLabel('Знайти товар',{exact:true}),product=page.getByRole('button',{name:/Додати: Reuzel Blue/}),scan=page.getByRole('button',{name:'Сканувати штрихкод',exact:true})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);expect(overflow).toBe(0);expect((await scan.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect((await product.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await input.focus();await expect(input).toBeFocused();expect(await page.locator('html').getAttribute('data-backoffice-theme')).toBe(theme)
  measurements.push({width,overflow,input:await input.boundingBox(),product:await product.boundingBox(),scan:await scan.boundingBox()})
  await page.screenshot({path:test.info().outputPath(`search-${role}-${theme}-${width}.png`),fullPage:true})
 }
 await testInfo.attach('search-measurements',{body:JSON.stringify(measurements),contentType:'application/json'});expect(f.requests.filter(r=>r.path==='/checkouts'&&r.method==='POST')).toHaveLength(0);expect(f.external).toEqual([]);expect(f.consoleErrors).toEqual([])
})

test('cart collects items and supports quantity edits before any checkout', async ({ page }) => {
  const fixture = await setup(page, { secondOffer: true })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/orders/pos')
  const basket = page.getByRole('button', { name: /Відкрити кошик/ })
  await expect(basket).toHaveCount(0)
  const search = page.getByLabel('Знайти товар', { exact: true })
  await search.fill('Reuzel')
  await search.press('Enter')
  const addBlue = page.getByRole('button', { name: 'Додати: Reuzel Blue', exact: true })
  await addBlue.click()
  await addBlue.click()
  await page.getByRole('button', { name: 'Додати: Reuzel Green', exact: true }).click()
  await expect(basket).toContainText('3 шт.')
  await basket.click()
  const dialog = page.getByRole('dialog', { name: 'Кошик' })
  await expect(dialog.getByText('Reuzel Blue', { exact: true })).toBeVisible()
  const incrementButton = dialog.getByRole('button', { name: 'Збільшити кількість: Reuzel Blue' })
  const removeButton = dialog.getByRole('button', { name: 'Прибрати: Reuzel Blue' })
  await expect.poll(async () => (await incrementButton.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
  const increment = (await incrementButton.boundingBox())!
  const remove = (await removeButton.boundingBox())!
  expect(remove.y).toBeGreaterThanOrEqual(increment.y + increment.height)
  expect(increment.height).toBeGreaterThanOrEqual(44)
  expect(remove.height).toBeGreaterThanOrEqual(44)
  await dialog.getByRole('button', { name: 'Зменшити кількість: Reuzel Blue' }).click()
  await expect(dialog.getByLabel('Кількість: Reuzel Blue', { exact: true })).toHaveText('1')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(basket).toContainText('2 шт.')
  await basket.click()
  await dialog.getByRole('button', { name: 'Прибрати: Reuzel Blue' }).click()
  await dialog.getByRole('button', { name: 'Прибрати: Reuzel Green' }).click()
  await expect(dialog).toBeHidden()
  await expect(basket).toHaveCount(0)
  expect(fixture.requests.filter(r => r.path === '/checkouts' && r.method === 'POST')).toHaveLength(0)
})

test('promotion is applied and removed using quotes; multi-item checkout starts once', async ({ page }) => {
  const fixture = await setup(page, { secondOffer: true })
  await page.goto('/orders/pos')
  await page.getByLabel('Знайти товар', { exact: true }).fill('Reuzel')
  await page.getByRole('button', { name: 'Додати: Reuzel Blue' }).click()
  await page.getByRole('button', { name: 'Додати: Reuzel Blue' }).click()
  await page.getByRole('button', { name: 'Додати: Reuzel Green' }).click()
  await page.getByRole('button', { name: /Відкрити кошик/ }).click()
  const cart = page.getByRole('dialog', { name: 'Кошик' })
  const pay = cart.getByRole('button', { name: 'Перейти до оплати' })
  await expect(cart).toContainText('930,00')
  await cart.getByText('Промокод', { exact: true }).first().click()
  await cart.getByLabel('Промокод').fill('INVALID')
  await cart.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await expect(cart.getByRole('alert')).toContainText('не діє')
  await expect(pay).toBeDisabled()
  await cart.getByLabel('Промокод').fill('synthetic')
  await cart.getByRole('button', { name: 'Застосувати', exact: true }).click()
  await expect(cart).toContainText('Промокод: Синтетична акція')
  await expect(cart).toContainText('840,00')
  await cart.getByRole('button', { name: 'Прибрати промокод' }).click()
  await expect(cart).not.toContainText('Синтетична акція')
  await expect(pay).toBeEnabled()
  expect(fixture.requests.filter(r => r.path === '/checkouts')).toHaveLength(0)
  await pay.evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(page.getByRole('img', { name: 'QR для оплати mono' })).toBeVisible()
  const posts = fixture.requests.filter(r => r.path === '/checkouts')
  expect(posts).toHaveLength(1)
  expect(posts[0].body.items).toEqual([{ product_id: 101, quantity: 2 }, { product_id: 102, quantity: 1 }])
  expect(posts[0].body.promo_code).toBeNull()
})

test('reload only reads a missing cart intent; explicit recovery replays the exact request', async ({ page }) => {
  const fixture = await setup(page, { lostBeforeCommit: true })
  await page.goto('/orders/pos')
  await select(page)
  await expect(page.getByRole('button', { name: 'Відновити цей продаж' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Рахунок ще не знайдено')
  expect(fixture.requests.filter(r => r.path === '/checkouts')).toHaveLength(1)
  await page.getByRole('button', { name: 'Відновити цей продаж' }).click()
  await expect(page.getByRole('img', { name: 'QR для оплати mono' })).toBeVisible()
  const posts = fixture.requests.filter(r => r.path === '/checkouts')
  expect(posts).toHaveLength(2)
  expect(posts[1].key).toBe(posts[0].key)
  expect(posts[1].body).toEqual(posts[0].body)
})

for (const role of ['master', 'admin'] as const) for (const theme of ['light', 'dark']) {
  test(`cart render ${role} ${theme} at 320/390/1440`, async ({ page }, testInfo) => {
    const fixture = await setup(page, { role, secondOffer: true })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(value => localStorage.setItem('soulcuts-backoffice-theme', value), theme)
    await page.goto('/orders/pos')
    await page.getByLabel('Знайти товар', { exact: true }).fill('Reuzel')
    await page.getByRole('button', { name: 'Додати: Reuzel Blue' }).click()
    const green = page.getByRole('button', { name: 'Додати: Reuzel Green' })
    await green.click()
    const bar = page.getByRole('region', { name: 'Панель кошика' })
    await expect(bar).toContainText('620,00')
    const cdp = await page.context().newCDPSession(page)
    const measurements = []
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 740 })
      const inset = width < 640 ? 28 : 0
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom: inset, bottomMax: inset } })
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const bounds = (await bar.boundingBox())!
      if (width === 1440) {
        const search = (await page.getByRole('region', { name: 'Пошук товарів' }).boundingBox())!
        expect(Math.abs(bounds.x - search.x)).toBeLessThanOrEqual(1)
        const pay = bar.getByRole('button', { name: 'Перейти до оплати' })
        await pay.hover()
        await expect.poll(() => pay.evaluate(node => {
          const probe = document.createElement('span')
          probe.style.backgroundColor = 'var(--bo-action-hover)'
          document.body.append(probe)
          const expected = getComputedStyle(probe).backgroundColor
          probe.remove()
          return getComputedStyle(node).backgroundColor === expected
        })).toBe(true)
        await page.mouse.move(1, 1)
      }
      const navigation = page.getByRole('navigation', { name: 'Швидка навігація майстра' })
      const nav = await navigation.isVisible() ? await navigation.boundingBox() : null
      const lastProduct = (await green.boundingBox())!
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBe(0)
      expect(lastProduct.y + lastProduct.height).toBeLessThanOrEqual(bounds.y)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(Math.min(740, nav?.y ?? 740) + 1)
      const bottomPadding = await bar.evaluate(node => Number.parseFloat(getComputedStyle(node).paddingBottom))
      expect(bottomPadding).toBe(12 + (nav ? 0 : inset))
      if (nav) expect(740 - (bounds.y + bounds.height)).toBeGreaterThanOrEqual(64 + inset)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: testInfo.outputPath(`bar-${width}.png`), animations: 'disabled' })
      await bar.getByRole('button', { name: /Відкрити кошик/ }).click()
      const dialog = page.getByRole('dialog', { name: 'Кошик' })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Перейти до оплати' })).toBeEnabled()
      await expect.poll(async () => { const box = (await dialog.boundingBox())!; return box.y + box.height }).toBeLessThanOrEqual(741)
      const modal = (await dialog.boundingBox())!
      expect(modal.width).toBeLessThanOrEqual(width)
      expect(modal.y + modal.height).toBeLessThanOrEqual(741)
      await expect.poll(() => dialog.evaluate(node => getComputedStyle(node.parentElement!).opacity)).toBe('1')
      await page.screenshot({ path: testInfo.outputPath(`cart-${width}.png`), animations: 'disabled' })
      await page.keyboard.press('Escape')
      await expect(page.locator('[role=dialog][aria-label=Кошик]')).toHaveCount(0)
      measurements.push({ width, overflow, bounds, nav, lastProduct, modal, inset, bottomPadding })
    }
    await testInfo.attach('cart-measurements', { body: JSON.stringify(measurements), contentType: 'application/json' })
    expect(fixture.external).toEqual([])
    expect(fixture.consoleErrors).toEqual([])
  })
}

test('available automatic promotion selection uses the server total and persists on checkout replay', async ({ page }) => {
  const fixture = await setup(page, { secondOffer: true, promotions: true, lostBeforeCommit: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/orders/pos')
  await page.getByLabel('Знайти товар', { exact: true }).fill('Reuzel')
  await page.getByRole('button', { name: 'Додати: Reuzel Blue' }).click()
  await page.getByRole('button', { name: 'Додати: Reuzel Green' }).click()
  await page.getByRole('button', { name: /Відкрити кошик/ }).click()
  const cart = page.getByRole('dialog', { name: 'Кошик' })
  await expect(cart).toContainText('600,00')
  await expect(cart).toContainText('Автоматична акція: Автоакція Blue')
  await cart.getByRole('button', { name: /^Акція / }).click()
  await cart.getByRole('option', { name: 'Акція для Green', exact: true }).click()
  await expect(cart).toContainText('Обрана акція: Акція для Green')
  await expect(cart).toContainText('Автоматична акція: Автоакція Blue')
  await expect(cart).toContainText('560,00')
  await page.screenshot({ path: test.info().outputPath('selected-promotion.png') })
  const promotion = cart.getByRole('button', { name: /^Акція / })
  await expect(promotion).toHaveAccessibleName('Акція Акція для Green')
  await promotion.focus()
  await page.keyboard.press('ArrowDown')
  await expect(cart.getByRole('option', { name: 'Акція для Green', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(cart).toBeVisible()
  await expect(promotion).toBeFocused()
  await promotion.click()
  await cart.getByRole('option', { name: 'Автоматичний розрахунок', exact: true }).click()
  await expect(cart).not.toContainText('Обрана акція:')
  await expect(cart).toContainText('600,00')
  await cart.getByRole('button', { name: /^Акція / }).click()
  await cart.getByRole('option', { name: 'Акція для Green', exact: true }).click()
  await expect(cart).toContainText('560,00')
  await cart.getByRole('button', { name: 'Перейти до оплати' }).click()
  await expect(page.getByRole('button', { name: 'Відновити цей продаж' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Рахунок ще не знайдено')
  await page.getByRole('button', { name: 'Відновити цей продаж' }).click()
  await expect(page.getByRole('img', { name: 'QR для оплати mono' })).toBeVisible()
  const posts = fixture.requests.filter(r => r.path === '/checkouts')
  expect(posts).toHaveLength(2)
  expect(posts[0].body.promotion_id).toBe(12)
  expect(posts[0].body.promo_code).toBeNull()
  expect(posts[1].body).toEqual(posts[0].body)
  expect(posts[1].key).toBe(posts[0].key)
})

for (const [role, theme, width] of [['master','dark',320],['master','light',390],['admin','light',1440],['admin','dark',1440]] as const) {
  test(`product gallery and inline scan ${role} ${theme} ${width}`, async ({ page }) => {
    const fixture = await setup(page, { role })
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(value => localStorage.setItem('soulcuts-backoffice-theme', value), theme)
    await page.goto('/orders/pos')
    const field = page.getByLabel('Знайти товар', { exact: true })
    const scan = page.getByRole('button', { name: 'Сканувати штрихкод', exact: true })
    await field.fill('Reuzel')
    const details = page.getByRole('button', { name: 'Деталі: Reuzel Blue', exact: true })
    await expect(details).toBeVisible()
    await expect(details).toHaveAccessibleDescription(/Доступно: 2 шт\..*310,00/)
    const bounds = (await field.boundingBox())!, camera = (await scan.boundingBox())!
    expect(camera.width).toBeGreaterThanOrEqual(44)
    expect(camera.height).toBeGreaterThanOrEqual(44)
    expect(Math.abs(camera.x + camera.width - (bounds.x + bounds.width))).toBeLessThanOrEqual(1)
    expect(Math.abs(camera.y - bounds.y)).toBeLessThanOrEqual(1)
    await page.screenshot({path:test.info().outputPath(`search-${role}-${theme}-${width}.png`), animations:'disabled'})
    await details.click()
    const dialog = page.getByRole('dialog', { name: 'Деталі товару', exact: true })
    await expect(dialog.getByRole('img')).toHaveCount(2)
    await expect(dialog.getByRole('img').first()).toHaveAttribute('src', /front$/)
    await expect(dialog.getByRole('img').last()).toHaveAttribute('src', /side$/)
    await expect(dialog.getByText(/Доступно: 2 шт/)).toBeVisible()
    await expect(dialog).not.toContainText(/закупівл|собіварт|purchase_unit_cost/i)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.screenshot({path:test.info().outputPath(`details-${role}-${theme}-${width}.png`), animations:'disabled'})
    await page.keyboard.press('Escape')
    await expect(details).toBeFocused()
    await page.getByRole('button', { name: 'Додати: Reuzel Blue', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('region', { name: 'Панель кошика' })).toBeVisible()
    expect(fixture.requests.filter(r => r.path.endsWith('/images'))).toHaveLength(1)
    expect(fixture.requests.some(r => r.path.startsWith('/inventory') || r.path === '/backoffice/products/101')).toBe(false)
    expect(fixture.requests.some(r => r.path === '/checkouts' && r.method === 'POST')).toBe(false)
    expect(fixture.external).toEqual([])
    expect(fixture.consoleErrors).toEqual([])
  })
}

async function recoveryFixture(page: Page, role: 'master' | 'admin', mode: 'ready' | 'blocked' | 'lost' | 'conflict' | 'not-found' | 'no-link' = 'ready') {
  const admin = role === 'admin'
  const user = { id: admin ? 18 : 17, is_active: true, is_superuser: admin, role: admin ? 'admin' : 'barber', master_id: admin ? null : 42, can_record_sales: true, can_accept_qr_payments: true, email: 'synthetic@example.test' }
  const intentId = '33333333-3333-4333-8333-333333333333'
  const record = { key: '44444444-4444-4444-8444-444444444444', checkout_id: uuid, body: { intent_id: intentId, items: [{product_id: 101, quantity: 1}], currency: 'UAH', quote_revision: '1'.repeat(64), promo_code: null, promotion_id: null } }
  const recovery = { reference: 'synthetic-bank-reference', requested_at: '2026-11-08T12:00:00Z', can_attach: mode !== 'blocked' }
  const noActions = { can_resume: false, can_refresh: false, can_handover: false, can_recover_invoice: false, can_start_new: false }
  let revision = 2, attached = false
  const requests: { path: string; method: string; key?: string; body: any }[] = []
  const attachments = () => requests.filter(request => request.path.endsWith('/recover-invoice'))
  const status = (history: boolean) => ({
    checkout_id: uuid, intent_id: intentId, order_id: 9001, revision, created_at: recovery.requested_at,
    employee: { user_id: history ? 17 : user.id, master_id: history ? 42 : user.master_id, display_name: 'Synthetic seller' },
    items: [{ product_id: 101, name: 'Reuzel · синтетичний товар', sku: 'R-001', barcode: '00000101', image_url: null, variant_label: '113 г', quantity: 1, unit_minor: 62900, total_minor: 62900 }],
    order_status: 'pending', amount_minor: 62900, currency: 'UAH', status: 'requires_review', source: 'quick_pos',
    payment_status: 'unknown', receipt_status: 'not_requested', handover_status: 'not_ready',
    payment: { provider: 'monobank', status: 'unknown', invoice_id: attached ? 'synthetic-invoice-9001' : null, confirmed_at: null, qr_payload: null },
    receipt: { issuer: 'checkbox', status: 'not_requested', recorded_at: null, pdf_url: null },
    handover: { status: 'not_ready', actor_user_id: null, handed_over_at: null },
    actions: history ? noActions : { ...noActions, can_recover_invoice: admin && !attached && recovery.can_attach, can_refresh: attached },
    blocking_reasons: mode === 'blocked' ? ['master_mono_disabled', 'creation_unknown'] : ['creation_unknown'],
    invoice_recovery: admin && !attached ? recovery : null, poll_after_ms: 10000,
  })
  await page.addInitScript(({ user, record, admin }) => {
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'synthetic-only', user }))
    const key = 'sc-pos:v1:' + user.id
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(record))
    localStorage.setItem('soulcuts-backoffice-theme', admin ? 'light' : 'dark')
  }, { user, record, admin })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.hostname !== '127.0.0.1') return route.abort('blockedbyclient')
    if (!path.includes('/api/v1/')) return route.continue()
    requests.push({path, method: request.method(), key: request.headers()['idempotency-key'], body: request.postData() ? request.postDataJSON() : null})
    if (path.endsWith('/auth/me')) return route.fulfill({json:user})
    if (path.endsWith('/pos/capabilities')) return route.fulfill({json:{mode:'mono_checkbox',currency:'UAH',can_search:true,can_start:true,can_view_admin_sales:admin,automatic_reconciliation_enabled:false,cart_limits:{max_items:100,max_quantity:100},poll_after_ms:10000,blocking_reasons:[]}})
    if (path.endsWith('/checkouts/active')) return route.fulfill({json:{items:[status(false)],total:1,page:1,page_size:20}})
    if (path.endsWith('/by-intent/' + intentId) || path.endsWith('/checkouts/' + uuid)) return route.fulfill({json:status(false)})
    if (path.endsWith('/pos/sales')) return route.fulfill({json:{items:[status(true)],total:1,page:1,page_size:20}})
    if (path.endsWith('/pos/sales/9001')) return route.fulfill({json:status(true)})
    if (path.endsWith('/master-mono/orders/9001/recover-invoice')) {
      if (mode === 'lost' && attachments().length === 1) return route.abort('failed')
      if (mode === 'not-found' && attachments().length === 1) return route.fulfill({status:404,json:{detail:{code:'master_mono_recovery_invoice_not_found'}}})
      if (mode === 'no-link') return route.fulfill({status:409,json:{detail:{code:'master_mono_recovery_url_required'}}})
      if (mode === 'conflict' && attachments().length === 1) {
        revision++
        return route.fulfill({status:409,json:{detail:{code:'revision_conflict'}}})
      }
      attached = true
      return route.fulfill({json:{order_id:9001,revision:++revision,invoice_id:request.postDataJSON().invoice_id,paid:false,payment_url:null}})
    }
    if (request.method() !== 'GET') return route.fulfill({status:500,json:{detail:'unexpected mutation'}})
    return route.fulfill({json:[]})
  })
  return { requests, attachments }
}

for (const role of ['master', 'admin'] as const) {
  test(`unbound invoice: ${role} can read the same sale without a payment command`, async ({page}, testInfo) => {
    await page.setViewportSize(role === 'master' ? {width:320,height:780} : {width:1440,height:900})
    const f = await recoveryFixture(page, role, role === 'admin' ? 'blocked' : 'ready')
    await page.goto('/orders/pos')
    const sale = page.getByRole('region', {name:'Поточний продаж'})
    await expect(sale.getByText('Продаж #9001', {exact:true})).toBeVisible()
    await expect(sale.getByText('Стан не підтверджено', {exact:true})).toBeVisible()
    await expect(sale.getByText('Не вдалося підтвердити рахунок mono', {exact:true})).toBeVisible()
    await expect(sale.getByText(/Рахунок міг бути створений/)).toBeVisible()
    if (role === 'master') {
      await expect(sale.getByText(/адміністратор/i)).toHaveCount(0)
      await expect(sale.getByText('synthetic-bank-reference')).toHaveCount(0)
    } else await expect(sale.getByText(/інтеграція mono недоступна/i)).toBeVisible()
    await expect(sale.getByRole('button',{name:'Прив’язати наявний рахунок',exact:true})).toHaveCount(0)
    await expect(sale.getByRole('button',{name:'Новий продаж',exact:true})).toHaveCount(0)
    await expect(page.getByRole('img',{name:'QR для оплати mono'})).toHaveCount(0)
    const read = sale.getByRole('button', {name:'Перечитати стан',exact:true})
    await read.focus()
    await expect(read).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(()=>f.requests.filter(r=>r.path.endsWith('/checkouts/' + uuid)).length).toBe(1)
    await page.reload()
    await expect(sale.getByText('Продаж #9001', {exact:true})).toBeVisible()
    expect(f.requests.filter(r=>r.method!=='GET')).toEqual([])
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({ path:testInfo.outputPath(role + '-unbound.png'), animations:'disabled' })
  })
}

for (const mode of ['lost','conflict','not-found'] as const) {
  test(`manager history recovery handles ${mode} without creating a second invoice`, async ({page},testInfo) => {
    const f = await recoveryFixture(page,'admin',mode)
    await page.setViewportSize({width:1440,height:900})
    await page.goto('/admin/product-sales?q=9001')
    const details = page.getByRole('button',{name:'Деталі продажу #9001'})
    await details.click()
    const dialog = page.getByRole('dialog',{name:'Деталі продажу'})
    await expect(dialog.getByText('synthetic-bank-reference')).toBeVisible()
    const invoice = dialog.getByRole('textbox',{name:'ID рахунку mono',exact:true})
    await invoice.fill(mode === 'not-found' ? 'mistyped-invoice' : 'synthetic-invoice-9001')
    expect(f.attachments()).toHaveLength(0)
    await dialog.getByRole('button',{name:'Прив’язати наявний рахунок',exact:true}).click()
    await expect.poll(()=>f.attachments().length).toBe(1)
    await expect(dialog.getByRole('alert')).toBeVisible()
    if(mode==='lost') {
      await page.reload()
      await details.click()
      await expect(invoice).toBeDisabled()
      await expect(invoice).toHaveValue('synthetic-invoice-9001')
      expect(f.attachments()).toHaveLength(1)
      await dialog.getByRole('button',{name:'Повторити прив’язку',exact:true}).click()
    } else {
      await expect.poll(()=>f.requests.filter(r=>r.path.endsWith('/pos/sales/9001')).length).toBe(2)
      await invoice.fill('synthetic-invoice-9001')
      await dialog.getByRole('button',{name:'Прив’язати наявний рахунок',exact:true}).click()
    }
    await expect.poll(()=>f.attachments().length).toBe(2)
    const [first, second] = f.attachments()
    expect(first.body).toEqual({invoice_id:mode === 'not-found' ? 'mistyped-invoice' : 'synthetic-invoice-9001',expected_revision:2})
    expect(first.key).toBeTruthy()
    if (mode==='lost') expect(second).toEqual(first)
    else {
      expect(second.key).not.toBe(first.key)
      expect(second.body).toEqual({invoice_id:'synthetic-invoice-9001',expected_revision:mode === 'conflict' ? 3 : 2})
    }
    await expect(invoice).toHaveCount(0)
    await expect(dialog.getByText(/Потребує перевірки/).first()).toBeVisible()
    expect(f.requests.filter(r=>r.method!=='GET')).toEqual(f.attachments())
    await page.screenshot({path:testInfo.outputPath('admin-history-' + mode + '.png'),animations:'disabled'})
  })
}

test('manager recovery without a bank payment link keeps the original sale and key', async ({ page }) => {
  const fixture = await recoveryFixture(page, 'admin', 'no-link')
  const saleReads = () => fixture.requests.filter(request => request.method === 'GET' && request.path.endsWith('/pos/sales/9001')).length
  await page.goto('/admin/product-sales?q=9001')
  const details = page.getByRole('button', { name: 'Деталі продажу #9001' })
  const dialog = page.getByRole('dialog', { name: 'Деталі продажу' })
  const field = dialog.getByRole('textbox', { name: 'ID рахунку mono', exact: true })
  const alert = dialog.getByRole('alert')
  await details.click()
  await field.fill('synthetic-invoice-9001')
  await dialog.getByRole('button', { name: 'Прив’язати наявний рахунок', exact: true }).click()
  await expect(alert).toHaveText('Mono підтвердив рахунок. Оригінальне посилання для оплати недоступне. Перечитайте стан продажу.')
  await expect.poll(saleReads).toBe(2)
  await dialog.getByRole('button', { name: 'Перечитати збережений стан', exact: true }).click()
  await expect.poll(saleReads).toBe(3)
  expect(fixture.attachments()).toHaveLength(1)
  expect(fixture.attachments()[0]).toMatchObject({
    method: 'POST', key: expect.any(String), body: { invoice_id: 'synthetic-invoice-9001', expected_revision: 2 },
  })
  await expect(dialog.getByRole('img', { name: 'QR для оплати mono' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Товар видано', exact: true })).toHaveCount(0)

  await page.reload()
  await details.click()
  await expect(field).toBeDisabled()
  await expect(field).toHaveValue('synthetic-invoice-9001')
  expect(fixture.attachments()).toHaveLength(1)
  await dialog.getByRole('button', { name: 'Повторити прив’язку', exact: true }).click()
  await expect(alert).toContainText('Оригінальне посилання для оплати недоступне')
  expect(fixture.attachments()).toHaveLength(2)
  expect(fixture.attachments()[1]).toEqual(fixture.attachments()[0])
  expect(fixture.requests.filter(request => request.method !== 'GET')).toEqual(fixture.attachments())
})

test('0150 closed sale exits to fresh stock after reread and reload without replaying the old intent', async ({ page, context }) => {
  const intentId = '33333333-3333-4333-8333-333333333333'
  const key = '44444444-4444-4444-8444-444444444444'
  const selectionToken = '55555555-5555-4555-8555-555555555555'
  const oldRecord = {
    key, checkout_id: uuid,
    body: { intent_id: intentId, currency: 'UAH', items: [{ product_id: 101, quantity: 1 }], quote_revision: '1'.repeat(64), promo_code: null, promotion_id: null },
  }
  let closed = false
  const reads: string[] = []
  const state = (): PosCheckout => ({
    checkout_id: uuid, intent_id: intentId, order_id: 5, revision: closed ? 3 : 2, created_at: '2026-11-09T07:57:55Z',
    employee: { user_id: 17, master_id: 42, display_name: 'Synthetic master' },
    items: [{ product_id: 101, name: offer.name, sku: offer.sku, barcode: offer.barcode, image_url: null, variant_label: offer.variant_label, quantity: 1, unit_minor: 62900, total_minor: 62900 }],
    order_status: closed ? 'cancelled' : 'pending', amount_minor: 62900, currency: 'UAH', status: 'requires_review',
    payment: { provider: 'monobank', status: closed ? 'expired' : 'unknown', invoice_id: null, confirmed_at: null, qr_payload: null },
    receipt: { issuer: 'checkbox', status: 'not_requested', recorded_at: null, pdf_url: null },
    handover: { status: 'not_ready', actor_user_id: null, handed_over_at: null },
    actions: { can_resume: false, can_refresh: false, can_handover: false, can_recover_invoice: false, can_start_new: closed },
    blocking_reasons: ['creation_unknown'], poll_after_ms: 10000,
  })
  const install = async (tab: Page) => {
    const fixture = await setup(tab, { manualRefresh: true })
    await tab.route(/\/pos\/checkouts\//, async route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      expect(request.method()).toBe('GET')
      reads.push(path)
      if (path.endsWith('/active')) {
        const items = closed ? [] : [state()]
        return route.fulfill({ json: { items, total: items.length, page: 1, page_size: 20 } })
      }
      expect(path.endsWith('/' + intentId) || path.endsWith('/' + uuid)).toBe(true)
      return route.fulfill({ json: state() })
    })
    await tab.route(/\/pos\/products(?:\?|$)/, route => route.fulfill({
      json: { items: [{ ...offer, available_quantity: closed ? 1 : 0, can_sell: closed }], total: 1, page: 1, page_size: 20 },
    }))
    return fixture
  }
  await page.addInitScript(({ oldRecord, selectionToken }) => {
    if (localStorage.getItem('closure-fixture-initialized')) return
    localStorage.setItem('closure-fixture-initialized', 'true')
    localStorage.setItem('sc-pos:v1:17', JSON.stringify({ version: 2, current: oldRecord, selection_token: selectionToken, deferred: [] }))
    sessionStorage.setItem('sc-pos:v1:17:selection', selectionToken)
  }, { oldRecord, selectionToken })
  const fixture = await install(page)
  await page.goto('/orders/pos')
  const sale = page.getByRole('region', { name: 'Поточний продаж' })
  const exit = sale.getByRole('button', { name: 'До пошуку товарів', exact: true })
  await expect(sale.getByText('Продаж #5', { exact: true })).toBeVisible()
  await expect(exit).toHaveCount(0)
  const other = await context.newPage()
  const otherFixture = await install(other)
  await other.goto('/orders/pos')
  await expect(other.getByRole('button', { name: 'Відкрити збережений продаж' })).toBeVisible()

  closed = true
  await sale.getByRole('button', { name: 'Перечитати стан', exact: true }).click()
  await expect(sale.getByText('Продаж скасовано. Строк дії рахунку минув, оплату не отримано.')).toBeVisible()
  await expect(sale.getByText('Рахунок прострочено', { exact: true })).toBeVisible()
  await expect(sale.getByRole('img', { name: 'QR для оплати mono' })).toHaveCount(0)
  await expect(sale.getByRole('button', { name: 'Товар видано', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(exit).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sc-pos:v1:17')!).current)).toMatchObject(oldRecord)
  const beforeExit = reads.filter(path => path.endsWith('/' + uuid)).length
  await exit.click()
  await expect(page.getByLabel('Знайти товар')).toBeVisible()
  await expect(other.getByLabel('Знайти товар')).toBeVisible()
  expect(reads.filter(path => path.endsWith('/' + uuid))).toHaveLength(beforeExit + 1)
  expect(await page.evaluate(() => localStorage.getItem('sc-pos:v1:17'))).toBeNull()

  await page.getByLabel('Знайти товар').fill(offer.barcode)
  await page.getByLabel('Знайти товар').press('Enter')
  await expect(page.getByText('Доступно: 1 шт.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Додати: Reuzel Blue' }).click()
  await expect(page.getByRole('button', { name: 'Перейти до оплати', exact: true })).toBeEnabled()
  expect([...fixture.requests, ...otherFixture.requests].filter(request => request.method === 'POST' && request.path.startsWith('/checkouts'))).toEqual([])
})

test('another tab cannot silently replace the invoice the manager confirmed', async ({ page }) => {
  const f = await recoveryFixture(page, 'admin')
  await page.goto('/admin/product-sales?q=9001')
  await page.getByRole('button', { name:'Деталі продажу #9001' }).click()
  const dialog = page.getByRole('dialog', { name:'Деталі продажу' })
  const field = dialog.getByRole('textbox', { name:'ID рахунку mono', exact:true })
  await field.fill('invoice-chosen-in-this-tab')
  const saved = { key:'55555555-5555-4555-8555-555555555555', body:{ invoice_id:'invoice-saved-in-another-tab', expected_revision:2 } }
  await page.evaluate(command => localStorage.setItem('sc-sales:v1:18:pos-attach-invoice:9001', JSON.stringify(command)), saved)
  await dialog.getByRole('button', { name:'Прив’язати наявний рахунок', exact:true }).click()
  await expect(dialog.getByRole('alert')).toContainText('В іншій вкладці збережено інший рахунок')
  await expect(field).toHaveValue(saved.body.invoice_id)
  expect(f.attachments()).toHaveLength(0)
  await dialog.getByRole('button', { name:'Повторити прив’язку', exact:true }).click()
  await expect.poll(() => f.attachments().length).toBe(1)
  expect(f.attachments()[0]).toMatchObject(saved)
})

const closeOrderId = 5
const closeStorageKey = 'sc-sales:v1:18:pos-close-expired-unpaid:5'
const closeButton = 'Перевірити й закрити продаж'
const retryCloseButton = 'Перевірити стан і повторити запит'
async function expiredCloseFixture(page: Page, mode: 'lost' | 'committed' | 'refused' | 'stale' | 'own', admin = true) {
  const user = { id: admin ? 18 : 17, is_active: true, is_superuser: admin, role: admin ? 'admin' : 'barber', can_record_sales: true, can_accept_qr_payments: true, email: 'synthetic@example.test' }
  const own = mode === 'own', saleId = own ? 9005 : closeOrderId
  const requests: { method: string; path: string; key?: string; body: unknown }[] = []
  const external: string[] = []
  let closed = false, quarantined = false, revision = 2
  let releaseResponse: () => void = () => {}
  const firstResponse = new Promise<void>(resolve => { releaseResponse = resolve })
  const state = (id: number, history = true) => {
    const boundLegacySale = id === 4
    const done = id === saleId && closed
    const payment = boundLegacySale || (done && !quarantined) ? 'expired' : 'unknown'
    const receipt = done && quarantined ? 'requires_review' : 'not_requested'
    return {
      order_id: id, checkout_id: uuid, intent_id: '33333333-3333-4333-8333-333333333333',
      revision: id === saleId ? revision : 2, source: 'quick_pos', created_at: '2026-11-09T08:00:00Z',
      employee: { user_id: own ? 18 : 17, master_id: own ? null : 42, display_name: 'Synthetic seller' },
      items: [{ product_id: 248, name: 'Synthetic product', quantity: 1, unit_minor: 62900, total_minor: 62900 }],
      amount_minor: 62900, currency: 'UAH', order_status: done || boundLegacySale ? 'cancelled' : 'pending', status: 'requires_review',
      payment_status: payment, receipt_status: receipt, handover_status: 'not_ready',
      payment: { provider: 'monobank', status: payment, invoice_id: boundLegacySale ? 'synthetic-old-invoice' : null, confirmed_at: null, qr_payload: null },
      receipt: { issuer: 'checkbox', status: receipt, recorded_at: null, pdf_url: null },
      handover: { status: 'not_ready', actor_user_id: null, handed_over_at: null },
      actions: { can_resume: false, can_refresh: false, can_handover: false, can_recover_invoice: own && !history && !done, can_start_new: own && !history && done },
      invoice_recovery: own && id === saleId && !done
        ? { reference: 'synthetic-bank-reference', requested_at: '2026-11-09T08:00:00Z', can_attach: true } : null, can_check_expired_close: admin && id === saleId && !done,
      blocking_reasons: done ? quarantined ? ['master_mono_closed_conflict'] : ['master_mono_sale_closed', 'cancelled'] : ['creation_unknown'],
    }
  }
  const posts = () => requests.filter(request => request.method !== 'GET')
  await page.context().addInitScript(user => {
    localStorage.setItem('backoffice-auth', JSON.stringify({ accessToken: 'synthetic-only', user }))
  }, user)
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.hostname !== '127.0.0.1') { external.push(url.origin); return route.abort('blockedbyclient') }
    if (!path.includes('/api/v1/')) return route.continue()
    requests.push({ path, method: request.method(), key: request.headers()['idempotency-key'], body: request.postData() ? request.postDataJSON() : null })
    if (path.endsWith('/auth/me')) return route.fulfill({ json: user })
    if (path.endsWith('/pos/capabilities')) return route.fulfill({ json: {
      mode: 'mono_checkbox', can_search: true, can_start: true, can_view_admin_sales: admin, automatic_reconciliation_enabled: false, poll_after_ms: 30000,
    } })
    if (path.endsWith('/checkouts/active')) {
      const items = own && !closed ? [state(saleId, false)] : []
      return route.fulfill({ json: { items, total: items.length, page: 1, page_size: 20 } })
    }
    if (own && (path.includes('/checkouts/by-intent/') || path.endsWith('/checkouts/' + uuid))) {
      return route.fulfill({ json: state(saleId, false) })
    }
    if (own && path.endsWith('/orders/' + saleId + '/recover-invoice') && request.method() === 'POST') {
      return route.abort('failed')
    }
    if (path.endsWith('/pos/sales')) {
      const items = [state(3), state(4), state(saleId)].filter(item => !url.searchParams.has('order_status') || item.order_status === url.searchParams.get('order_status'))
      return route.fulfill({ json: { items, total: items.length, page: 1, page_size: 20 } })
    }
    if (/\/pos\/sales\/\d+$/.test(path)) return route.fulfill({ json: state(Number(path.split('/').at(-1))) })
    if (path.endsWith('/master-mono/orders/' + saleId + '/close-expired-unpaid') && request.method() === 'POST') {
      if (mode === 'lost' && posts().length === 1) { await firstResponse; return route.abort('failed') }
      if (mode === 'refused') return route.fulfill({ status: 409, json: { detail: { code: 'master_mono_close_unpaid_unproven' } } })
      closed = true
      revision++
      if (mode === 'committed') return route.abort('failed')
      return route.fulfill({ json: { order_id: saleId, revision, status: 'cancelled' } })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  const open = async (tab: Page, id = saleId) => {
    await tab.getByRole('button', { name: `Деталі продажу #${id}` }).click()
    const dialog = tab.getByRole('dialog', { name: 'Деталі продажу' })
    await expect(dialog.getByRole('heading', { name: `Продаж #${id}` })).toBeVisible()
    return dialog
  }
  return { requests, external, posts, open, saleId, releaseResponse, changeRevision: () => { revision++ }, quarantine: () => { quarantined = true; revision++ } }
}

test('admin expired close confirms the canonical sale after a lost success and shows later quarantine', async ({ page }) => {
  const fixture = await expiredCloseFixture(page, 'committed')
  await page.goto('/admin/product-sales')
  await page.getByLabel('Статус замовлення', { exact: true }).click()
  await page.getByRole('option', { name: 'Очікує', exact: true }).click()
  await page.getByRole('button', { name: 'Застосувати фільтри' }).click()
  const dialog = await fixture.open(page)
  await expect(dialog.getByText(/Резерв звільниться, лише якщо/)).toBeVisible()
  await dialog.getByRole('button', { name: closeButton }).click()
  await expect(dialog.getByText('Продаж закрито. Резерв товару знято.')).toBeVisible()
  await expect(page.locator('button[aria-label="Деталі продажу #5"]')).toHaveCount(0)
  const [post] = fixture.posts()
  expect(post.body).toEqual({ expected_revision: 2 })
  expect(post.key).toMatch(/^[a-f0-9-]{14}4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  const reads = fixture.requests.filter(r => r.path.endsWith('/pos/sales/5') || r === post)
  expect(reads.map(r => r.method)).toEqual(['GET', 'GET', 'POST', 'GET'])
  expect(await page.evaluate(key => localStorage.getItem(key), closeStorageKey)).toBeNull()
  fixture.quarantine()
  await dialog.getByRole('button', { name: 'Перечитати стан', exact: true }).click()
  await expect(dialog.getByText('Продаж закрито. Нові дані про оплату потребують звірки.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: closeButton })).toHaveCount(0)
  expect(fixture.posts()).toHaveLength(1)
  expect(fixture.external).toEqual([])
})

test('admin expired close persists the original key, excludes another tab, and retries only after explicit GET', async ({ page }) => {
  const fixture = await expiredCloseFixture(page, 'lost')
  const other = await page.context().newPage()
  await Promise.all([page.goto('/admin/product-sales'), other.goto('/admin/product-sales')])
  const [first, second] = await Promise.all([fixture.open(page), fixture.open(other)])
  try {
    await first.getByRole('button', { name: closeButton }).click()
    await expect.poll(() => fixture.posts().length).toBe(1)
    await second.getByRole('button', { name: retryCloseButton }).click()
    await expect(second.getByText(/В іншій вкладці вже триває/)).toBeVisible()
    expect(fixture.posts()).toHaveLength(1)
  } finally {
    fixture.releaseResponse()
  }
  await expect(first.getByText(/Закриття не підтверджено. Запит збережено/)).toBeVisible()
  await page.reload()
  const restored = await fixture.open(page)
  await expect(restored.getByRole('button', { name: retryCloseButton })).toBeVisible()
  const [post] = fixture.posts()
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), closeStorageKey)
  expect(saved).toEqual({ key: post.key, body: post.body })
  expect(fixture.posts()).toHaveLength(1)
  const offset = fixture.requests.length
  await restored.getByRole('button', { name: retryCloseButton }).click()
  await expect(restored.getByText('Продаж закрито. Резерв товару знято.')).toBeVisible()
  expect(fixture.posts()).toEqual([post, post])
  expect(fixture.requests.slice(offset, offset + 3).map(r => r.method)).toEqual(['GET', 'POST', 'GET'])
  expect(fixture.external).toEqual([])
})

test('admin expired close hides the action for unknown order 3 and stops on a stale revision', async ({ page }) => {
  const fixture = await expiredCloseFixture(page, 'stale')
  await page.goto('/admin/product-sales')
  const unknown = await fixture.open(page, 3)
  await expect(unknown.getByRole('region', { name: 'Закриття простроченого продажу' })).toHaveCount(0)
  await unknown.press('Escape')
  const ordinaryCancellation = await fixture.open(page, 4)
  await expect(ordinaryCancellation.getByRole('region', { name: 'Закриття простроченого продажу' })).toHaveCount(0)
  await ordinaryCancellation.press('Escape')
  const candidate = await fixture.open(page)
  fixture.changeRevision()
  await candidate.getByRole('button', { name: closeButton }).click()
  await expect(candidate.getByText(/Стан продажу змінився/)).toBeVisible()
  expect(fixture.posts()).toEqual([])
  expect(await page.evaluate(key => localStorage.getItem(key), closeStorageKey)).toBeNull()
})

test('admin expired close preserves the command when bank proof is refused', async ({ page }) => {
  const fixture = await expiredCloseFixture(page, 'refused')
  await page.goto('/admin/product-sales')
  const dialog = await fixture.open(page)
  await dialog.getByRole('button', { name: closeButton }).click()
  await expect(dialog.getByText('Перевірка mono та чека не підтвердила умови закриття.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: retryCloseButton })).toBeVisible()
  await expect(dialog.getByText('Продаж закрито. Резерв товару знято.')).toHaveCount(0)
  expect(fixture.posts()).toHaveLength(1)
  expect(await page.evaluate(key => localStorage.getItem(key), closeStorageKey)).toContain(fixture.posts()[0].key)
})

test('master cannot access the admin expired close or trigger any sale command', async ({ page }) => {
  const fixture = await expiredCloseFixture(page, 'stale', false)
  await page.goto('/admin/product-sales')
  await expect(page).toHaveURL(/\/orders\/pos/)
  await expect(page.getByRole('button', { name: closeButton })).toHaveCount(0)
  expect(fixture.requests.some(r => r.path.includes('/pos/sales'))).toBe(false)
  expect(fixture.posts()).toEqual([])
})


test('own-admin expired close archives an exact lost bind only on fresh terminal exit, without replay', async ({ page, context }) => {
  const fixture = await expiredCloseFixture(page, 'own')
  const id = fixture.saleId
  const pendingKey = `sc-sales:v1:18:pos-attach-invoice:${id}`
  const archiveKey = `sc-sales:v1:18:pos-attach-invoice-closed:${id}`
  const foreignOrder = 'sc-sales:v1:18:pos-attach-invoice:3'
  const foreignActor = `sc-sales:v1:17:pos-attach-invoice:${id}`
  await page.addInitScript(({ foreignOrder, foreignActor }) => {
    if (localStorage.getItem('own-closure-initialized')) return
    localStorage.setItem('own-closure-initialized', 'true')
    const token = '55555555-5555-4555-8555-555555555555'
    const record = { checkout_id: '22222222-2222-4222-8222-222222222222', body: {
      intent_id: '33333333-3333-4333-8333-333333333333', currency: 'UAH', selection_only: true,
    } }
    localStorage.setItem('sc-pos:v1:18', JSON.stringify({ version: 2, current: record, selection_token: token, deferred: [] }))
    sessionStorage.setItem('sc-pos:v1:18:selection', token)
    localStorage.setItem(foreignOrder, 'foreign-order-record')
    localStorage.setItem(foreignActor, 'foreign-actor-record')
  }, { foreignOrder, foreignActor })
  await page.goto('/orders/pos')
  const sale = page.getByRole('region', { name: 'Поточний продаж' })
  await expect(sale.getByText(`Продаж #${id}`, { exact: true })).toBeVisible()

  const history = await context.newPage()
  await history.goto('/admin/product-sales')
  const dialog = await fixture.open(history)
  await dialog.getByLabel('ID рахунку mono').fill('saved-synthetic-invoice')
  await dialog.getByRole('button', { name: 'Прив’язати наявний рахунок', exact: true }).click()
  await expect(dialog.getByText(/Результат прив’язки не підтверджено/)).toBeVisible()
  const pending = await page.evaluate(key => localStorage.getItem(key), pendingKey)
  expect(JSON.parse(pending!)).toEqual({ key: fixture.posts()[0].key, body: { invoice_id: 'saved-synthetic-invoice', expected_revision: 2 } })

  const stale = await context.newPage()
  await stale.goto('/admin/product-sales')
  const staleDialog = await fixture.open(stale)
  const staleRetry = staleDialog.getByRole('button', { name: 'Повторити прив’язку', exact: true })
  await expect(staleRetry).toBeVisible()

  await dialog.getByRole('button', { name: closeButton }).click()
  await expect(dialog.getByText('Продаж закрито. Резерв товару знято.')).toBeVisible()
  await page.reload()
  const exit = sale.getByRole('button', { name: 'До пошуку товарів', exact: true })
  await expect(exit).toBeVisible()
  expect(await page.evaluate(key => localStorage.getItem(key), pendingKey)).toBe(pending)
  const offset = fixture.requests.length
  await exit.click()
  await expect(page.getByLabel('Знайти товар')).toBeVisible()
  expect(fixture.requests.slice(offset).filter(r => r.path.endsWith('/checkouts/' + uuid)).map(r => r.method)).toEqual(['GET'])
  const storage = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [pendingKey, archiveKey, foreignOrder, foreignActor])
  expect(storage).toEqual([null, pending, 'foreign-order-record', 'foreign-actor-record'])

  await staleRetry.click()
  await expect(staleDialog.getByText('Продаж закрито. Резерв товару знято.')).toBeVisible()
  expect(fixture.posts().map(r => r.path.split('/').at(-1))).toEqual(['recover-invoice', 'close-expired-unpaid'])
  expect(await page.evaluate(key => localStorage.getItem(key), pendingKey)).toBeNull()
  expect(fixture.external).toEqual([])
})
