import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const [nuxtConfig, analyticsPlugin] = await Promise.all([
  read('../nuxt.config.ts'),
  read('../plugins/google-analytics.client.ts'),
])

test('Google Tag Manager loads only through the consent-aware analytics flow', () => {
  assert.doesNotMatch(nuxtConfig, /googleTagManagerScript|googleTagManagerNoScript|google-tag-manager-noscript/)
  assert.match(nuxtConfig, /frame-src https:\/\/www\.googletagmanager\.com/)
  assert.match(analyticsPlugin, /const GTM_CONTAINER_ID = 'GTM-5NK5VGXR'/)
  assert.match(analyticsPlugin, /const loadGoogleTagManager = \(\) =>/)
  assert.match(analyticsPlugin, /'gtm\.start': Date\.now\(\),\s*event: 'gtm\.js'/)
  assert.match(
    analyticsPlugin,
    /const initializeGtag = \(\) => \{[\s\S]*?loadGoogleTagManager\(\)[\s\S]*?loadGtagScript\(\)/,
  )
  assert.match(
    analyticsPlugin,
    /if \(!canUseAnalytics\.value \|\| hasPrivateCustomerActivityContext\(\)\)[\s\S]*?initializeGtag\(\)/,
  )
})
