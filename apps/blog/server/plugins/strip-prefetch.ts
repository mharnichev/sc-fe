export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    const stripPrefetchLinks = (chunk: string) =>
      chunk.replace(/<link\b(?=[^>]*\brel=["']prefetch["'])[^>]*>/g, '')

    html.head = html.head.map(stripPrefetchLinks)
    html.bodyAppend = html.bodyAppend.map(stripPrefetchLinks)
  })
})
