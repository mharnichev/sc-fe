// Rasterize the existing logo, with an opaque background for Apple Home Screen.
const { chromium } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')
async function main() {
  const base = path.resolve(__dirname, '..')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    const svg = fs.readFileSync(`${base}/assets/svg/logo_sc.svg`, 'utf8')
    for (const size of [180, 192, 512]) {
      await page.setViewportSize({ width: size, height: size })
      await page.setContent(`<style>body{margin:0;background:white;display:grid;place-items:center;height:100vh}svg{width:76%;height:76%}</style>${svg}`)
      await page.screenshot({ path: `${base}/public/icons/${size === 180 ? 'apple-touch-icon' : `icon-${size}`}.png` })
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
