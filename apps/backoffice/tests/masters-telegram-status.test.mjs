import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pageSource = await readFile(new URL('../pages/masters/index.vue', import.meta.url), 'utf8')
const apiSource = await readFile(new URL('../composables/useBackofficeApi.ts', import.meta.url), 'utf8')

test('masters list displays Telegram connection status from the master contract', () => {
  assert.match(apiSource, /telegram_chat_id\?: string \| null/)
  assert.match(pageSource, /const isMasterTelegramConnected = \(master: Master\) => Boolean\(master\.telegram_chat_id\?\.trim\(\)\)/)
  assert.match(pageSource, /isMasterTelegramConnected\(master\) \? 'TG підключено' : 'немає TG'/)
  assert.match(pageSource, /:tone="isMasterTelegramConnected\(master\) \? 'info' : 'neutral'"/)
})
