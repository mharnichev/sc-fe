import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

// Run the exact desktop purchase suite against the responsive touch interface.
export default defineConfig({
  ...base,
  projects: [{
    name: 'mobile-purchase-chromium',
    use: { ...devices['Pixel 7'] },
    testMatch: [
      '**/smoke/purchase.spec.ts',
      '**/cart-checkout/cart-checkout.spec.ts',
      '**/cart-checkout/nova-poshta-matrix.spec.ts',
    ],
  }],
})
