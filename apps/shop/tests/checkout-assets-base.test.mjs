import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { sourceModule } from './runtime-localization-harness.mjs'

const { useShopAsset } = await sourceModule(await readFile(new URL('../composables/useShopAsset.ts', import.meta.url), 'utf8'))
const assets = ['/payment-brands/visa-white.png', '/payment-brands/mastercard.svg', '/checkout-status/error.webp', '/checkout-status/success.webp']

test('checkout marks and status art resolve below the deployed /shop/ app base', async () => {
  globalThis.useRuntimeConfig = () => ({ app: { baseURL: '/shop/' } })
  const shopAsset = useShopAsset()
  for (const asset of assets) assert.equal(shopAsset(asset), `/shop${asset}`)
  const purchase = await readFile(new URL('../pages/checkout/purchase.vue', import.meta.url), 'utf8')
  const illustration = await readFile(new URL('../components/checkout/PaymentStatusIllustration.vue', import.meta.url), 'utf8')
  for (const asset of assets.slice(0, 2)) assert.ok(purchase.includes(`shopAsset('${asset}')`), asset)
  assert.match(illustration, /shopAsset\(`\/checkout-status\/\$\{tone\}\.webp`\)/)
})

test('checkout assets also work at a root app base', () => {
  globalThis.useRuntimeConfig = () => ({ app: { baseURL: '/' } })
  const shopAsset = useShopAsset()
  for (const asset of assets) assert.equal(shopAsset(asset), asset)
})
