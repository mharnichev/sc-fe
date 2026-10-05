import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../utils/campaignOffer.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { CAMPAIGN_OFFER_SESSION_KEY, campaignOfferApplies, readCampaignOffer, saveCampaignOffer, clearCampaignOffer } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const token = 'a'.repeat(43)
const anotherToken = 'b'.repeat(43)

const storage = () => {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
}

test('campaign offer event id survives reload and changes for a new token', () => {
  const session = storage()
  const first = saveCampaignOffer(session, token)
  assert.equal(first.token, token)
  assert.match(first.eventId, /^[A-Za-z0-9._:-]{16,128}$/)
  assert.deepEqual(readCampaignOffer(session), first)
  assert.deepEqual(saveCampaignOffer(session, token), first)
  assert.notEqual(saveCampaignOffer(session, anotherToken).eventId, first.eventId)
  clearCampaignOffer(session)
  assert.equal(session.getItem(CAMPAIGN_OFFER_SESSION_KEY), null)
})

test('malformed saved capability is ignored and only the intended master and services retain the offer', () => {
  const session = storage()
  session.setItem(CAMPAIGN_OFFER_SESSION_KEY, JSON.stringify({ token: 'bad', eventId: 'fake' }))
  assert.equal(readCampaignOffer(session), null)
  const context = { master_id: 4, service_ids: [18, 19] }
  assert.equal(campaignOfferApplies(context, 4, [18]), true)
  assert.equal(campaignOfferApplies(context, 4, [18, 19]), true)
  assert.equal(campaignOfferApplies(context, 4, [18, 20]), false)
  assert.equal(campaignOfferApplies(context, 5, [18]), false)
  assert.equal(campaignOfferApplies(context, 4, []), false)
})
