import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'


const messagingPageSource = await readFile(
  new URL('../pages/messaging/index.vue', import.meta.url),
  'utf8',
)


test('messaging dashboard does not duplicate master messages in a Telegram-only card', () => {
  assert.doesNotMatch(messagingPageSource, /Telegram · майстер/)
  assert.doesNotMatch(messagingPageSource, /masterCancellationTelegramPreview/)
  assert.doesNotMatch(messagingPageSource, /Системні сповіщення/)
})
