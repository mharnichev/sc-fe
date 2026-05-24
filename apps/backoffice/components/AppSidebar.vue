<script setup lang="ts">
import {
  HomeIcon,
  CubeIcon,
  TagIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  UsersIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  SparklesIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps<{
  collapsed?: boolean
}>()

const emit = defineEmits<{
  'update:collapsed': [value: boolean]
}>()

const auth = useAuthStore()
const route = useRoute()
const api = useBackofficeApi()
const menuOpen = ref(false)

const { data: publicMasters } = await useAsyncData('sidebar-public-masters', () => api.getPublicMasters())
const masterList = computed(() => publicMasters.value || [])
const { isAdmin, isBarber, roleLabel } = useBackofficeAccess(masterList)

const barberShopLinks = computed(() => [
  ...(isBarber.value
    ? [
        { label: 'Бронювання', to: '/bookings', icon: CalendarDaysIcon },
        { label: 'Мої послуги', to: '/my-services', icon: SparklesIcon },
        { label: 'Мої блокування часу', to: '/my-time-blocks', icon: ClockIcon },
      ]
    : []),
  ...(isAdmin.value
    ? [
        { label: 'Дашборд', to: '/', icon: HomeIcon },
        { label: 'Майстри', to: '/masters', icon: UserGroupIcon },
        { label: 'Базові послуги', to: '/services', icon: SparklesIcon },
        { label: 'Блокування часу', to: '/time-blocks', icon: ClockIcon },
        { label: 'Клієнти', to: '/customers', icon: UsersIcon },
      ]
    : []),
])

const onlineStoreLinks = computed(() => [
  ...(isAdmin.value
    ? [
        { label: 'Товари', to: '/products', icon: CubeIcon },
        { label: 'Категорії', to: '/categories', icon: TagIcon },
        { label: 'Бренди', to: '/brands', icon: BuildingStorefrontIcon },
        { label: 'Замовлення', to: '/orders', icon: ShoppingBagIcon },
      ]
    : []),
])

const menuSections = computed(() =>
  [
    { title: 'Барбершоп', links: barberShopLinks.value },
    { title: 'Онлайн магазин', links: onlineStoreLinks.value },
  ].filter((section) => section.links.length > 0),
)

const isActive = (to: string) => route.path === to || (to !== '/' && route.path.startsWith(`${to}/`))
const isCollapsed = computed(() => Boolean(props.collapsed))

const toggleCollapsed = () => {
  emit('update:collapsed', !isCollapsed.value)
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

const logout = () => {
  if (!auth.user) return
  auth.logout()
  menuOpen.value = false
}
</script>

<template>
  <header class="sticky top-0 z-40 h-[4.5rem] min-h-[4.5rem] shrink-0 border-b border-slate-200 bg-slate-950/95 px-4 py-3 text-white shadow-sm backdrop-blur lg:hidden">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-[0.3em] text-cyan-300">Backoffice</p>
        <p v-if="auth.user" class="mt-1 truncate text-xs text-slate-300">{{ auth.user.email }}</p>
      </div>
      <button
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-white"
        :aria-expanded="menuOpen"
        aria-controls="backoffice-mobile-menu"
        @click="menuOpen = !menuOpen"
      >
        <XMarkIcon v-if="menuOpen" class="h-6 w-6" aria-hidden="true" />
        <Bars3Icon v-else class="h-6 w-6" aria-hidden="true" />
        <span class="sr-only">{{ menuOpen ? 'Закрити меню' : 'Відкрити меню' }}</span>
      </button>
    </div>

    <div
      v-if="menuOpen"
      id="backoffice-mobile-menu"
      class="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-white/10 bg-slate-950 px-4 pb-5 pt-4 shadow-2xl"
    >
      <div v-if="auth.user" class="mb-4 flex flex-wrap items-center gap-2">
        <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-cyan-100">{{ roleLabel }}</span>
      </div>
      <nav class="grid gap-4">
        <section
          v-for="section in menuSections"
          :key="section.title"
          class="border-t border-white/10 pt-4 first:border-t-0 first:pt-0"
        >
          <p class="mb-2 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {{ section.title }}
          </p>
          <div class="grid gap-2">
            <NuxtLink
              v-for="link in section.links"
              :key="link.to"
              :to="link.to"
              class="flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm transition"
              :class="isActive(link.to) ? 'bg-cyan-400/15 text-white' : 'text-slate-300 hover:bg-white/5'"
            >
              <component :is="link.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{{ link.label }}</span>
            </NuxtLink>
          </div>
        </section>
      </nav>
      <button
        v-if="auth.user"
        class="mt-4 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
        @click="logout"
      >
        <ArrowRightOnRectangleIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>Вийти</span>
      </button>
    </div>
  </header>

  <aside
    class="hidden border-r border-slate-200 bg-slate-950 py-6 text-white transition-[padding] duration-200 lg:block"
    :class="isCollapsed ? 'px-3' : 'px-5'"
  >
    <div class="mb-8">
      <div class="flex items-start gap-3" :class="isCollapsed ? 'justify-center' : 'justify-between'">
        <div v-if="!isCollapsed" class="min-w-0">
          <p class="text-xs uppercase tracking-[0.35em] text-cyan-300">Backoffice</p>
          <p v-if="auth.user" class="mt-4 truncate text-sm text-slate-400">
            {{ auth.user.email }}
          </p>
          <p v-if="auth.user" class="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-cyan-100">
            {{ roleLabel }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:border-white/30 hover:text-white"
          :aria-label="isCollapsed ? 'Розгорнути меню' : 'Згорнути меню'"
          :title="isCollapsed ? 'Розгорнути меню' : 'Згорнути меню'"
          @click="toggleCollapsed"
        >
          <ChevronRightIcon v-if="isCollapsed" class="h-5 w-5" aria-hidden="true" />
          <ChevronLeftIcon v-else class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
    <nav class="space-y-5">
      <section
        v-for="section in menuSections"
        :key="section.title"
        class="border-t border-white/10 pt-5 first:border-t-0 first:pt-0"
      >
        <p
          v-if="!isCollapsed"
          class="mb-2 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500"
        >
          {{ section.title }}
        </p>
        <div class="space-y-2">
          <NuxtLink
            v-for="link in section.links"
            :key="link.to"
            :to="link.to"
            class="flex min-h-10 items-center gap-3 rounded-xl py-2 text-sm transition"
            :class="[
              isCollapsed ? 'justify-center px-2' : 'px-3',
              isActive(link.to) ? 'bg-cyan-400/15 text-white' : 'text-slate-300 hover:bg-white/5',
            ]"
            :aria-label="isCollapsed ? link.label : undefined"
            :title="isCollapsed ? link.label : undefined"
          >
            <component :is="link.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
            <span v-if="!isCollapsed">{{ link.label }}</span>
          </NuxtLink>
        </div>
      </section>
    </nav>
    <button
      v-if="auth.user"
      class="mt-8 flex min-h-10 w-full items-center gap-3 rounded-xl border border-white/10 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
      :class="isCollapsed ? 'justify-center px-2' : 'px-3'"
      :aria-label="isCollapsed ? 'Вийти' : undefined"
      :title="isCollapsed ? 'Вийти' : undefined"
      @click="logout"
    >
      <ArrowRightOnRectangleIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
      <span v-if="!isCollapsed">Вийти</span>
    </button>
  </aside>
</template>
