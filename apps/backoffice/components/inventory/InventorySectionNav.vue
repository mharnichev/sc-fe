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
const router = useRouter()

const sections = [
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

const isActive = (to: string) => route.path === to
const activePath = computed(() => sections.find(section => isActive(section.to))?.to || '/inventory')
const activeSection = computed(() => sections.find(section => section.to === activePath.value) || sections[0])
const mobileOptions = sections.map(section => ({ value: section.to, label: section.label }))

const navigate = (value: string | number | boolean | null) => {
  if (typeof value !== 'string' || value === route.path) return
  void router.push(value)
}
</script>

<template>
  <section class="rounded-[1.5rem] border border-ui bg-ui-surface p-3 shadow-sm" aria-label="Навігація складом">
    <div class="md:hidden">
      <div class="mb-3 flex items-center gap-3 px-1">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ui-subtle text-ui-accent">
          <component :is="activeSection.icon" class="h-5 w-5" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-ui-muted">Розділ складу</p>
          <p class="mt-0.5 truncate text-sm text-ui-secondary">{{ activeSection.description }}</p>
        </div>
      </div>
      <BaseSelect
        :model-value="activePath"
        :options="mobileOptions"
        aria-label="Розділ складу"
        trigger-class="min-h-12 w-full justify-between text-base"
        @update:model-value="navigate"
      />
    </div>

    <nav class="hidden md:block" aria-label="Розділи складу">
      <div class="grid grid-cols-3 gap-2 2xl:grid-cols-6">
        <NuxtLink
          v-for="section in sections"
          :key="section.to"
          :to="isActive(section.to) ? route.fullPath : section.to"
          class="group flex min-h-20 items-center gap-3 rounded-2xl border px-3 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
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
            <span class="mt-1 block text-xs leading-4 text-ui-muted">{{ section.description }}</span>
          </span>
        </NuxtLink>
      </div>
    </nav>
  </section>
</template>
