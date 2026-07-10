<script setup lang="ts">
import type { CategoryTreeNodeDto } from '@shared-types'

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
const isShow = ref(false)
const loading = ref(false)
const categories = ref<CategoryTreeNodeDto[]>([])
const activeCategory = ref<CategoryTreeNodeDto | null>(null)
const iconNames = ['tools', 'oil', 'battery', 'circular-saw', 'garden-tools', 'generator', 'wrench']

watch(() => props.modelValue, value => {
  isShow.value = value
}, { immediate: true })

watch(() => props.initialCategories, value => {
  if (value?.length) categories.value = value
}, { immediate: true })

watch(categories, value => {
  if (!activeCategory.value && value.length) activeCategory.value = value[0]
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

watch(isShow, value => {
  if (value) loadCategories()
})

const hideCatalogModal = () => {
  emit('update:modelValue', false)
  isShow.value = false
  modal.hideModal()
}

const goToCategory = async (slug: string) => {
  hideCatalogModal()
  await navigateTo({ path: '/catalog', query: { category: slug } })
}

const onCategoryClick = async (category: CategoryTreeNodeDto) => {
  if (!category.children.length || activeCategory.value?.slug === category.slug) {
    await goToCategory(category.slug)
    return
  }

  activeCategory.value = category
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
      <aside class="catalog-sidebar__rail">
        <button
          v-for="(category, index) in categories"
          :key="category.id"
          :class="['catalog-sidebar__category', { 'catalog-sidebar__category--active': activeCategory?.slug === category.slug }]"
          type="button"
          @click="onCategoryClick(category)"
        >
          <BaseIcon :name="iconNames[index % iconNames.length]" category="menu" size="sm" effect="button" />
          <span><BaseHoverUnderlineText>{{ category.name }}</BaseHoverUnderlineText></span>
        </button>
      </aside>

      <main class="catalog-sidebar__main">
        <div class="catalog-sidebar__header">
          <div>
            <p>{{ terms.catalog.sidebarTitle }}</p>
            <h2>{{ activeCategory?.name || terms.catalog.sidebarFallbackTitle }}</h2>
          </div>
          <BaseButton
            class="catalog-sidebar__close"
            type="button"
            variant="outline-dark"
            size="sm"
            shape="circle"
            :aria-label="terms.common.closeDialog"
            @click="hideCatalogModal"
          >
            <BaseIcon name="close" size="xxs" />
          </BaseButton>
        </div>

        <div v-if="loading" class="catalog-sidebar__state">{{ terms.catalog.loadingCategories }}</div>

        <div v-else-if="activeCategory" class="catalog-sidebar__content">
          <button class="catalog-sidebar__all" type="button" @click="goToCategory(activeCategory.slug)">
            <span><BaseHoverUnderlineText>{{ terms.catalog.allCategory(activeCategory.name) }}</BaseHoverUnderlineText></span>
            <BaseIcon name="chevron-right" size="xxs" />
          </button>

          <div class="catalog-sidebar__children">
            <article v-for="child in activeCategory.children" :key="child.id" class="catalog-sidebar__child">
              <button type="button" class="catalog-sidebar__child-title" @click="goToCategory(child.slug)">
                <span><BaseHoverUnderlineText>{{ child.name }}</BaseHoverUnderlineText></span>
                <BaseIcon name="chevron-right" size="xxs" />
              </button>
              <div v-if="child.children.length" class="catalog-sidebar__grandchildren">
                <button
                  v-for="grandchild in child.children"
                  :key="grandchild.id"
                  type="button"
                  @click="goToCategory(grandchild.slug)"
                >
                  <BaseHoverUnderlineText>{{ grandchild.name }}</BaseHoverUnderlineText>
                </button>
              </div>
            </article>
          </div>
        </div>

        <div v-else class="catalog-sidebar__state">
          {{ terms.catalog.categoriesUnavailable }}
        </div>
      </main>
    </section>
  </BaseModal>
</template>

<style>
.catalog-sidebar-modal .base-modal__container {
  width: min(92vw, 44rem);
}
</style>

<style scoped>
.catalog-sidebar {
  display: grid;
  grid-template-columns: minmax(5.5rem, 7rem) minmax(0, 1fr);
  height: 100%;
  background: #ffffff;
}

.catalog-sidebar__rail {
  display: grid;
  align-content: start;
  gap: 0.35rem;
  overflow: auto;
  border-right: 1px solid rgb(10 10 10 / 0.1);
  background: #f5f5f4;
  padding: 0.35rem;
}

.catalog-sidebar__category {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  border: 0;
  background: transparent;
  padding: 0.8rem 0.35rem;
  color: #0a0a0a;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.15;
  text-align: center;
}

.catalog-sidebar__category:hover,
.catalog-sidebar__category:focus-visible {
  color: #0a0a0a;
  outline: none;
}

.catalog-sidebar__category--active {
  background: #0a0a0a;
  color: #ffffff;
}

.catalog-sidebar__main {
  min-width: 0;
  overflow: auto;
}

.catalog-sidebar__header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  padding: 1rem;
}

.catalog-sidebar__header p {
  color: rgb(82 82 82);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.catalog-sidebar__header h2 {
  margin-top: 0.15rem;
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.2;
}

.catalog-sidebar__close {
  flex: 0 0 auto;
}

.catalog-sidebar__state {
  padding: 1rem;
  color: rgb(82 82 82);
  font-size: 0.9rem;
}

.catalog-sidebar__content {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
}

.catalog-sidebar__all,
.catalog-sidebar__child-title {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgb(10 10 10 / 0.1);
  background: #ffffff;
  padding: 0.85rem;
  color: #0a0a0a;
  cursor: pointer;
  font-weight: 800;
  text-align: left;
}

.catalog-sidebar__all:hover,
.catalog-sidebar__all:focus-visible,
.catalog-sidebar__child-title:hover,
.catalog-sidebar__child-title:focus-visible {
  border-color: #0a0a0a;
  outline: none;
}

.catalog-sidebar__children {
  display: grid;
  gap: 0.85rem;
}

.catalog-sidebar__child {
  display: grid;
  gap: 0.5rem;
}

.catalog-sidebar__grandchildren {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.catalog-sidebar__grandchildren button {
  min-height: 3rem;
  border: 1px solid rgb(10 10 10 / 0.08);
  background: #f5f5f4;
  padding: 0.55rem;
  color: #0a0a0a;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
  text-align: left;
}

.catalog-sidebar__grandchildren button:hover,
.catalog-sidebar__grandchildren button:focus-visible {
  border-color: #0a0a0a;
  outline: none;
}

@media (max-width: 520px) {
  .catalog-sidebar {
    grid-template-columns: 5.25rem minmax(0, 1fr);
  }

  .catalog-sidebar__grandchildren {
    grid-template-columns: 1fr;
  }
}
</style>
