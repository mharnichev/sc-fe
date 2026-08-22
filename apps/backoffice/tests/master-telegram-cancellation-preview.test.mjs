import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'


const messagingPageSource = await readFile(
  new URL('../pages/messaging/index.vue', import.meta.url),
  'utf8',
)


test('messaging dashboard shows the master Telegram cancellation notification preview', () => {
  assert.match(messagingPageSource, /Системні сповіщення/)
  assert.match(messagingPageSource, /Коли клієнт скасовує запис на сайті або в Telegram-боті/)
  assert.ok(messagingPageSource.includes('❗ Клієнт Іван скасував запис: Стрижка 01.01.2099 10:00'))
  assert.match(messagingPageSource, /<MessagingMessagePreview :body="masterCancellationTelegramPreview" \/>/)
})
