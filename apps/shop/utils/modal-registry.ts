import { defineAsyncComponent } from 'vue'

export const modalRegistry = {
  CabinetModal: defineAsyncComponent(() => import('~/components/modals/CabinetModal.vue')),
  CatalogModal: defineAsyncComponent(() => import('~/components/modals/CatalogModal.vue')),
  SearchModal: defineAsyncComponent(() => import('~/components/modals/SearchModal.vue')),
  UserAuthModal: defineAsyncComponent(() => import('~/components/modals/UserAuthModal.vue')),
  UserBasketModal: defineAsyncComponent(() => import('~/components/modals/UserBasketModal.vue')),
  UserFavoriteModal: defineAsyncComponent(() => import('~/components/modals/UserFavoriteModal.vue')),
} as const

export type ModalKey = keyof typeof modalRegistry
