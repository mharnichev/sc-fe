<script setup lang="ts">
import { isDobrodeskEnabled, isDobrodeskPublicRoute } from '~/utils/dobrodesk'

const config = useRuntimeConfig()
const route = useRoute()
const modal = useModalStore()
const { locale } = useShopLocale()
const { $shopSupport } = useNuxtApp()
const visible = computed(() => isDobrodeskEnabled(config.public.dobrodeskEnabled)
  && Boolean(config.public.dobrodeskIntegrationId)
  && isDobrodeskPublicRoute(route, config.app.baseURL)
  && !/\/cabinet\/contact\/?$/.test(route.path)
  && !modal.activeModal)
const label = computed(() => locale.value === 'uk' ? 'Допомога' : 'Support')
const failed = computed(() => $shopSupport.status.value === 'error')
const loading = computed(() => $shopSupport.status.value === 'loading')
</script>

<template>
  <aside v-if="visible" class="shop-support" :aria-label="label">
    <div v-if="failed" class="shop-support__error" role="status">
      <p>{{ locale === 'uk' ? 'Чат тимчасово недоступний.' : 'Chat is temporarily unavailable.' }}</p>
      <NuxtLink to="/contacts">{{ locale === 'uk' ? 'Інші способи зв’язку' : 'Other ways to contact us' }}</NuxtLink>
    </div>
    <BaseButton
      class="shop-support__launcher"
      variant="light"
      size="sm"
      :loading="loading"
      :disabled="failed"
      :aria-label="loading ? (locale === 'uk' ? 'Завантаження чату' : 'Loading chat') : label"
      @click="$shopSupport.open()"
    >
      <span class="shop-support__content">
        <BaseIcon name="message-outline" size="xxs" />
        <span>{{ label }}</span>
      </span>
    </BaseButton>
  </aside>
</template>

<style scoped>
.shop-support {
  position: fixed;
  z-index: 80;
  right: 24px;
  bottom: max(24px, env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: calc(100vw - 32px);
}
.shop-support__launcher {
  --sc-button-bg: rgb(255 255 255 / 0.92);
  --sc-button-border: rgb(10 10 10 / 0.14);
  --sc-button-shadow: 0 4px 20px rgb(0 0 0 / 0.08);
  --sc-button-backdrop-filter: blur(18px);
  min-height: 44px;
}
.shop-support__content { display: inline-flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0; text-transform: uppercase; }
.shop-support__error { padding: 16px; border: 1px solid #d6d3d1; border-radius: 4px; background: #fff; color: #0a0a0a; font-size: 12px; }
.shop-support__error a { display: inline-block; margin-top: 8px; text-decoration: underline; }
@media (max-width: 767px) { .shop-support { right: 12px; bottom: calc(64px + env(safe-area-inset-bottom)); } }
@media (prefers-reduced-transparency: reduce) {
  .shop-support__launcher { --sc-button-bg: #fff; --sc-button-backdrop-filter: none; }
}
</style>
