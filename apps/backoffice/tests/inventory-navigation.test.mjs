import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const inventoryPages = [
  '../pages/inventory/index.vue',
  '../pages/inventory/procurement.vue',
  '../pages/inventory/receiving.vue',
  '../pages/inventory/counts.vue',
  '../pages/inventory/movements.vue',
  '../pages/inventory/operations.vue',
]

test('sidebar exposes inventory as one active parent destination', async () => {
  const sidebar = await read('../components/AppSidebar.vue')
  const inventoryLinks = sidebar.match(/to: '\/inventory[^']*'/g) || []

  assert.deepEqual(inventoryLinks, ["to: '/inventory'"])
  assert.match(sidebar, /route\.path\.startsWith\(`\$\{to\}\/`\)/)
})

test('every inventory page uses the shared section navigation', async () => {
  const pages = await Promise.all(inventoryPages.map(read))

  for (const page of pages) {
    assert.match(page, /<InventorySectionNav\s*\/>/)
  }
})

test('inventory navigation keeps six deep links and adapts without horizontal mobile tabs', async () => {
  const navigation = await read('../components/inventory/InventorySectionNav.vue')
  const destinations = navigation.match(/to: '\/inventory[^']*'/g) || []

  assert.equal(destinations.length, 6)
  assert.match(navigation, /aria-label="Розділи складу"/)
  assert.match(navigation, /aria-current=/)
  assert.match(navigation, /isActive\(section\.to\) \? route\.fullPath : section\.to/)
  assert.match(navigation, /class="md:hidden"/)
  assert.match(navigation, /aria-label="Розділ складу"/)
  assert.match(navigation, /class="hidden md:block"/)
  assert.doesNotMatch(navigation, /overflow-x-auto/)
})
