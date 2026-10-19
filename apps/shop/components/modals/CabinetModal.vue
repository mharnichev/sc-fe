<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const auth = useCustomerAuthStore()
const modal = useModalStore()
const route = useRoute()
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

const logout = async () => {
  auth.logout()
  hideCabinetModal()
  if (route.path === '/cabinet' || route.path.startsWith('/cabinet/')) await navigateTo('/')
}
</script>

<template>
  <BaseModal v-model="isShow" full-height type="bottom" content-type="primary" @close="hideCabinetModal">
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
      <NuxtLink to="/cabinet" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="user" size="xxs" />
        <span><BaseHoverUnderlineText>{{ terms.cabinet.myAccount }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/cabinet/purchase-history" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="clock" size="xxs" />
        <span><BaseHoverUnderlineText>{{ terms.cabinet.myOrders }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/cabinet/settings" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="settings" size="xxs" />
        <span><BaseHoverUnderlineText>{{ terms.cabinet.settings }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/cabinet/contact" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="message-outline" size="xxs" />
        <span><BaseHoverUnderlineText>{{ terms.cabinet.contactUs }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/cabinet/shop-rules" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="info-outline" size="xxs" />
        <span><BaseHoverUnderlineText>{{ terms.cabinet.shopRules }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/cabinet/favorites" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="heart" size="xxs" />
        <span><BaseHoverUnderlineText>{{ terms.common.favorites }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/checkout/purchase" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="shopping-cart" size="xxs" />
        <span><BaseHoverUnderlineText>{{ terms.common.checkout }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <NuxtLink to="/catalog" class="cabinet-sidebar__link" @click="hideCabinetModal">
        <BaseIcon name="catalog" size="xxs" />
        <span><BaseHoverUnderlineText>{{ terms.common.catalog }}</BaseHoverUnderlineText></span>
      </NuxtLink>
      <button class="cabinet-sidebar__link cabinet-sidebar__link--logout" type="button" @click="logout">
        <BaseIcon name="log-out-outline" size="xxs" />
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
  gap: 0.35rem;
  padding: 0.75rem;
}

.cabinet-sidebar__link {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.75rem;
  border: 0;
  background: transparent;
  padding: 0 0.6rem;
  color: #3f3f46;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  text-align: left;
  text-decoration: none;
  transition: color 180ms ease;
}

.cabinet-sidebar__link:hover,
.cabinet-sidebar__link:focus-visible {
  color: #0a0a0a;
  outline: none;
}
</style>
