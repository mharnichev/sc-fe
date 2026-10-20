import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const require = createRequire(import.meta.url)
export const vue = await import(pathToFileURL(createRequire(require.resolve('nuxt/package.json')).resolve('vue')).href)
const sourceModule = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`)
const { shopTerms } = await sourceModule(await readFile(new URL('../data/locale.ts', import.meta.url), 'utf8'))
Object.assign(globalThis, { shopTerms })
export const localization = await sourceModule((await readFile(new URL('../utils/shop-runtime-localization.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
export const locale = vue.ref('uk')
Object.assign(globalThis, vue, localization, { useShopLocale: () => ({ locale }) })
const { useShopRuntimeDisplay } = await sourceModule((await readFile(new URL('../composables/useShopRuntimeDisplay.ts', import.meta.url), 'utf8')).replace(/^import .*\n/gm, ''))
export const runtimeDisplay = useShopRuntimeDisplay()
export { useShopRuntimeDisplay }

export { sourceModule }
