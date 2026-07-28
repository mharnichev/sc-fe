import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import test from 'node:test'

const appRoot = new URL('..', import.meta.url)
const componentsRoot = new URL('../components', import.meta.url)
const pagesRoot = new URL('../pages', import.meta.url)
const baseTableSource = await readFile(new URL('../components/BaseTable.vue', import.meta.url), 'utf8')
const mainCssSource = await readFile(new URL('../assets/css/main.css', import.meta.url), 'utf8')

const vueFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return extname(entry.name) === '.vue' ? [path] : []
  }))
  return nested.flat()
}

const isBookingTableException = (path) => {
  const appPath = relative(appRoot.pathname, path)
  return appPath === 'pages/bookings.vue'
    || appPath.startsWith('components/Booking')
}

test('BaseTable exposes an accessible horizontal scroll region', () => {
  assert.match(baseTableSource, /class="w-full min-w-0 max-w-full overflow-hidden/)
  assert.match(baseTableSource, /class="base-table__scroll min-w-0 max-w-full overflow-x-auto"/)
  assert.match(baseTableSource, /role="region"/)
  assert.match(baseTableSource, /tabindex="0"/)
  assert.match(baseTableSource, /aria-labelledby/)
  assert.match(baseTableSource, /горизонтально/)
  assert.match(baseTableSource, /minWidth/)
  assert.match(mainCssSource, /\.base-table__scroll:focus-visible/)
  assert.match(mainCssSource, /overscroll-behavior-inline:\s*contain/)
  assert.match(mainCssSource, /main :is\(\.grid, \.flex\) > :has\(\.base-table\)/)
})

test('feature UI uses BaseTable for every non-booking table', async () => {
  const paths = [
    ...await vueFiles(componentsRoot.pathname),
    ...await vueFiles(pagesRoot.pathname),
  ]

  const violations = []
  for (const path of paths) {
    if (path.endsWith('/BaseTable.vue') || isBookingTableException(path)) continue
    const source = await readFile(path, 'utf8')
    if (/<table\b/i.test(source)) violations.push(relative(appRoot.pathname, path))
  }

  assert.deepEqual(violations, [])
})

test('BaseTable usages provide captions and do not switch to mobile cards', async () => {
  const paths = [
    ...await vueFiles(componentsRoot.pathname),
    ...await vueFiles(pagesRoot.pathname),
  ]
  const missingCaptions = []

  for (const path of paths) {
    if (path.endsWith('/BaseTable.vue')) continue
    const source = await readFile(path, 'utf8')
    for (const tag of source.matchAll(/<BaseTable\b[\s\S]*?>/g)) {
      if (!/\bcaption=/.test(tag[0])) missingCaptions.push(relative(appRoot.pathname, path))
    }
  }

  assert.deepEqual(missingCaptions, [])
  assert.match(mainCssSource, /table:not\(\.base-table\)/)
  assert.doesNotMatch(
    mainCssSource,
    /\.base-table(?:\s+(?:thead|tbody|tr|td|th))?\s*\{[^}]*\bdisplay\s*:\s*(?:block|grid)/,
  )
})
