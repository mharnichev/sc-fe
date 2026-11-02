export default defineNuxtPlugin(() => {
  const shopAsset = useShopAsset()
  useHead({
    link: [
      { rel: 'icon', type: 'image/x-icon', href: shopAsset('/favicon.ico'), sizes: '16x16 32x32 48x48 64x64 128x128 256x256' },
      { rel: 'icon', type: 'image/png', href: shopAsset('/favicon-96x96.png'), sizes: '96x96' },
      { rel: 'icon', type: 'image/svg+xml', href: shopAsset('/favicon.svg'), sizes: 'any' },
      { rel: 'apple-touch-icon', href: shopAsset('/apple-touch-icon.png'), sizes: '180x180' },
    ],
  })
})
