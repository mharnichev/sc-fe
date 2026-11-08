import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const source = await readFile(new URL('../composables/usePosSale.ts', import.meta.url), 'utf8')
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
let sequence=0
const offer = { id: 8, name: 'Reuzel', brand_name: 'Reuzel', sku: 'R8', barcode: '00123', image_url: null, variant_label: '350 мл', amount_minor: 35000, currency: 'UAH', available_quantity: 2, can_sell: true, blocking_reasons: [] }
const cart = (id=offer.id) => ({items:[{product_id:id,quantity:1}],promo_code:null})
const quote = (id=offer.id, amount=35000, revision='1') => ({
  items:[{product_id:id,quantity:1,base_unit_minor:amount,unit_minor:amount,promotion_id:null,promotion_name:null,promotion_code:null}],
  subtotal_minor:amount,discount_minor:0,amount_minor:amount,currency:'UAH',applied_promo_code:null,promotion_id:null,available_promotions:[],quote_revision:revision.repeat(64),
})
const start = (sale,id=offer.id) => sale.startCart(cart(id),quote(id),{[id]:offer.name})
const state = (extra={}) => ({ checkout_id:'11111111-1111-4111-8111-111111111111', intent_id:'22222222-2222-4222-8222-222222222222', order_id:3,revision:1,created_at:'2026-11-06T12:00:00Z',employee:{user_id:1,master_id:null,display_name:'Seller'},items:[{product_id:8,name:'Reuzel',sku:'R8',barcode:'00123',image_url:null,variant_label:'350 мл',quantity:1,unit_minor:35000,total_minor:35000}],order_status:'pending',amount_minor:35000,currency:'UAH',status:'awaiting_payment',payment:{provider:'monobank',status:'pending',invoice_id:'invoice-1',confirmed_at:null,qr_payload:'https://pay.mbnk.biz/invoice-1'},receipt:{issuer:'checkbox',status:'not_requested',recorded_at:null,pdf_url:null},handover:{status:'not_ready',actor_user_id:null,handed_over_at:null},actions:{can_resume:false,can_refresh:true,can_handover:false,can_recover_invoice:false,can_start_new:false},poll_after_ms:3000,blocking_reasons:[],...extra })
async function setup(send, storage=new Map(), user={id:1,is_active:true,is_superuser:true}) {
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async (_key,_options,run)=>run({})}}})
 const auth=vue.reactive({user,accessToken:'token-A'}), calls=[]
 const api=async (path,options={})=>{calls.push({path,...options});return send(path,options)}
 Object.assign(globalThis,vue,{useApi:()=>api,useAuthStore:()=>auth,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{addEventListener(){},removeEventListener(){}},setTimeout:()=>1,clearTimeout:()=>{}})
 const js=compile(source.replace(/^import .*\n/gm,'').replace(/import\.meta\.client/g,'true'))
 const module=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${sequence++}`)
 const scope=vue.effectScope(), sale=scope.run(()=>module.usePosSale())
 await sale.init()
 return {sale,auth,calls,storage,stop:()=>scope.stop(),module}
}
const base=(path)=>path.endsWith('/capabilities')?{mode:'mono_checkbox',currency:'UAH',max_quantity:1,cart_limits:{max_items:100,max_quantity:100},can_search:true,can_start:true,can_view_admin_sales:true,automatic_reconciliation_enabled:true,poll_after_ms:3000,blocking_reasons:[]}:path.includes('/active')?{items:[],total:0,page:1,page_size:20}:null
const error=(status,code,extra={})=>({response:{status},data:{detail:{code,...extra}}})
test('search/init have no write; only explicit payment starts the anonymous cart checkout',async()=>{
 const f=await setup((path,options)=>base(path) || (path.includes('/products')?{items:[offer],total:1,page:1,page_size:20}:state({intent_id:options.body?.intent_id})))
 await f.sale.search('00123');assert.equal(f.calls.filter(c=>c.method==='POST').length,0)
 await start(f.sale);const post=f.calls.find(c=>c.method==='POST');assert.deepEqual(Object.keys(post.body).sort(),['currency','intent_id','items','promo_code','quote_revision']);assert.deepEqual(post.body.items,cart().items);assert.equal(post.body.quote_revision,'1'.repeat(64));assert.ok(post.headers['Idempotency-Key']);f.stop()
})
test('price change requires explicit confirmation; same persisted identity and key survive reload',async()=>{
 let reject=true
 const send=(path,options)=>{const b=base(path);if(b)return b;if(path.includes('/by-intent/'))throw error(404,'missing');if(reject)throw error(409,'price_changed',{current_quote:quote(8,40000,'2')});return state({intent_id:options.body.intent_id,amount_minor:40000})}
 const f=await setup(send);await start(f.sale);assert.equal(f.sale.priceQuote.value.amount_minor,40000);const original=f.calls.find(c=>c.method==='POST');f.stop()
 const g=await setup(send,f.storage);assert.equal(g.calls.filter(c=>c.method==='POST').length,0);reject=false;await g.sale.confirmPrice();const post=g.calls.find(c=>c.method==='POST');assert.equal(post.headers['Idempotency-Key'],original.headers['Idempotency-Key']);assert.equal(post.body.intent_id,original.body.intent_id);assert.equal(post.body.quote_revision,'2'.repeat(64));g.stop()
})
test('lost creation response recovers by intent without new invoice or key',async()=>{
 let body
 const f=await setup((path,options)=>{const b=base(path);if(b)return b;if(path.includes('/by-intent/'))return state({intent_id:body.intent_id});body=options.body;throw new Error('timeout')})
 await start(f.sale);assert.ok(f.sale.error.value);f.stop()
 const g=await setup(path=>base(path)||state({intent_id:body.intent_id}),f.storage);assert.equal(g.calls.filter(c=>c.method==='POST').length,0);assert.equal(g.sale.checkout.value.order_id,3);g.stop()
})
test('URL, receipt and handover guards fail closed; backend alone establishes readiness',async()=>{
 const f=await setup((path,options)=>base(path)||state({intent_id:options.body?.intent_id}));await start(f.sale)
 assert.equal(f.sale.paymentUrl.value,'https://pay.mbnk.biz/invoice-1')
 f.sale.checkout.value=state({payment:{...state().payment,qr_payload:'https://evil.test/x'}});assert.equal(f.sale.paymentUrl.value,null)
 f.sale.checkout.value=state({status:'paid_receipt_pending',payment:{...state().payment,status:'paid'},receipt:{...state().receipt,status:'failed'},actions:{...state().actions,can_handover:true}});assert.equal(f.sale.paymentUrl.value,null);await f.sale.handover();assert.equal(f.calls.filter(c=>c.path.endsWith('/handover')).length,0);f.stop()
})
test('late reply from previous actor never becomes a current sale',async()=>{
 let finish
 const deferred=new Promise(resolve=>{finish=resolve})
 const f=await setup((path)=>base(path)||deferred);const pending=start(f.sale)
 f.auth.user={id:2,is_active:true,is_superuser:true};await vue.nextTick();finish(state());await pending;assert.equal(f.sale.checkout.value,null);f.stop()
})


test('same product can be sold again only after backend completion allows new intent',async()=>{
 const f=await setup((path,options)=>base(path)||state({intent_id:options.body?.intent_id}));await start(f.sale)
 const first=f.calls.find(c=>c.method==='POST')
 await f.sale.startNew();assert.equal(f.sale.saved.value.body.intent_id,first.body.intent_id)
 f.sale.checkout.value=state({intent_id:first.body.intent_id,status:'completed',handover:{status:'handed_over',actor_user_id:1,handed_over_at:'2026-11-06T12:00:00Z'},actions:{...state().actions,can_start_new:true}})
 await f.sale.startNew();await start(f.sale)
 const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts.length,2);assert.notEqual(posts[0].body.intent_id,posts[1].body.intent_id);assert.notEqual(posts[0].headers['Idempotency-Key'],posts[1].headers['Idempotency-Key']);f.stop()
})
test('a duplicated view with a persisted intent resumes it instead of selecting another product',async()=>{
 const f=await setup((path,options)=>base(path)||state({intent_id:options.body?.intent_id}));await start(f.sale);const identity=f.sale.saved.value.body.intent_id;f.stop()
 const g=await setup(path=>base(path)||state({intent_id:identity}),f.storage);await start(g.sale,9);assert.equal(g.calls.filter(c=>c.method==='POST').length,0);assert.equal(g.sale.saved.value.body.intent_id,identity);g.stop()
})
for(const change of ['token','inactive','rights'])test(`late checkout is fenced on ${change}`,async()=>{
 let finish;const response=new Promise(resolve=>{finish=resolve})
 const f=await setup(path=>base(path)||response);const pending=start(f.sale)
 if(change==='token')f.auth.accessToken='token-B'
 else if(change==='inactive')f.auth.user.is_active=false
 else {f.auth.user.is_superuser=false;f.auth.user.can_record_sales=false;f.auth.user.can_accept_qr_payments=false}
 await vue.nextTick();finish(state());await pending;assert.equal(f.sale.checkout.value,null);f.stop()
})

test('paused new invoices do not block own paid ready checkout after reload or its exact one handover',async()=>{
 const storage=new Map()
 let committed, posts=[]
 const send=(path,options)=>{
  const b=base(path)
  if(path.endsWith('/capabilities'))return {...b,can_start:false,can_search:true}
  if(path.includes('/active'))return b
  if(path.includes('/by-intent/'))return committed
  if(path.endsWith('/handover')){posts.push(options);committed={...committed,revision:4,status:'completed',handover:{status:'handed_over',actor_user_id:1,handed_over_at:'2026-11-06T12:05:00Z'},actions:{...state().actions,can_start_new:true}};throw new Error('lost acknowledgement')}
  return committed
 }
 const body={intent_id:'22222222-2222-4222-8222-222222222222',product_id:8,quantity:1,expected_amount_minor:35000,currency:'UAH'}
 storage.set('sc-pos:v1:1',JSON.stringify({key:'33333333-3333-4333-8333-333333333333',body,offer}))
 committed=state({intent_id:body.intent_id,status:'ready_to_handover',revision:3,payment:{...state().payment,status:'paid',qr_payload:null},receipt:{...state().receipt,status:'accepted'},handover:{status:'ready',actor_user_id:null,handed_over_at:null},actions:{...state().actions,can_handover:true}})
 const f=await setup(send,storage);assert.equal(f.sale.allowed.value,false);assert.equal(f.sale.canHandover.value,true)
 await f.sale.handover();assert.equal(posts.length,1);assert.ok(posts[0].headers['Idempotency-Key']);const key=f.sale.saved.value.command.key;assert.equal(key,posts[0].headers['Idempotency-Key']);f.stop()
 const g=await setup(send,storage);assert.equal(g.sale.checkout.value.handover.status,'handed_over');assert.equal(posts.length,1);assert.equal(g.calls.filter(c=>c.path==='/backoffice/pos/checkouts').length,0);g.stop()
})
test('a pending command cannot bypass the latest server action prohibition',async()=>{
 const f=await setup((path,options)=>base(path)||state({intent_id:options.body?.intent_id}));await start(f.sale)
 f.sale.saved.value={...f.sale.saved.value,command:{operation:'handover',key:'33333333-3333-4333-8333-333333333333',revision:1}}
 await f.sale.handover();assert.equal(f.calls.filter(c=>c.path.endsWith('/handover')).length,0);f.stop()
})

async function searchComponent(send) {
 const props=vue.reactive({results:{items:[],total:0,page:1,page_size:20},loading:false,disabled:false,error:''}),events=[],timers=new Map(),cleanup=[]
 let nextTimer=0
 Object.assign(globalThis,vue,{defineProps:()=>props,defineEmits:()=>(...args)=>events.push(args),useAssetUrl:()=>String,useApi:()=>send,posMoney:String,
  watch:(...args)=>{const stop=vue.watch(...args);cleanup.push(stop);return stop},onScopeDispose:fn=>cleanup.push(fn),
  setTimeout:(fn,ms)=>{assert.equal(ms,275);timers.set(++nextTimer,fn);return nextTimer},clearTimeout:id=>timers.delete(id)})
 const raw=(await readFile(new URL('../components/pos/PosSaleSearch.vue',import.meta.url),'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm,'')
 const js=compile(raw+'\nexport { query, submit, scanned, lookupBarcode, openCamera };')
 const module=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#search${sequence++}`)
 return {module,props,events,timers,fire:async()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());await vue.nextTick()},stop:()=>cleanup.forEach(fn=>fn())}
}
test('POS barcode normalization uses only lean exact retail GET and never inventory/cost payload',async()=>{
 const calls=[]
 const f=await searchComponent(async(path,options)=>{calls.push({path,options});return {items:[{...offer,barcode:options.query.q==='0123456789012'?'other':'123456789012'}],total:1,page:1,page_size:50}})
 const raw=(await readFile(new URL('../utils/barcodeCamera.ts',import.meta.url),'utf8')).replace(/^import .*\n/gm,'')
 const decoder=await import(`data:text/javascript;base64,${Buffer.from(compile(raw)).toString('base64')}`)
 assert.equal(await decoder.resolveCameraBarcode('0123456789012',f.module.lookupBarcode),'123456789012')
 assert.deepEqual(calls.map(c=>[c.path,c.options.query.q]),[['/backoffice/pos/products','0123456789012'],['/backoffice/pos/products','123456789012']])
 assert.ok(calls.every(c=>!c.options.method || c.options.method==='GET'))
 assert.deepEqual(await f.module.lookupBarcode('123456789012'),{barcode:'123456789012'})
 f.stop()
})
test('typeahead debounces without disabling typing and Enter/scan/unmount clear the queued search',async()=>{
 const f=await searchComponent(async()=>({items:[],total:0,page:1,page_size:50}))
 f.module.query.value='Re';f.module.query.value='Reuzel';await vue.nextTick();assert.equal(f.events.length,0);assert.equal(f.timers.size,1)
 f.module.submit();await f.fire();assert.deepEqual(f.events,[['search','Reuzel',1]])
 f.props.loading=true;f.module.query.value='Green';await vue.nextTick();await f.fire();assert.equal(f.events.at(-1)[1],'Green')
 f.module.scanned('00000101');await vue.nextTick();await f.fire();assert.equal(f.events.filter(e=>e[1]==='00000101').length,1)
 f.module.query.value='cancel';await vue.nextTick();f.props.disabled=true;await vue.nextTick();await f.fire();assert.equal(f.events.some(e=>e[1]==='cancel'),false)
 f.props.disabled=false;f.module.query.value='unmount';await vue.nextTick();f.stop();await f.fire();assert.equal(f.events.some(e=>e[1]==='unmount'),false)
})
test('BarcodeCamera defaults to inventory for old consumers and honors the injected POS lookup',async()=>{
 const raw=(await readFile(new URL('../components/inventory/BarcodeCamera.vue',import.meta.url),'utf8')).split('<script setup lang="ts">')[1].split('</script>')[0].replace(/^import .*\n/gm,'')
 const utility=(await readFile(new URL('../utils/barcodeCamera.ts',import.meta.url),'utf8')).replace(/^import .*\n/gm,'')
 const decoder=await import(`data:text/javascript;base64,${Buffer.from(compile(utility)).toString('base64')}`)
 for(const injected of [false,true]) {
  const mounts=[],cleanup=[],calls=[],events=[]
  const retail=async barcode=>{calls.push('retail');return {barcode}}
  Object.assign(globalThis,vue,{defineProps:()=>({lookupBarcode:injected?retail:undefined}),defineEmits:()=>(...args)=>events.push(args),useBackofficeApi:()=>({lookupInventoryProductByBarcode:async barcode=>{calls.push('inventory');return {barcode,purchase_unit_cost:'12.34'}}}),
   onMounted:fn=>mounts.push(fn),onBeforeUnmount:fn=>cleanup.push(fn),createCameraDecoder:async()=>({decode:async()=> '0123456789012',dispose(){}}),resolveCameraBarcode:decoder.resolveCameraBarcode,stopCameraTracks(){},cameraErrorMessage:String,
   window:{isSecureContext:true,addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}}})
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[]})}}})
  const js=compile(raw+'\nexport { videoRef };')
  const camera=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#camera${sequence++}`)
  camera.videoRef.value={play:async()=>{},srcObject:null}
  await mounts[0]();for(let i=0;i<8;i++)await Promise.resolve()
  assert.deepEqual(calls,[injected?'retail':'inventory']);assert.deepEqual(events,[['recognized','0123456789012']]);cleanup.forEach(fn=>fn())
 }
})


test('opening camera clears a queued typed search before decoding',async()=>{
 const f=await searchComponent(async()=>({items:[],total:0,page:1,page_size:50}))
 f.module.query.value='queued';assert.equal(f.timers.size,1)
 f.module.openCamera();await f.fire();assert.equal(f.events.length,0);f.stop()
})
test('paused new invoices retain retail search, active resume, QR and server-permitted refresh',async()=>{
 let committed=state(),writes=[]
 const send=(path,options)=>{
  if(path.endsWith('/capabilities'))return {...base(path),can_start:false}
  if(path.includes('/active'))return {items:[committed],total:1,page:1,page_size:20}
  if(path.includes('/products'))return {items:[offer],total:1,page:1,page_size:20}
  if(options.method==='POST')writes.push(path)
  return committed
 }
 const f=await setup(send);assert.equal(f.sale.access.value,true);assert.equal(f.sale.allowed.value,false)
 await f.sale.search('00123');assert.equal(f.sale.offers.value.items.length,1)
 await start(f.sale);assert.equal(writes.length,0)
 await f.sale.resumeActive(f.sale.active.value.items[0]);assert.equal(f.sale.checkout.value.order_id,3);assert.equal(f.sale.paymentUrl.value,'https://pay.mbnk.biz/invoice-1')
 await f.sale.refresh();assert.deepEqual(writes,['/backoffice/pos/checkouts/11111111-1111-4111-8111-111111111111/refresh'])
 f.stop()
})
test('paused and missing saved intent never creates a replacement, revoked seller issues zero mutations',async()=>{
 const storage=new Map([['sc-pos:v1:1',JSON.stringify({key:'33333333-3333-4333-8333-333333333333',body:{intent_id:state().intent_id,product_id:8,quantity:1,expected_amount_minor:35000,currency:'UAH'},offer})]])
 const send=(path)=>{if(path.endsWith('/capabilities'))return {...base(path),can_start:false};if(path.includes('/active'))return base(path);throw error(404,'missing')}
 const f=await setup(send,storage,{id:1,is_active:true,is_superuser:false,can_record_sales:true,can_accept_qr_payments:true})
 assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.match(f.sale.error.value,/призупинено/)
 f.auth.user.can_accept_qr_payments=false;await f.sale.init()
 await start(f.sale);await f.sale.recover();await f.sale.refresh();await f.sale.handover()
 assert.equal(f.sale.access.value,false);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);f.stop()
})
test('latest retail GET wins over an older response and late search cannot cross actor sessions',async()=>{
 let resolveOld,resolveNew
 const f=await setup(path=>base(path)||new Promise(resolve=>{if(!resolveOld)resolveOld=resolve;else resolveNew=resolve}))
 const old=f.sale.search('old'),latest=f.sale.search('new')
 resolveNew({items:[{...offer,name:'new'}],total:1,page:1,page_size:20});await latest
 resolveOld({items:[{...offer,name:'old'}],total:1,page:1,page_size:20});await old
 assert.equal(f.sale.offers.value.items[0].name,'new')
 resolveOld=null;const late=f.sale.search('old actor');f.auth.accessToken='token-B';await f.sale.init()
 resolveOld({items:[offer],total:1,page:1,page_size:20});await late
 assert.equal(f.sale.offers.value.items.length,0);f.stop()
})

test('a stale completed tab cannot clear a newer persisted cart checkout', async () => {
 const complete = state({status:'completed',handover:{status:'handed_over'},actions:{...state().actions,can_start_new:true}})
 const old = {key:crypto.randomUUID(),body:{...cart(),intent_id:complete.intent_id,currency:'UAH',quote_revision:quote().quote_revision},checkout_id:complete.checkout_id}
 const storage = new Map([['sc-pos:v1:1',JSON.stringify(old)]])
 const f = await setup(path=>base(path)||complete,storage)
 assert.equal(f.sale.checkout.value.status,'completed')
 const newIntent = JSON.stringify({key:crypto.randomUUID(),body:{...old.body,intent_id:crypto.randomUUID()}})
 storage.set('sc-pos:v1:1',newIntent)
 await f.sale.startNew()
 assert.equal(storage.get('sc-pos:v1:1'),newIntent)
 assert.equal(f.calls.filter(c=>c.method==='POST').length,0)
 f.stop()
})

test('invalid fiscal basket unlocks only after canonical lookup proves no checkout', async () => {
 for (const committed of [false,true]) {
  let intent
  const f = await setup((path,options)=>{
   const standard=base(path)
   if (standard) return standard
   if (path.includes('/by-intent/')) {
    if (committed) return state({intent_id:intent})
    throw error(404,'checkout_not_found')
   }
   intent=options.body.intent_id
   throw error(409,'master_mono_basket_invalid')
  })
  await start(f.sale)
  assert.equal(!!f.sale.saved.value,committed)
  assert.equal(!!f.sale.checkout.value,committed)
  assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
  f.stop()
 }
})
