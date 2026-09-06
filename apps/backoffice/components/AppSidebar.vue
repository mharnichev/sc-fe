<script setup lang="ts">
import {
  HomeIcon,
  CubeIcon,
  TagIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  TicketIcon,
  UsersIcon,
  CalendarDaysIcon,
  ClockIcon,
  BookOpenIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  StarIcon,
  ChartBarSquareIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MoonIcon,
  SunIcon,
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
const { isLightTheme, themeLabel, themeToggleLabel, toggleTheme } = useBackofficeTheme()
const menuOpen = ref(false)
const bottomNavHidden = ref(false)
const lastScrollY = ref(0)
let restorePageScroll: (() => void) | undefined
let desktopMedia: MediaQueryList | undefined

watch(menuOpen, (isOpen) => {
  if (!import.meta.client) return
  if (!isOpen) {
    restorePageScroll?.()
    restorePageScroll = undefined
    return
  }

  const { body, documentElement } = document
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const previous = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    width: body.style.width,
  }
  const documentOverflow = documentElement.style.overflow
  documentElement.style.overflow = 'hidden'
  Object.assign(body.style, {
    overflow: 'hidden', position: 'fixed', top: `-${scrollY}px`, left: `-${scrollX}px`, width: '100%',
  })
  restorePageScroll = () => {
    Object.assign(body.style, previous)
    documentElement.style.overflow = documentOverflow
    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
    lastScrollY.value = scrollY
  }
}, { flush: 'sync' })

const closeDesktopMenu = () => {
  if (desktopMedia?.matches) menuOpen.value = false
}
const handleMenuKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') menuOpen.value = false
}

const { data: publicMasters } = await useAsyncData('sidebar-public-masters', () => api.getPublicMasters())
const masterList = computed(() => publicMasters.value || [])
const { isAdmin, isBarber, roleLabel } = useBackofficeAccess(masterList)

const barberShopLinks = computed(() => [
  ...(isBarber.value
    ? [
        { label: 'Дашборд', to: '/dashboard', icon: HomeIcon },
        { label: 'Статистика', to: '/statistics', icon: ChartBarSquareIcon },
        { label: 'Бронювання', to: '/bookings', icon: CalendarDaysIcon },
        { label: 'Мої послуги', to: '/my-services', icon: SparklesIcon },
        { label: 'Моя доступність', to: '/my-time-blocks', icon: ClockIcon },
      ]
    : []),
  ...(isAdmin.value
    ? [
        { label: 'Дашборд барбершопу', to: '/admin/dashboards/barbershop', icon: HomeIcon },
        { label: 'Статистика', to: '/admin/statistics', icon: ChartBarSquareIcon },
        { label: 'Бронювання', to: '/bookings', icon: CalendarDaysIcon },
        { label: 'Майстри', to: '/masters', icon: UserGroupIcon },
        { label: 'Базові послуги', to: '/services', icon: SparklesIcon },
        { label: 'Доступність', to: '/time-blocks', icon: ClockIcon },
        { label: 'Акції', to: '/promotions', icon: TicketIcon },
        { label: 'Клієнти', to: '/customers', icon: UsersIcon },
        { label: 'Сегменти', to: '/customers/segments', icon: UserGroupIcon },
        { label: 'Відгуки', to: '/reviews', icon: StarIcon },
        { label: 'Кампанії', to: '/messaging/campaigns', icon: ChatBubbleLeftRightIcon },
        { label: 'Сповіщення', to: '/messaging/notifications', icon: ChatBubbleLeftRightIcon },
      ]
    : []),
])

const onlineStoreLinks = computed(() => [
  ...(isAdmin.value
    ? [
        { label: 'Дашборд магазину', to: '/admin/dashboards/store', icon: HomeIcon },
        { label: 'Товари', to: '/products', icon: CubeIcon },
        { label: 'Категорії', to: '/categories', icon: TagIcon },
        { label: 'Бренди', to: '/brands', icon: BuildingStorefrontIcon },
        { label: 'Замовлення', to: '/orders', icon: ShoppingBagIcon },
      ]
    : []),
])

const blogLinks = computed(() => [
  ...(isAdmin.value
    ? [
        { label: 'Статистика', to: '/blog/statistics', icon: BookOpenIcon },
      ]
    : []),
])

const barberBottomLinks = computed(() =>
  isBarber.value
    ? [
        { label: 'Дашборд', to: '/dashboard', icon: HomeIcon },
        { label: 'Бронювання', to: '/bookings', icon: CalendarDaysIcon },
        { label: 'Статистика', to: '/statistics', icon: ChartBarSquareIcon },
        { label: 'Мої послуги', to: '/my-services', icon: SparklesIcon },
      ]
    : [],
)

const menuSections = computed(() => {
  const allBarbershopLinks = barberShopLinks.value
  const findLinks = (labels: string[]) => allBarbershopLinks.filter(link => labels.includes(link.label))
  const managementLinks = findLinks(['Майстри', 'Базові послуги', 'Мої послуги', 'Доступність', 'Моя доступність', 'Акції', 'Відгуки'])
  const customerLabels = ['Клієнти', 'Сегменти']
  const systemLabels = ['Кампанії', 'Сповіщення']
  const generalLinks = allBarbershopLinks.filter(link => !managementLinks.includes(link) && !systemLabels.includes(link.label) && !customerLabels.includes(link.label))

  return [
    { title: 'General', links: generalLinks },
    { title: 'Management', links: managementLinks },
    { title: 'Клієнти', links: findLinks(customerLabels) },
    { title: 'Business', links: [...onlineStoreLinks.value, ...blogLinks.value] },
    { title: 'Комунікації', links: allBarbershopLinks.filter(link => systemLabels.includes(link.label)) },
  ].filter(section => section.links.length > 0)
})

const isActive = (to: string) => route.path === to || (to === '/customers' ? /^\/customers\/\d+(?:\/|$)/.test(route.path) : to !== '/' && route.path.startsWith(`${to}/`))
const isCollapsed = computed(() => Boolean(props.collapsed))

const toggleCollapsed = () => {
  emit('update:collapsed', !isCollapsed.value)
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    bottomNavHidden.value = false
  },
)

const handleScroll = () => {
  if (menuOpen.value) return
  const currentScrollY = window.scrollY
  const delta = currentScrollY - lastScrollY.value

  if (Math.abs(delta) < 8) return

  bottomNavHidden.value = delta > 0 && currentScrollY > 80
  lastScrollY.value = currentScrollY
}

onMounted(() => {
  lastScrollY.value = window.scrollY
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('keydown', handleMenuKeydown)
  desktopMedia = window.matchMedia('(min-width: 1280px)')
  desktopMedia.addEventListener('change', closeDesktopMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('keydown', handleMenuKeydown)
  desktopMedia?.removeEventListener('change', closeDesktopMenu)
  restorePageScroll?.()
})

const logout = () => {
  if (!auth.user) return
  auth.logout()
  menuOpen.value = false
}
</script>

<template>
  <div class="sticky top-0 z-[220] h-[4.5rem] min-h-[4.5rem] xl:hidden">
    <header
      class="backoffice-shell-surface top-0 z-[220] h-[4.5rem] min-h-[4.5rem] shrink-0 border-b border-white/10 bg-black/70 px-4 py-3 text-white shadow-sm backdrop-blur-2xl xl:hidden"
      :class="menuOpen ? 'fixed inset-x-0' : 'relative'"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.3em] text-white/55">Soul Cuts</p>
          <p v-if="auth.user" class="mt-1 truncate text-xs text-white/45">{{ auth.user.email }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <BaseButton
            type="button"
            class="theme-toggle-button inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
            :aria-label="themeToggleLabel"
            :title="themeToggleLabel"
            @click="toggleTheme"
          >
            <MoonIcon v-if="isLightTheme" class="h-5 w-5" aria-hidden="true" />
            <SunIcon v-else class="h-5 w-5" aria-hidden="true" />
          </BaseButton>
          <BaseButton
            type="button"
            class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
            :aria-expanded="menuOpen"
            aria-controls="backoffice-mobile-menu"
            @click="menuOpen = !menuOpen"
          >
            <XMarkIcon v-if="menuOpen" class="h-6 w-6" aria-hidden="true" />
            <Bars3Icon v-else class="h-6 w-6" aria-hidden="true" />
            <span class="sr-only">{{ menuOpen ? 'Закрити меню' : 'Відкрити меню' }}</span>
          </BaseButton>
        </div>
      </div>

      <div
        v-if="menuOpen"
        id="backoffice-mobile-menu"
        class="backoffice-menu-surface absolute inset-x-0 top-[4.5rem] z-50 h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain border-t border-white/10 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
      >
        <div v-if="auth.user" class="mb-4 flex flex-wrap items-center gap-2">
          <span class="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/75">{{ roleLabel }}</span>
        </div>
        <nav class="grid gap-4">
          <section
            v-for="section in menuSections"
            :key="section.title"
            class="border-t border-white/10 pt-4 first:border-t-0 first:pt-0"
          >
            <p class="type-eyebrow mb-2 px-3 text-[0.7rem] text-white/35">
              {{ section.title }}
            </p>
            <div class="grid gap-2">
              <NuxtLink
                v-for="link in section.links"
                :key="link.to"
                :to="link.to"
                class="flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm transition"
                :class="isActive(link.to) ? 'bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]' : 'text-white/58 hover:bg-white/7 hover:text-white'"
              >
                <component :is="link.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{{ link.label }}</span>
              </NuxtLink>
            </div>
          </section>
        </nav>
        <BaseButton
          v-if="auth.user"
          class="mt-4 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          @click="logout"
        >
          <ArrowRightOnRectangleIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Вийти</span>
        </BaseButton>
      </div>
    </header>
  </div>

  <aside
    class="backoffice-shell-surface hidden border-r border-white/10 bg-black/35 py-5 text-white backdrop-blur-2xl transition-[padding] duration-200 xl:block"
    :class="isCollapsed ? 'px-3' : 'px-5'"
  >
    <div class="mb-7">
      <div class="liquid-glass flex items-start gap-3 rounded-[1.5rem] p-3" :class="isCollapsed ? 'justify-center' : 'justify-between'">
        <div v-if="!isCollapsed" class="min-w-0">
          <p class="text-xs uppercase tracking-[0.35em] text-white/45">Soul Cuts</p>
          <p class="mt-2 text-lg font-semibold leading-tight text-white">Backoffice</p>
          <p v-if="auth.user" class="mt-4 truncate text-sm text-white/45">
            {{ auth.user.email }}
          </p>
          <p v-if="auth.user" class="mt-2 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
            {{ roleLabel }}
          </p>
        </div>
        <BaseButton
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/55 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          :aria-label="isCollapsed ? 'Розгорнути меню' : 'Згорнути меню'"
          :title="isCollapsed ? 'Розгорнути меню' : 'Згорнути меню'"
          @click="toggleCollapsed"
        >
          <ChevronRightIcon v-if="isCollapsed" class="h-5 w-5" aria-hidden="true" />
          <ChevronLeftIcon v-else class="h-5 w-5" aria-hidden="true" />
        </BaseButton>
      </div>
    </div>
    <nav class="space-y-6">
      <section
        v-for="section in menuSections"
        :key="section.title"
        class="border-t border-white/10 pt-5 first:border-t-0 first:pt-0"
      >
        <p
          v-if="!isCollapsed"
          class="type-eyebrow mb-2 px-3 text-[0.68rem] text-white/34"
        >
          {{ section.title }}
        </p>
        <div class="space-y-2">
          <NuxtLink
            v-for="link in section.links"
            :key="link.to"
            :to="link.to"
            class="flex min-h-10 items-center gap-3 rounded-2xl py-2 text-sm transition"
            :class="[
              isCollapsed ? 'justify-center px-2' : 'px-3',
              isActive(link.to) ? 'bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.22)]' : 'text-white/55 hover:bg-white/7 hover:text-white',
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
    <BaseButton
      v-if="auth.user"
      class="mt-8 flex min-h-10 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-2 text-sm text-white/55 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
      :class="isCollapsed ? 'justify-center px-2' : 'px-3'"
      :aria-label="isCollapsed ? 'Вийти' : undefined"
      :title="isCollapsed ? 'Вийти' : undefined"
      @click="logout"
    >
      <ArrowRightOnRectangleIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
      <span v-if="!isCollapsed">Вийти</span>
    </BaseButton>
    <BaseButton
      type="button"
      class="theme-toggle-button mt-3 flex min-h-10 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-2 text-sm text-white/55 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
      :class="isCollapsed ? 'justify-center px-2' : 'px-3'"
      :aria-label="isCollapsed ? themeToggleLabel : undefined"
      :title="isCollapsed ? themeToggleLabel : undefined"
      @click="toggleTheme"
    >
      <MoonIcon v-if="isLightTheme" class="h-5 w-5 shrink-0" aria-hidden="true" />
      <SunIcon v-else class="h-5 w-5 shrink-0" aria-hidden="true" />
      <span v-if="!isCollapsed">{{ themeLabel }}</span>
    </BaseButton>
  </aside>

  <nav
    v-if="barberBottomLinks.length"
    class="backoffice-shell-surface backoffice-bottom-nav fixed bottom-0 left-2 right-2 z-50 rounded-t-2xl border border-b-0 border-white/10 bg-black/70 px-1.5 pt-1.5 shadow-[0_-18px_44px_rgb(0_0_0_/_0.35)] backdrop-blur-2xl transition-transform duration-300 ease-out xl:hidden"
    :class="bottomNavHidden ? 'translate-y-[calc(100%+env(safe-area-inset-bottom)+0.5rem)]' : 'translate-y-0'"
    style="padding-bottom: calc(0.375rem + env(safe-area-inset-bottom));"
    aria-label="Швидка навігація майстра"
  >
    <div class="mx-auto grid max-w-3xl grid-cols-4 gap-1">
      <NuxtLink
        v-for="link in barberBottomLinks"
        :key="link.to"
        :to="link.to"
        class="backoffice-bottom-nav-link flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center text-[0.62rem] font-medium leading-tight transition"
        :class="isActive(link.to) ? 'is-active' : ''"
      >
        <component :is="link.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
        <span class="max-w-full truncate">{{ link.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
