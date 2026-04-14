<script setup lang="ts">
import {
  HomeIcon,
  CubeIcon,
  TagIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/vue/24/outline'

const auth = useAuthStore()
const route = useRoute()

const links = [
  { label: 'Dashboard', to: '/', icon: HomeIcon },
  { label: 'Products', to: '/products', icon: CubeIcon },
  { label: 'Categories', to: '/categories', icon: TagIcon },
  { label: 'Brands', to: '/brands', icon: BuildingStorefrontIcon },
  { label: 'Orders', to: '/orders', icon: ShoppingBagIcon },
]

const logout = () => {
  if (!auth.user) return
  auth.logout()
}
</script>

<template>
  <aside class="hidden border-r border-slate-200 bg-slate-950 px-5 py-6 text-white lg:block">
    <div class="mb-8">
      <p class="text-xs uppercase tracking-[0.35em] text-cyan-300">Backoffice</p>
      <p v-if="auth.user" class="mt-4 text-sm text-slate-400">
        {{ auth.user.email }}
      </p>
    </div>
    <nav class="space-y-2">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition"
        :class="route.path === link.to ? 'bg-cyan-400/15 text-white' : 'text-slate-300 hover:bg-white/5'"
      >
        <component :is="link.icon" class="h-5 w-5" aria-hidden="true" />
        <span>{{ link.label }}</span>
      </NuxtLink>
    </nav>
    <button
      v-if="auth.user"
      class="mt-8 flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
      @click="logout"
    >
      <ArrowRightOnRectangleIcon class="h-5 w-5" aria-hidden="true" />
      <span>Logout</span>
    </button>
  </aside>
</template>
