<script setup lang="ts">
import { Bars3BottomLeftIcon, QueueListIcon } from '@heroicons/vue/24/outline'
import type { BaseTabValue } from '~/components/BaseTabs.vue'
import type { Category } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage } = useBookingFormatting()
const filters = reactive({
  search: '',
  is_active: '',
})
const activeFilterCount = computed(() => [filters.search.trim(), filters.is_active].filter(Boolean).length)
const categoryStatusOptions = [
  { value: '', label: 'Будь-який статус' },
  { value: 'true', label: 'Показані' },
  { value: 'false', label: 'Приховані' },
]
const activeView = ref<BaseTabValue>('flat')
const categoryViewTabs = [
  {
    value: 'flat',
    label: 'Плоский список',
    description: 'Таблиця всіх категорій',
    icon: Bars3BottomLeftIcon,
  },
  {
    value: 'tree',
    label: 'Дерево',
    description: 'Ієрархія та вкладеність',
    icon: QueueListIcon,
  },
]

const [{ data, pending, refresh }, { data: tree, refresh: refreshTree }] = await Promise.all([
  useAsyncData('backoffice-categories', () =>
    api.getCategories(1, 200, {
      search: filters.search || undefined,
      is_active: filters.is_active === '' ? null : filters.is_active === 'true',
    })),
  useAsyncData('backoffice-category-tree', () => api.getCategoryTree()),
])

const pendingCategoryIds = ref<Set<number>>(new Set())
const categoryToHide = ref<Category | null>(null)
const isHideConfirmOpen = computed({
  get: () => Boolean(categoryToHide.value),
  set: value => { if (!value) categoryToHide.value = null },
})

const categoryVisibilityLabel = (category: Category) => {
  if (category.is_effectively_visible) return 'Показана'
  if (category.hidden_reason === 'parent_category') return 'Прихована батьківською категорією'
  return 'Прихована вручну'
}

const categoryVisibilityTone = (category: Category) => category.is_effectively_visible ? 'success' : 'neutral'
const isCategoryPending = (categoryId: number) => pendingCategoryIds.value.has(categoryId)
const setCategoryPending = (categoryId: number, pending: boolean) => {
  const next = new Set(pendingCategoryIds.value)
  if (pending) next.add(categoryId)
  else next.delete(categoryId)
  pendingCategoryIds.value = next
}

const refreshCategories = async () => {
  await Promise.all([refresh(), refreshTree()])
}

const updateCategoryVisibility = async (category: Category) => {
  if (isCategoryPending(category.id)) return false
  setCategoryPending(category.id, true)
  try {
    await api.updateCategory(category.id, { is_active: !category.is_active })
    await refreshCategories()
    toast.success(category.is_active ? 'Категорію та її гілку приховано.' : 'Категорію показано.')
    return true
  }
  catch (cause) {
    toast.error(apiErrorMessage(cause, 'Не вдалося оновити видимість категорії.'))
    return false
  }
  finally {
    setCategoryPending(category.id, false)
  }
}

const requestCategoryVisibility = (category: Category) => {
  if (category.is_active) {
    categoryToHide.value = category
    return
  }
  void updateCategoryVisibility(category)
}

const handleCategoryVisibilityChange = (category: Category, event: Event) => {
  // Keep the server-confirmed state visible while the confirmation or request is pending.
  (event.target as HTMLInputElement).checked = category.is_active
  requestCategoryVisibility(category)
}

const confirmHideCategory = async () => {
  if (!categoryToHide.value) return
  const category = categoryToHide.value
  if (await updateCategoryVisibility(category)) categoryToHide.value = null
}

const applyFilters = async () => {
  await refresh()
}

const clearFilters = async () => {
  filters.search = ''
  filters.is_active = ''
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Каталог</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Категорії</h1>
    </div>
    <BaseTabs v-model="activeView" :tabs="categoryViewTabs" aria-label="Вигляд категорій">
      <template #default="{ activeTab, panelId, tabId }">
        <div
          v-if="activeTab === 'flat'"
          :id="panelId"
          role="tabpanel"
          :aria-labelledby="tabId"
          class="mt-5 space-y-5"
        >
          <BaseFilterPanel
            :loading="pending"
            :active-count="activeFilterCount"
            mobile-title="Фільтри категорій"
            fields-class="md:grid-cols-[minmax(0,1fr)_220px]"
            @apply="applyFilters"
            @clear="clearFilters"
          >
            <BaseInput v-model="filters.search" placeholder="Пошук категорій" aria-label="Пошук категорій" />
            <BaseSelect
              v-model="filters.is_active"
              :options="categoryStatusOptions"
              aria-label="Ручна видимість категорії"
            />
          </BaseFilterPanel>

          <BaseTable
            sticky-actions
            caption="Таблиця категорій"
            min-width="48rem"
            :empty="!data?.items.length"
            empty-title="Категорій не знайдено"
          >
            <template #head>
              <tr>
                <th>Назва</th>
                <th>Slug</th>
                <th>Батьківська категорія</th>
                <th>Статус</th>
                <th>Видимість</th>
                <th>Дія</th>
              </tr>
            </template>
            <tr v-for="item in data?.items || []" :key="item.id" :class="{ 'opacity-65': !item.is_effectively_visible }">
              <td>
                <p class="font-medium text-ui-primary">{{ item.name }}</p>
                <p class="text-xs text-ui-muted">{{ item.description || 'Без опису' }}</p>
              </td>
              <td class="text-ui-secondary">{{ item.slug }}</td>
              <td class="text-ui-secondary">{{ item.parent_id || '—' }}</td>
              <td>
                <BaseBadge :tone="item.is_active ? 'success' : 'neutral'">
                  {{ item.is_active ? 'активний' : 'неактивний' }}
                </BaseBadge>
              </td>
              <td>
                <BaseBadge :tone="categoryVisibilityTone(item)">
                  {{ categoryVisibilityLabel(item) }}
                </BaseBadge>
              </td>
              <td>
                <BaseToggle
                  :checked="item.is_active"
                  :loading="isCategoryPending(item.id)"
                  :aria-label="`${item.is_active ? 'Приховати' : 'Показати'} категорію ${item.name}`"
                  @change="handleCategoryVisibilityChange(item, $event)"
                />
              </td>
            </tr>
          </BaseTable>
        </div>

        <BaseCard
          v-else
          :id="panelId"
          as="section"
          role="tabpanel"
          :aria-labelledby="tabId"
          class="mt-5 space-y-4"
        >
          <div>
            <h2 class="text-lg font-semibold text-ui-primary">Дерево категорій</h2>
            <p class="mt-1 text-sm text-ui-secondary">Лінії показують зв’язок із батьківською категорією, а номер рівня — глибину вкладеності.</p>
          </div>
          <BaseCard variant="subtle" padding="sm" class="text-sm text-ui-secondary">
            Перемикач батьківської категорії впливає на видимість усієї її гілки, але зберігає власні налаштування дочірніх категорій.
          </BaseCard>
          <div class="space-y-3">
            <CategoryTreeItem
              v-for="node in tree || []"
              :key="node.id"
              :node="node"
              :pending-ids="pendingCategoryIds"
              @toggle="requestCategoryVisibility"
            />
          </div>
        </BaseCard>
      </template>
    </BaseTabs>
  </div>
  <ConfirmActionModal
    v-model="isHideConfirmOpen"
    title="Приховати категорію?"
    message="Категорія і вся її гілка будуть приховані з shop. Індивідуальні налаштування товарів і підкатегорій збережуться"
    confirm-label="Приховати категорію"
    :pending="categoryToHide ? isCategoryPending(categoryToHide.id) : false"
    destructive
    @confirm="confirmHideCategory"
  />
</template>
