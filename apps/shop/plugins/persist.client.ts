export default defineNuxtPlugin(() => {
  const cart = useCartStore()
  const favorites = useFavoritesStore()

  const cartSnapshot = localStorage.getItem('shop-cart')
  if (cartSnapshot) cart.$patch(JSON.parse(cartSnapshot))
  const favoritesSnapshot = localStorage.getItem('shop-favorites')
  if (favoritesSnapshot) favorites.$patch(JSON.parse(favoritesSnapshot))

  cart.$subscribe((_mutation, state) => {
    localStorage.setItem('shop-cart', JSON.stringify(state))
  })

  favorites.$subscribe((_mutation, state) => {
    localStorage.setItem('shop-favorites', JSON.stringify(state))
  })
})
