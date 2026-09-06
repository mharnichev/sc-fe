import assert from 'node:assert/strict'
import test from 'node:test'
import { createPreviewGate, loadSegmentServiceOptions, defaultCondition, defaultSegmentRules, describeMember, segmentApiError, summarizeCondition, summarizeRules, validateRules } from '../utils/segmentRules.mjs'

const rulesWith = condition => ({ combine: 'all', conditions: [condition], exclusions: [] })

test('starter uses strict 3 and inclusive 12 calendar months, with explicit upcoming exclusion', () => {
  const rules = defaultSegmentRules()
  assert.deepEqual(validateRules(rules), [])
  assert.equal(rules.conditions[0].min_inclusive, false)
  assert.equal(rules.conditions[0].max_inclusive, true)
  assert.deepEqual(rules.exclusions, [{ type: 'upcoming_booking', present: true }])
  assert.match(summarizeRules(rules), /> 3 та ≤ 12 календ. міс./)
  assert.match(summarizeRules(rules), /Виключити, якщо: Є майбутній запис/)
  rules.combine = 'any'
  assert.match(summarizeRules(rules), /^Будь-яка умова/)
})

test('only the eight backend rule types are accepted and incomplete values are rejected', () => {
  for (const type of ['last_visit_age','completed_visit_count','upcoming_booking','first_visit','marketing_contact']) assert.deepEqual(validateRules(rulesWith(defaultCondition(type))), [])
  for (const type of ['visited_master','received_service','received_campaign']) assert.ok(validateRules(rulesWith(defaultCondition(type))).length)
  assert.ok(validateRules(rulesWith({ type: 'ai_score', min: 10 })).length)
  assert.ok(validateRules({ combine: 'all', conditions: [], exclusions: [] }).length)
  assert.ok(validateRules({ ...defaultSegmentRules(), exclusions: Array(21).fill({type:'upcoming_booking',present:true}) }).length)
})

test('range validation handles zero, missing bounds, fractions, reversed and empty intervals, and backend limits', () => {
  assert.deepEqual(validateRules(rulesWith({ type:'completed_visit_count', min:0, max:0 })), [])
  for (const condition of [
    { type:'completed_visit_count', min:null, max:null },
    { type:'completed_visit_count', min:5, max:4 },
    { type:'completed_visit_count', min:1.5 },
    { type:'completed_visit_count', min:-1 },
    { type:'completed_visit_count', min:1000001 },
    { type:'last_visit_age', min:3, max:3, unit:'calendar_months' },
    { type:'last_visit_age', min:1201, unit:'calendar_months' },
    { type:'last_visit_age', min:36601, unit:'days' },
  ]) assert.ok(validateRules(rulesWith(condition)).length, JSON.stringify(condition))
  assert.deepEqual(validateRules(rulesWith({type:'last_visit_age',min:3,max:3,unit:'calendar_months',min_inclusive:true})), [])
  assert.match(summarizeCondition({ type:'last_visit_age',min:90,unit:'days' }), /90 дн. \(по 24 год\)/)
})

test('relative and timezone aware absolute periods round-trip backend normalized null fields', () => {
  const condition = { type:'received_service', service_ids:[1], period:{last:3,unit:'calendar_months',start:null,end:null} }
  assert.deepEqual(validateRules(rulesWith(condition)), [])
  condition.period = { start:'2026-01-01T00:00:00+02:00',end:'2026-04-01T00:00:00+03:00',last:null,unit:'days' }
  assert.deepEqual(validateRules(rulesWith(condition)), [])
  assert.match(summarizeCondition(condition), /включно.*невключно/)
  for (const period of [
    { last:0,unit:'days' }, { last:121,unit:'calendar_months' }, { last:3661,unit:'days' },
    { last:3,unit:'days',start:'2026-01-01T00:00:00Z' },
    { start:'2026-01-01T00:00:00',end:'2026-04-01T00:00:00' },
    { start:'2026-04-01T00:00:00Z',end:'2026-01-01T00:00:00Z' },
  ]) assert.ok(validateRules(rulesWith({...condition,period})).length)
})

test('masters require valid mode, period when applicable, and positive bounded IDs', () => {
  assert.deepEqual(validateRules(rulesWith({type:'visited_master',master_ids:[2],mode:'last',period:null})), [])
  assert.ok(validateRules(rulesWith({type:'visited_master',master_ids:[2],mode:'within_period'})).length)
  assert.ok(validateRules(rulesWith({type:'visited_master',master_ids:[-1],mode:'last'})).length)
  assert.ok(validateRules(rulesWith({type:'received_service',service_ids:Array(51).fill(1),period:{last:1,unit:'days'}})).length)
})

test('member explanation preserves observed zero separately from unknown and imported history', () => {
  const member = { history_state:'unknown',last_visit_at:null,completed_visit_count:0,has_upcoming_booking:false }
  assert.match(describeMember(member), /Історія невідома/)
  assert.match(describeMember(member), /0 \(повна кількість невідома\)/)
  assert.match(describeMember({...member,history_state:'known',last_visit_at:'2026-01-01T00:00:00Z'}), /0 \(повна кількість невідома\)/)
  assert.doesNotMatch(describeMember({...member,history_state:'no_visits'}), /повна кількість невідома/)
  assert.match(describeMember({...member,completed_visit_count:null}), /немає даних/)
})

test('a slower old preview cannot overwrite a newer success or error, and edits invalidate pending requests', async () => {
  const gate = createPreviewGate()
  let resolveOld
  let displayed = null
  let loading = false
  const request = async promise => {
    const token = gate.begin()
    loading = true
    try { const result = await promise; if (gate.isCurrent(token)) displayed = result }
    catch { if (gate.isCurrent(token)) displayed = 'error' }
    finally { if (gate.isCurrent(token)) loading = false }
  }
  const old = request(new Promise(resolve => { resolveOld = resolve }))
  await request(Promise.resolve({ total:0,items:[] }))
  resolveOld({total:500,items:[1]})
  await old
  assert.deepEqual(displayed,{total:0,items:[]})
  assert.equal(loading,false)
  const token = gate.begin()
  gate.invalidate()
  assert.equal(gate.isCurrent(token),false)
  await request(Promise.reject(new Error('preview failed')))
  assert.equal(displayed,'error')
})

test('API conflict and validation errors produce actionable messages', () => {
  assert.match(segmentApiError({statusCode:409}), /Оновіть сторінку/)
  assert.match(segmentApiError({data:{detail:[{loc:['body','rules','conditions',0],msg:'Invalid bounds'}]}}), /rules.conditions.0: Invalid bounds/)
  assert.match(segmentApiError({statusCode:401}), /адміністратора/)
})


test('historical services retain barber-service IDs, include inactive rows and bound request concurrency', async () => {
  const masters = Array.from({length:9}, (_,index) => ({value:index+1,label:`Майстер ${index+1}`}))
  let active = 0
  let maximum = 0
  const options = await loadSegmentServiceOptions(masters, async id => {
    active += 1
    maximum = Math.max(maximum,active)
    await new Promise(resolve => setTimeout(resolve,1))
    active -= 1
    return [{id:id+100,base_service_id:1,name:'Стрижка',is_active:id !== 2}]
  }, service => service.name)
  assert.equal(options.length,9)
  assert.equal(maximum,4)
  assert.equal(options[1].value,102)
  assert.match(options[1].label,/неактивна/)
  assert.ok(options.every(option => option.value !== 1))
})

test('service catalog errors and unexpectedly partial responses never masquerade as complete options', async () => {
  const masters = [{value:1,label:'Майстер'}]
  await assert.rejects(loadSegmentServiceOptions(masters, async () => { throw new Error('catalog unavailable') }, item => item.name), /catalog unavailable/)
  await assert.rejects(loadSegmentServiceOptions(masters, async () => ({items:[{id:2,name:'Стрижка'}],total:2}), item => item.name), /Неповний/)
})

test('all eight condition summaries explain operator, period and named references with historical fallback', () => {
  const labels = { masters:{7:'Олена'},services:{12:'Стрижка'},campaigns:{44:'Повернення клієнтів'} }
  const period = {last:14,unit:'days'}
  const cases = [
    [{type:'last_visit_age',min:3,max:12,unit:'calendar_months'}, /> 3 та ≤ 12 календ\. міс\./],
    [{type:'completed_visit_count',min:0,max:2,period}, /≥ 0 та ≤ 2 за останні 14 дн/],
    [{type:'upcoming_booking',present:false}, /Немає майбутнього запису/],
    [{type:'visited_master',master_ids:[7,999],mode:'last'}, /Олена, #999/],
    [{type:'received_service',service_ids:[12],period}, /Стрижка за останні 14/],
    [{type:'first_visit',period}, /Перший завершений візит за останні 14/],
    [{type:'received_campaign',campaign_id:44,period}, /Повернення клієнтів прийнято провайдером/],
    [{type:'marketing_contact',present:false,period}, /Немає маркетингового контакту за останні 14/],
  ]
  for (const [condition,expected] of cases) {
    assert.deepEqual(validateRules(rulesWith(condition)),[])
    assert.match(summarizeCondition(condition,labels),expected)
  }
  assert.match(summarizeRules({combine:'any',conditions:[cases[3][0],cases[4][0]],exclusions:[cases[7][0]]},labels),/Будь-яка умова:.*Олена.*Стрижка.*Виключити, якщо: Немає маркетингового контакту/)
})

test('backend-normalized optional periods and exclusion counts preserve exact allowed limits', () => {
  const base = {combine:'all',conditions:Array(20).fill({type:'completed_visit_count',min:0,max:null,period:null}),exclusions:Array(20).fill({type:'upcoming_booking',present:true})}
  assert.deepEqual(validateRules(base),[])
  assert.deepEqual(validateRules(rulesWith({type:'visited_master',master_ids:Array.from({length:50},(_,index)=>index+1),mode:'within_period',period:{last:3660,unit:'days',start:null,end:null}})),[])
  assert.deepEqual(validateRules(rulesWith({type:'first_visit',period:{last:120,unit:'calendar_months'}})),[])
  assert.match(describeMember({history_state:'unknown',completed_visit_count:null,last_visit_at:null,has_upcoming_booking:null}),/дані про майбутній запис недоступні/)
})
