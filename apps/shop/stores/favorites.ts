export const useFavoritesStore = defineStore('favorites', {
  state: (): { items: number[] } => ({ items: [] }),
  actions: {
    toggle(id: number) {
      this.items = this.items.includes(id) ? this.items.filter(item => item !== id) : [...this.items, id]
    },
  },
})
