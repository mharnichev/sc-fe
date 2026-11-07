import { test, expect, type Page } from '@playwright/test'
const offer = {id:101,name:'Reuzel Blue',brand_name:'Reuzel',sku:'R-001',barcode:'00000101',image_url:'/media/pos-test.svg',variant_label:'113 г',amount_minor:31000,currency:'UAH',available_quantity:2,can_sell:true,blocking_reasons:[]}
const uuid='22222222-2222-4222-8222-222222222222'
async function setup(page:Page, options:{role?:'master'|'admin';lostCreate?:boolean;priceChange?:boolean;lostHandover?:boolean;manualRefresh?:boolean}={}) {
 const role=options.role || 'master', user={id:role==='admin'?18:17,is_active:true,is_superuser:role==='admin',role:role==='admin'?'admin':'barber',master_id:role==='admin'?null:42,can_record_sales:true,can_accept_qr_payments:true,email:'synthetic@example.test'}
 let current:any=null, revoked=false, paused=false, handovers=0, creates=0
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
  if(!url.pathname.includes('/backoffice/pos/'))return route.fulfill({json:[]})
  const path=url.pathname.split('/backoffice/pos')[1],body=req.postData()?req.postDataJSON():null
  requests.push({path,method:req.method(),body,key:req.headers()['idempotency-key'],query:url.searchParams})
  if(revoked)return route.fulfill({status:403,json:{detail:{code:'permission_denied'}}})
  if(path==='/capabilities')return route.fulfill({json:{mode:'mono_checkbox',currency:'UAH',max_quantity:1,can_search:true,can_start:!paused,can_view_admin_sales:role==='admin',automatic_reconciliation_enabled:options.manualRefresh !== true,poll_after_ms:30000,blocking_reasons:[]}})
  if(path==='/products')return route.fulfill({json:{items:[offer,{...offer,id:102,name:'Reuzel Green',sku:'R-002',barcode:'00000102',available_quantity:0,can_sell:false}],total:2,page:1,page_size:20}})
  if(path==='/checkouts/active')return route.fulfill({json:{items:current&&current.status!=='completed'?[current]:[],total:current?1:0,page:1,page_size:20}})
  if(path.startsWith('/checkouts/by-intent/'))return current?route.fulfill({json:current}):route.fulfill({status:404,json:{detail:{code:'missing'}}})
  if(path==='/checkouts'){
   creates++
   if(options.priceChange && body.expected_amount_minor!==32000)return route.fulfill({status:409,json:{detail:{code:'price_changed',current_offer:{...offer,amount_minor:32000}}}})
   current={checkout_id:uuid,intent_id:body.intent_id,order_id:9001,revision:3,created_at:'2026-11-06T10:00:00Z',employee:{user_id:user.id,master_id:user.master_id,display_name:'Synthetic seller'},items:[{product_id:101,name:offer.name,sku:offer.sku,barcode:offer.barcode,image_url:offer.image_url,variant_label:offer.variant_label,quantity:1,unit_minor:body.expected_amount_minor,total_minor:body.expected_amount_minor}],order_status:'pending',amount_minor:body.expected_amount_minor,currency:'UAH',status:'awaiting_payment',payment:{provider:'monobank',status:'pending',invoice_id:'POS_SYNTHETIC_INVOICE_101',confirmed_at:null,qr_payload:'https://pay.mbnk.biz/POS_SYNTHETIC_INVOICE_101'},receipt:{issuer:'checkbox',status:'not_requested',recorded_at:null,pdf_url:null},handover:{status:'not_ready',actor_user_id:null,handed_over_at:null},actions:{can_resume:false,can_refresh:true,can_handover:false,can_recover_invoice:false,can_start_new:false},poll_after_ms:30000,blocking_reasons:[]}
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
async function select(page:Page){await page.getByLabel('Знайти товар',{exact:true}).fill('00000101');await page.getByLabel('Знайти товар',{exact:true}).press('Enter');await page.getByRole('button',{name:/Продати: Reuzel Blue/}).click()}
for(const role of ['master','admin'] as const)test(`${role}: same one-tap sale, QR, backend receipt then one explicit handover`,async({page})=>{
 await page.clock.install();const f=await setup(page,{role,lostHandover:true});await page.goto('/orders/pos')
 expect(f.requests.filter(r=>r.method==='POST')).toHaveLength(0)
 await select(page);await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible();expect(f.requests.find(r=>r.path==='/products')?.query.get('q')).toBe('00000101')
 const create=f.requests.find(r=>r.path==='/checkouts')!;expect(Object.keys(create.body).sort()).toEqual(['currency','expected_amount_minor','intent_id','product_id','quantity']);expect(create.body.quantity).toBe(1);expect(f.current.employee.user_id).toBe(role==='admin'?18:17)
 f.truth('pending');await page.clock.runFor(30000);await expect(page.getByRole('img',{name:'QR для оплати mono'})).toHaveCount(0);await expect(page.getByText(/Повторно платити не потрібно/)).toBeVisible();await expect(page.getByRole('button',{name:'Товар видано',exact:true})).toHaveCount(0)
 f.truth('receipt_error');await page.clock.runFor(30000);await expect(page.getByText(/Чек потребує перевірки адміністратора/)).toBeVisible();expect(f.requests.filter(r=>r.path==='/checkouts')).toHaveLength(1)
 f.truth('ready');await page.clock.runFor(30000);const handover=page.getByRole('button',{name:'Товар видано',exact:true});await expect(handover).toBeEnabled();expect((await handover.boundingBox())!.height).toBeGreaterThanOrEqual(44);await handover.focus();await expect(handover).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Товар видано',exact:true})).not.toBeFocused();await handover.evaluate((button:HTMLButtonElement)=>{button.click();button.click()})
 await expect(page.getByRole('button',{name:'Відновити цей продаж',exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Продаж завершено. Товар видано.',{exact:true})).toBeVisible();expect(f.handovers).toBe(1)
 await expect(page.getByRole('button',{name:'Новий продаж',exact:true})).toBeVisible();expect(f.external).toEqual([]);expect(f.consoleErrors).toEqual([])
})
test('changed price is confirmed explicitly and the same intent/key survives reload',async({page})=>{
 const f=await setup(page,{priceChange:true});await page.goto('/orders/pos');await select(page);await expect(page.getByText('Ціна товару змінилася',{exact:true})).toBeVisible();const first=f.requests.find(r=>r.path==='/checkouts')!;await page.reload();expect(f.requests.filter(r=>r.path==='/checkouts')).toHaveLength(1);await page.getByRole('button',{name:'Погоджуюсь на нову ціну'}).click();await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible();const posts=f.requests.filter(r=>r.path==='/checkouts');expect(posts[1].key).toBe(first.key);expect(posts[1].body.intent_id).toBe(first.body.intent_id);expect(posts[1].body.expected_amount_minor).toBe(32000)
})
test('lost create resumes by intent; unknown state cannot expose QR or offer a new invoice',async({page})=>{
 const f=await setup(page,{lostCreate:true,manualRefresh:true});await page.goto('/orders/pos');await select(page);await expect(page.getByRole('button',{name:'Відновити цей продаж',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible();expect(f.requests.filter(r=>r.path==='/checkouts')).toHaveLength(1);f.truth('unknown');await page.getByRole('button',{name:'Оновити стан',exact:true}).click();await expect(page.getByText(/Потрібна перевірка адміністратора/)).toBeVisible();await expect(page.getByRole('img',{name:'QR для оплати mono'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Новий продаж',exact:true})).toHaveCount(0)
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
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});const qr=page.getByRole('img',{name:'QR для оплати mono'});const box=await qr.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(240);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(await page.locator('html').getAttribute('data-backoffice-theme')).toBe(theme);measurements.push({width,qr:box,overflow:await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)});await page.screenshot({path:`/tmp/sc-pos-20261106/pos-fixes/pos-${role}-${theme}-${width}.png`,fullPage:true})}
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
 await page.screenshot({path:'/tmp/sc-pos-20261106/pos-fixes/admin-history-320.png',fullPage:true})
 await testInfo.attach('history-calendar-measurement',{body:JSON.stringify({width:320,openOverflow,filters:Object.fromEntries(f.requests.filter(r=>r.path==='/sales').at(-1)!.query)}),contentType:'application/json'})
 expect(openOverflow).toBe(0)
})


test('pause creation after payment still restores and hands over the existing sale exactly once',async({page})=>{
 const f=await setup(page,{lostHandover:true});await page.goto('/orders/pos');await select(page);await expect(page.getByRole('img',{name:'QR для оплати mono'})).toBeVisible()
 f.truth('ready');f.pause();await page.reload()
 const hand=page.getByRole('button',{name:'Товар видано',exact:true});await expect(hand).toBeEnabled()
 await page.screenshot({path:'/tmp/sc-pos-20261106/pos-fixes/paused-ready-mobile.png',fullPage:true})
 await hand.evaluate((button:HTMLButtonElement)=>{button.click();button.click()});await expect(page.getByRole('button',{name:'Відновити цей продаж',exact:true})).toBeVisible()
 const sent=f.requests.find(r=>r.path.endsWith('/handover'))!;expect(sent.key).toMatch(/^[0-9a-f-]{36}$/)
 await page.reload();await expect(page.getByText('Продаж завершено. Товар видано.',{exact:true})).toBeVisible();expect(f.handovers).toBe(1);expect(f.requests.filter(r=>r.path==='/checkouts')).toHaveLength(1)
 await expect(page.getByRole('button',{name:'Новий продаж',exact:true})).toHaveCount(0)
})
test('debounced typing and Enter produce one retail GET, never a checkout POST',async({page})=>{
 const f=await setup(page);await page.goto('/orders/pos');const input=page.getByLabel('Знайти товар',{exact:true})
 await input.fill('Re');await input.fill('Reuzel');await expect(page.getByRole('button',{name:/Продати: Reuzel Blue/})).toBeVisible()
 expect(f.requests.filter(r=>r.path==='/products').length).toBe(1);expect(f.requests.filter(r=>r.method==='POST')).toHaveLength(0)
 await input.fill('SKU');await input.press('Enter');await page.waitForTimeout(400)
 expect(f.requests.filter(r=>r.path==='/products'&&r.query.get('q')==='SKU')).toHaveLength(1)
 expect(f.requests.filter(r=>r.method==='POST')).toHaveLength(0)
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
 await expect(page.getByLabel('Знайти товар',{exact:true})).toHaveValue('123456789012');await expect(page.getByRole('button',{name:/Продати: Reuzel Blue/})).toBeVisible()
 expect(retail).toEqual(['0123456789012','123456789012','123456789012']);expect(leaks).toEqual([]);expect(f.requests.filter(r=>r.method==='POST')).toHaveLength(0);expect(f.external).toEqual([])
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
 await input.fill('fresh');await input.press('Enter');await expect(page.getByRole('button',{name:/Продати: Fresh response/})).toBeVisible()
 release();await page.waitForTimeout(350);await expect(page.getByRole('button',{name:/Продати: Old response/})).toHaveCount(0)
 expect(f.requests.filter(r=>r.method==='POST')).toHaveLength(0)
})
for(const theme of ['light','dark'])for(const role of ['master','admin'] as const)test(`search render ${role} ${theme} at 320/390/1440`,async({page},testInfo)=>{
 const f=await setup(page,{role});await page.addInitScript(theme=>localStorage.setItem('soulcuts-backoffice-theme',theme),theme);await page.goto('/orders/pos')
 await page.getByLabel('Знайти товар',{exact:true}).fill('Reuzel');await expect(page.getByRole('button',{name:/Продати: Reuzel Blue/})).toBeVisible()
 const measurements=[]
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});const input=page.getByLabel('Знайти товар',{exact:true}),product=page.getByRole('button',{name:/Продати: Reuzel Blue/}),scan=page.getByRole('button',{name:'Сканувати штрихкод',exact:true})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);expect(overflow).toBe(0);expect((await scan.boundingBox())!.height).toBeGreaterThanOrEqual(44);expect((await product.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await input.focus();await expect(input).toBeFocused();expect(await page.locator('html').getAttribute('data-backoffice-theme')).toBe(theme)
  measurements.push({width,overflow,input:await input.boundingBox(),product:await product.boundingBox(),scan:await scan.boundingBox()})
  await page.screenshot({path:`/tmp/sc-pos-20261106/pos-fixes/search-${role}-${theme}-${width}.png`,fullPage:true})
 }
 await testInfo.attach('search-measurements',{body:JSON.stringify(measurements),contentType:'application/json'});expect(f.requests.filter(r=>r.method==='POST')).toHaveLength(0);expect(f.external).toEqual([]);expect(f.consoleErrors).toEqual([])
})
