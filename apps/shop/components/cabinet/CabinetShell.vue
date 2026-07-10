<script setup lang="ts">
const auth = useCustomerAuthStore()
const { terms } = useShopLocale()

const initials = computed(() => {
  const source = [auth.customer?.name, auth.customer?.surname].filter(Boolean).join(' ') || auth.displayName
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
})

const navItems = computed(() => [
  { icon: 'clock', label: terms.value.cabinet.purchaseHistory, to: '/cabinet/purchase-history' },
  { icon: 'heart', label: terms.value.common.favorites, to: '/cabinet/favorites' },
  { icon: 'settings', label: terms.value.cabinet.settings, to: '/cabinet/settings' },
])

const logout = async () => {
  auth.logout()
  await navigateTo('/')
}
</script>

<template>
  <section class="cabinet-shell">
    <aside class="cabinet-shell__sidebar">
      <div class="cabinet-shell__head">
        <span class="cabinet-shell__avatar">
          <span v-if="initials">{{ initials }}</span>
          <BaseIcon v-else name="user" size="xs" />
        </span>
        <div class="cabinet-shell__user">
          <h1>{{ auth.displayName }}</h1>
          <p v-if="auth.customer?.email">{{ auth.customer.email }}</p>
          <p v-if="auth.customer?.phone">{{ auth.customer.phone }}</p>
        </div>
      </div>

      <nav class="cabinet-shell__nav" :aria-label="terms.common.cabinet">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          class="cabinet-shell__nav-link"
          active-class="cabinet-shell__nav-link--active"
          :to="item.to"
        >
          <BaseIcon :name="item.icon" size="xxs" />
          <span><BaseHoverUnderlineText>{{ item.label }}</BaseHoverUnderlineText></span>
        </NuxtLink>
        <button class="cabinet-shell__nav-link" type="button" @click="logout">
          <BaseIcon name="exit" size="xxs" />
          <span><BaseHoverUnderlineText>{{ terms.common.logOut }}</BaseHoverUnderlineText></span>
        </button>
      </nav>
    </aside>

    <div class="cabinet-shell__content">
      <div v-if="auth.isAuthenticated" class="cabinet-shell__panel">
        <slot />
      </div>
      <div v-else class="cabinet-shell__panel cabinet-shell__auth">
        <h1>{{ terms.auth.account }}</h1>
        <p>{{ terms.auth.intro }}</p>
        <CustomerAuthDialog />
      </div>
    </div>
  </section>
</template>

<style scoped>
.cabinet-shell {
  display: grid;
  gap: 1rem;
}

.cabinet-shell__sidebar,
.cabinet-shell__panel {
  background: #ffffff;
}

.cabinet-shell__sidebar {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  padding: 0.75rem;
}

.cabinet-shell__head {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  border-bottom: 1px solid rgb(10 10 10 / 0.08);
  padding: 0.75rem 0 1rem;
}

.cabinet-shell__avatar {
  display: inline-flex;
  height: 3rem;
  width: 3rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #f3f4f7;
  color: #0a0a0a;
  font-weight: 800;
}

.cabinet-shell__user {
  min-width: 0;
}

.cabinet-shell__user h1 {
  overflow: hidden;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cabinet-shell__user p {
  overflow: hidden;
  color: #737373;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cabinet-shell__nav {
  display: grid;
  gap: 0.35rem;
}

.cabinet-shell__nav-link {
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
  font-weight: 700;
  text-align: left;
  transition: color 180ms ease;
}

.cabinet-shell__nav-link:hover,
.cabinet-shell__nav-link:focus-visible {
  color: #0a0a0a;
  outline: none;
}

.cabinet-shell__nav-link--active {
  background: #f3f4f7;
  color: #0a0a0a;
}

.cabinet-shell__content {
  min-width: 0;
}

.cabinet-shell__panel {
  min-height: 34rem;
  padding: 1.25rem;
}

.cabinet-shell__auth {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 1rem;
  text-align: center;
}

.cabinet-shell__auth h1 {
  font-size: 2rem;
  font-weight: 800;
}

.cabinet-shell__auth p {
  max-width: 28rem;
  color: #525252;
  line-height: 1.7;
}

@media (min-width: 768px) {
  .cabinet-shell {
    grid-template-columns: 18.75rem minmax(0, 1fr);
    align-items: start;
  }

  .cabinet-shell__sidebar {
    position: sticky;
    top: 6rem;
  }

  .cabinet-shell__panel {
    padding: 1.5rem;
  }
}
</style>
