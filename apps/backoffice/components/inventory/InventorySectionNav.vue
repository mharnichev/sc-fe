<script setup lang="ts">
import {
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  ClipboardDocumentCheckIcon,
  InboxArrowDownIcon,
  ShoppingBagIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const navigationRef = ref<HTMLElement | null>(null)

const auth = useAuthStore()
const canPostInventory = computed(() => Boolean(auth.user?.is_superuser || auth.user?.can_post_inventory))
const allSections = [
  {
    label: 'Залишки',
    description: 'Фізично, резерв і доступно',
    to: '/inventory',
    icon: ArchiveBoxIcon,
  },
  {
    label: 'Потрібно замовити',
    description: 'Дефіцит за замовленнями',
    to: '/inventory/procurement',
    icon: ShoppingBagIcon,
  },
  {
    label: 'Приймання',
    description: 'Поставки та собівартість',
    to: '/inventory/receiving',
    icon: InboxArrowDownIcon,
  },
  {
    label: 'Інвентаризація',
    description: 'Фактичний перерахунок',
    to: '/inventory/counts',
    icon: ClipboardDocumentCheckIcon,
  },
  {
    label: 'Рух товарів',
    description: 'Історія за товаром',
    to: '/inventory/movements',
    icon: ArrowsRightLeftIcon,
  },
  {
    label: 'Операції',
    description: 'Прихід, повернення, списання',
    to: '/inventory/operations',
    icon: WrenchScrewdriverIcon,
  },
] as const

const sections = computed(() => allSections.filter(section => canPostInventory.value || ['/inventory', '/inventory/receiving'].includes(section.to)))

const isActive = (to: string) => route.path === to
const revealActiveSection = () => {
  const navigation = navigationRef.value
  const active = navigation?.querySelector<HTMLElement>('[aria-current="page"]')
  if (!navigation || !active) return
  const navigationBounds = navigation.getBoundingClientRect()
  const activeBounds = active.getBoundingClientRect()
  if (activeBounds.left < navigationBounds.left) {
    navigation.scrollLeft -= navigationBounds.left - activeBounds.left
  } else if (activeBounds.right > navigationBounds.right) {
    navigation.scrollLeft += activeBounds.right - navigationBounds.right
  }
}

onMounted(revealActiveSection)
watch([() => route.path, sections], () => nextTick(revealActiveSection))
</script>

<template>
  <section class="inventory-section-nav rounded-[1.5rem] border border-ui bg-ui-surface p-3 shadow-sm" aria-label="Навігація складом">
    <nav ref="navigationRef" class="overflow-x-auto" aria-label="Розділи складу">
      <div class="flex gap-2 md:grid md:grid-cols-3 2xl:grid-cols-6">
        <NuxtLink
          v-for="section in sections"
          :key="section.to"
          :to="isActive(section.to) ? route.fullPath : section.to"
          class="group flex shrink-0 min-h-14 items-center gap-3 rounded-xl border px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          :class="isActive(section.to)
            ? 'border-[var(--bo-border-strong)] bg-ui-subtle text-ui-primary shadow-sm'
            : 'border-transparent text-ui-secondary hover:border-[var(--bo-border)] hover:bg-ui-subtle hover:text-ui-primary'"
          :aria-current="isActive(section.to) ? 'page' : undefined"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition"
            :class="isActive(section.to) ? 'bg-ui-surface text-ui-accent shadow-sm' : 'bg-ui-subtle text-ui-muted group-hover:text-ui-accent'"
          >
            <component :is="section.icon" class="h-5 w-5" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold leading-tight">{{ section.label }}</span>
            <span class="mt-1 hidden text-xs leading-4 text-ui-muted xl:block">{{ section.description }}</span>
          </span>
        </NuxtLink>
      </div>
    </nav>
  </section>
</template>
