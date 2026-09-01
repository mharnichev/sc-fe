<script setup lang="ts">
import { FunnelIcon } from '@heroicons/vue/24/outline'
import type { Category } from '~/composables/useBackofficeApi'

const api = useBackofficeApi()
const toast = useBaseToastNotification()
const { apiErrorMessage } = useBookingFormatting()
const filters = reactive({
  search: '',
  is_active: '',
})

const [{ data, refresh }, { data: tree, refresh: refreshTree }] = await Promise.all([
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

const confirmHideCategory = async () => {
  if (!categoryToHide.value) return
  const category = categoryToHide.value
  if (await updateCategoryVisibility(category)) categoryToHide.value = null
}

const applyFilters = async () => {
  await refreshCategories()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-cyan-700">Каталог</p>
      <h1 class="mt-2 text-3xl font-semibold text-slate-900">Категорії</h1>
    </div>
    <section class="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_220px_160px]">
      <BaseInput v-model="filters.search" placeholder="Пошук категорій" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
      <BaseSelect native v-model="filters.is_active" aria-label="Ручна видимість категорії" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm">
        <option value="">Будь-який статус</option>
        <option value="true">Показані</option>
        <option value="false">Приховані</option>
      </BaseSelect>
      <BaseButton class="backoffice-modal-action-button backoffice-modal-action-primary" @click="applyFilters">
        <FunnelIcon class="h-4 w-4" aria-hidden="true" />
        <span>Застосувати</span>
      </BaseButton>
    </section>

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-5 py-4">
          <h2 class="text-lg font-semibold text-slate-900">Плоский список</h2>
        </div>
        <BaseTable
          caption="Плоский список категорій"
          wrapper-class="rounded-none border-0"
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
                <BaseButton
                  type="button"
                  variant="neutral"
                  size="sm"
                  :loading="isCategoryPending(item.id)"
                  :loading-label="item.is_active ? 'Приховуємо…' : 'Показуємо…'"
                  :aria-label="item.is_active ? 'Приховати категорію' : 'Показати категорію'"
                  @click="requestCategoryVisibility(item)"
                >
                  {{ item.is_active ? 'Приховати' : 'Показати' }}
                </BaseButton>
              </td>
            </tr>
        </BaseTable>
      </section>

      <section class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Дерево</h2>
        <div class="mt-4 space-y-3">
          <CategoryTreeItem
            v-for="node in tree || []"
            :key="node.id"
            :node="node"
            :pending-ids="pendingCategoryIds"
            @toggle="requestCategoryVisibility"
          />
        </div>
      </section>
    </div>
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
