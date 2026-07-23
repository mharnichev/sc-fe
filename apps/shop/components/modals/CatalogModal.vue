<script setup lang="ts">
import type { CategoryTreeNodeDto } from '@shared-types'
import { categoryDestination } from '~/utils/category-routing'

const props = defineProps<{
  modelValue: boolean
  initialCategories?: CategoryTreeNodeDto[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const domain = useCatalogDomain()
const modal = useModalStore()
const { terms } = useShopLocale()
const { data: cachedCategories } = useNuxtData<CategoryTreeNodeDto[]>('shop-header-category-tree')
const isShow = ref(false)
const loading = ref(false)
const categories = ref<CategoryTreeNodeDto[]>(cachedCategories.value || [])
const activePath = ref<CategoryTreeNodeDto[]>([])
const direction = ref<'forward' | 'back'>('forward')

const activeCategory = computed(() => activePath.value.at(-1) || null)
const visibleCategories = computed(() => activeCategory.value?.children || categories.value)
const panelKey = computed(() => activePath.value.map(category => category.id).join('-') || 'root')
const transitionName = computed(() => `catalog-sidebar-${direction.value}`)
const levelTitle = computed(() => activeCategory.value?.name || terms.value.catalog.sidebarFallbackTitle)

watch(() => props.modelValue, (value) => {
  isShow.value = value
  if (value) {
    activePath.value = []
    direction.value = 'forward'
  }
}, { immediate: true })

watch(() => props.initialCategories, (value) => {
  if (value?.length) categories.value = value
}, { immediate: true })

watch(cachedCategories, (value) => {
  if (value?.length) categories.value = value
}, { immediate: true })

const loadCategories = async () => {
  if (categories.value.length || loading.value) return

  loading.value = true
  try {
    categories.value = await domain.getCategoryTree()
  }
  finally {
    loading.value = false
  }
}

watch(isShow, (value) => {
  if (value) void loadCategories()
})

const hideCatalogModal = () => {
  emit('update:modelValue', false)
  isShow.value = false
  modal.hideModal()
}

const goTo = async (to: string | ReturnType<typeof categoryDestination>) => {
  hideCatalogModal()
  await navigateTo(to)
}

const openCategory = async (category: CategoryTreeNodeDto) => {
  if (!category.children.length) {
    await goTo(categoryDestination(categories.value, category))
    return
  }

  direction.value = 'forward'
  activePath.value = [...activePath.value, category]
}

const goBack = () => {
  if (!activePath.value.length) return
  direction.value = 'back'
  activePath.value = activePath.value.slice(0, -1)
}

const goToActiveCategory = async () => {
  if (!activeCategory.value) return
  await goTo(categoryDestination(categories.value, activeCategory.value))
}
</script>

<template>
  <BaseModal
    v-model="isShow"
    root-class="catalog-sidebar-modal"
    :show-header="false"
    full-height
    type="bottom"
    @close="hideCatalogModal"
  >
    <section class="catalog-sidebar">
      <header class="catalog-sidebar__header">
        <p>{{ terms.catalog.sidebarTitle }}</p>
        <BaseButton
          class="catalog-sidebar__close"
          type="button"
          variant="outline-dark"
          size="sm"
          shape="circle"
          :aria-label="terms.catalog.closeCatalog"
          @click="hideCatalogModal"
        >
          <BaseIcon name="close" size="xxs" />
        </BaseButton>
      </header>

      <div v-if="loading" class="catalog-sidebar__state">
        {{ terms.catalog.loadingCategories }}
      </div>

      <div v-else-if="!categories.length" class="catalog-sidebar__state">
        {{ terms.catalog.categoriesUnavailable }}
      </div>

      <div v-else class="catalog-sidebar__viewport">
        <Transition :name="transitionName">
          <section :key="panelKey" class="catalog-sidebar__panel">
            <button
              v-if="activeCategory"
              class="catalog-sidebar__back"
              type="button"
              @click="goBack"
            >
              <BaseIcon name="chevron-left" size="xxs" />
              <span>{{ activeCategory.name }}</span>
            </button>

            <nav class="catalog-sidebar__navigation" :aria-label="levelTitle">
              <ul class="catalog-sidebar__list">
                <li v-if="!activeCategory">
                  <NuxtLink class="catalog-sidebar__item" to="/top" @click="hideCatalogModal">
                    <span>{{ terms.home.popularEyebrow }}</span>
                  </NuxtLink>
                </li>

                <li>
                  <button
                    v-if="activeCategory"
                    class="catalog-sidebar__item catalog-sidebar__item--all"
                    type="button"
                    @click="goToActiveCategory"
                  >
                    <span>{{ terms.catalog.allCategory(activeCategory.name) }}</span>
                  </button>
                  <NuxtLink
                    v-else
                    class="catalog-sidebar__item catalog-sidebar__item--all"
                    to="/catalog"
                    @click="hideCatalogModal"
                  >
                    <span>{{ terms.catalog.allCategories }}</span>
                  </NuxtLink>
                </li>

                <li v-for="category in visibleCategories" :key="category.id">
                  <button class="catalog-sidebar__item" type="button" @click="openCategory(category)">
                    <span class="catalog-sidebar__item-copy">
                      <strong>{{ category.name }}</strong>
                      <small v-if="category.description">{{ category.description }}</small>
                    </span>
                    <BaseIcon
                      v-if="category.children.length"
                      class="catalog-sidebar__chevron"
                      name="chevron-right"
                      size="xxs"
                    />
                  </button>
                </li>
              </ul>
            </nav>
          </section>
        </Transition>
      </div>
    </section>
  </BaseModal>
</template>

<style scoped>
.catalog-sidebar {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  color: #0a0a0a;
}

.catalog-sidebar__header {
  position: relative;
  z-index: 3;
  display: flex;
  min-height: 4rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
}

.catalog-sidebar__header p {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.catalog-sidebar__close {
  flex: 0 0 auto;
}

.catalog-sidebar__state {
  display: grid;
  flex: 1 1 auto;
  place-items: center;
  padding: 2rem 1.25rem;
  color: rgb(82 82 82);
  text-align: center;
}

.catalog-sidebar__viewport {
  position: relative;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.catalog-sidebar__panel {
  position: absolute;
  inset: 0;
  display: flex;
  min-height: 0;
  flex-direction: column;
  background: #ffffff;
}

.catalog-sidebar__back {
  display: flex;
  width: 100%;
  min-height: 3.2rem;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.75rem;
  border: 0;
  background: #ffffff;
  padding: 0 1.25rem;
  color: #0a0a0a;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}

.catalog-sidebar__navigation {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.5rem 0 2rem;
  -webkit-overflow-scrolling: touch;
}

.catalog-sidebar__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.catalog-sidebar__item {
  display: flex;
  width: 100%;
  min-height: 2.875rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 0;
  background: transparent;
  padding: 0.45rem 1rem;
  color: #0a0a0a;
  cursor: pointer;
  font-size: clamp(1.05rem, 4.5vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1;
  text-align: left;
  text-decoration: none;
}

.catalog-sidebar__item:hover,
.catalog-sidebar__item:focus-visible,
.catalog-sidebar__back:hover,
.catalog-sidebar__back:focus-visible {
  background: #f5f5f4;
  outline: none;
}

.catalog-sidebar__item--all {
  color: rgb(82 82 82);
}

.catalog-sidebar__item-copy {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.catalog-sidebar__item-copy strong {
  font: inherit;
}

.catalog-sidebar__item-copy small {
  overflow: hidden;
  color: rgb(82 82 82);
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catalog-sidebar__chevron {
  width: 1.5rem;
  height: 1.5rem;
}

.catalog-sidebar-forward-enter-active,
.catalog-sidebar-forward-leave-active,
.catalog-sidebar-back-enter-active,
.catalog-sidebar-back-leave-active {
  transition: transform 500ms cubic-bezier(0.3, 1, 0.3, 1);
}

.catalog-sidebar-forward-enter-from,
.catalog-sidebar-back-leave-to {
  transform: translateX(100%);
}

.catalog-sidebar-forward-leave-to,
.catalog-sidebar-back-enter-from {
  transform: translateX(-100%);
}

@media (min-width: 768px) {
  .catalog-sidebar__header,
  .catalog-sidebar__back,
  .catalog-sidebar__item {
    padding-right: 1.5rem;
    padding-left: 1.5rem;
  }

  .catalog-sidebar__item {
    min-height: 3.5rem;
    font-size: clamp(1.5rem, 3vw, 3rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .catalog-sidebar-forward-enter-active,
  .catalog-sidebar-forward-leave-active,
  .catalog-sidebar-back-enter-active,
  .catalog-sidebar-back-leave-active {
    transition: none;
  }
}
</style>
