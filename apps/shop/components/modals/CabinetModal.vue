<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const auth = useCustomerAuthStore()
const modal = useModalStore()
const { terms } = useShopLocale()
const isShow = ref(false)

watch(() => props.modelValue, value => {
  isShow.value = value
}, { immediate: true })

const hideCabinetModal = () => {
  emit('update:modelValue', false)
  isShow.value = false
  modal.hideModal()
}

const logout = () => {
  auth.logout()
  hideCabinetModal()
}
</script>

<template>
  <BaseModal v-model="isShow" full-height type="bottom" content-type="secondary" @close="hideCabinetModal">
    <template #header-title>
      <span class="cabinet-sidebar__head">
        <FeedbackFace class="cabinet-sidebar__face" name="content-smile" />
        <span class="cabinet-sidebar__identity">
          <span>{{ auth.displayName }}</span>
          <small>{{ auth.customer?.phone }}</small>
        </span>
      </span>
    </template>

    <div class="cabinet-sidebar">
      <NuxtLink to="/cabinet/favorites" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="heart" size="xs" effect="button" />
        <span><BaseHoverUnderlineText>{{ terms.common.favorites }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/checkout/purchase" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="shopping-cart" size="xs" effect="button" />
        <span><BaseHoverUnderlineText>{{ terms.common.checkout }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/catalog" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="catalog" size="xs" effect="button" />
        <span><BaseHoverUnderlineText>{{ terms.common.catalog }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <button class="cabinet-sidebar__link cabinet-sidebar__link--logout" type="button" @click="logout">
        <BaseIcon name="exit" size="xs" effect="button" />
        <span><BaseHoverUnderlineText>{{ terms.common.logOut }}</BaseHoverUnderlineText></span>
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.cabinet-sidebar__head {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.6rem;
}

.cabinet-sidebar__face {
  width: 2rem;
  flex: 0 0 auto;
  color: #0a0a0a;
}

.cabinet-sidebar__identity {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.cabinet-sidebar__identity span,
.cabinet-sidebar__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cabinet-sidebar__identity small {
  color: rgb(82 82 82);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: none;
}

.cabinet-sidebar {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
}

.cabinet-sidebar__link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid rgb(10 10 10 / 0.08);
  background: #ffffff;
  padding: 1rem;
  color: #0a0a0a;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 800;
}

.cabinet-sidebar__link:hover,
.cabinet-sidebar__link:focus-visible {
  border-color: #0a0a0a;
  outline: none;
}

.cabinet-sidebar__link--logout {
  margin-top: 0.5rem;
  color: rgb(190 18 60);
}
</style>
