<script setup lang="ts">
const auth = useCustomerAuthStore()
const route = useRoute()
const { terms } = useShopLocale()
const isHydrated = ref(false)

onMounted(() => {
  isHydrated.value = true
})

const initials = computed(() => {
  if (!isHydrated.value) return ''
  const source = [auth.customer?.name, auth.customer?.surname].filter(Boolean).join(' ') || auth.displayName
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
})

const navItems = computed(() => [
  { icon: 'user', label: terms.value.cabinet.myAccount, to: '/cabinet' },
  { icon: 'clock', label: terms.value.cabinet.myOrders, to: '/cabinet/purchase-history' },
  { icon: 'heart', label: terms.value.common.favorites, to: '/cabinet/favorites' },
  { icon: 'message-outline', label: terms.value.cabinet.contactUs, to: '/cabinet/contact' },
  { icon: 'info-outline', label: terms.value.cabinet.shopRules, to: '/cabinet/shop-rules' },
])

const activeNavPath = computed(() => navItems.value
  .filter(item => route.path === item.to || route.path.startsWith(`${item.to}/`))
  .sort((a, b) => b.to.length - a.to.length)[0]?.to)

const logout = async () => {
  auth.logout()
  await navigateTo('/')
}
</script>

<template>
  <section class="cabinet-shell">
    <aside class="cabinet-shell__sidebar">
      <div v-if="isHydrated" class="cabinet-shell__head">
        <span class="cabinet-shell__avatar">
          <span v-if="initials">{{ initials }}</span>
          <BaseIcon v-else name="user" size="xs" />
        </span>
        <div class="cabinet-shell__user">
          <p class="cabinet-shell__name">{{ auth.displayName }}</p>
          <p v-if="auth.customer?.email">{{ auth.customer.email }}</p>
          <p v-if="auth.customer?.phone">{{ auth.customer.phone }}</p>
        </div>
      </div>

      <nav class="cabinet-shell__nav" :aria-label="terms.common.cabinet">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          class="cabinet-shell__nav-link"
          :to="item.to"
          :class="{ 'cabinet-shell__nav-link--active': activeNavPath === item.to }"
          :aria-current="activeNavPath === item.to ? 'page' : undefined"
        >
          <BaseIcon :name="item.icon" size="xxs" />
          <span><BaseHoverUnderlineText>{{ item.label }}</BaseHoverUnderlineText></span>
        </NuxtLink>
        <button class="cabinet-shell__nav-link" type="button" @click="logout">
          <BaseIcon name="log-out-outline" size="xxs" />
          <span><BaseHoverUnderlineText>{{ terms.common.logOut }}</BaseHoverUnderlineText></span>
        </button>
      </nav>
    </aside>

    <div class="cabinet-shell__content">
      <div v-if="isHydrated && auth.isAuthenticated" class="cabinet-shell__panel">
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
  background: var(--sc-surface-muted);
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

.cabinet-shell__name {
  overflow: hidden;
  font-size: 1rem;
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
  font-weight: 500;
  text-align: left;
  transition: color 180ms ease;
}

.cabinet-shell__nav-link:hover,
.cabinet-shell__nav-link:focus-visible {
  color: #0a0a0a;
  outline: none;
}

.cabinet-shell__nav-link--active {
  background: var(--sc-surface-muted);
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
    grid-template-columns: 15rem minmax(0, 1fr);
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

@media (max-width: 767px) {
  .cabinet-shell__sidebar {
    display: none;
  }

  .cabinet-shell {
    gap: 0.5rem;
  }

  .cabinet-shell__sidebar {
    gap: 0.4rem;
    padding: 0.5rem;
  }

  .cabinet-shell__head {
    padding: 0.35rem 0.25rem 0.55rem;
  }

  .cabinet-shell__avatar {
    width: 2.5rem;
    height: 2.5rem;
  }

  .cabinet-shell__nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }

  .cabinet-shell__nav-link {
    min-width: 0;
    min-height: 2.5rem;
    gap: 0.4rem;
    padding: 0.35rem;
    font-size: 0.75rem;
    line-height: 1.2;
  }

  .cabinet-shell__nav-link span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .cabinet-shell__panel {
    min-height: 0;
    padding: 1rem 0.75rem;
  }
}
</style>
