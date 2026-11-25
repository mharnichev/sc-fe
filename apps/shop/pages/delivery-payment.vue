<script setup lang="ts">
const { terms } = useShopLocale()

const scrollToBlock = (id: string) => {
  if (!import.meta.client) return
  const element = document.getElementById(id)
  if (!element) return
  const top = element.getBoundingClientRect().top + window.scrollY - 96
  window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}

useSeo(
  () => terms.value.seo.deliveryTitle,
  () => terms.value.seo.deliveryDescription,
)
</script>

<template>
  <section class="delivery-payment">
    <h1 class="delivery-payment__title">{{ terms.support.title }}</h1>
    <div class="delivery-payment__body">
      <nav class="delivery-payment__nav" :aria-label="terms.support.title">
        <BaseButton class="delivery-payment__nav-button" type="button" variant="text" @click="scrollToBlock('delivery')">
          {{ terms.common.delivery }}
        </BaseButton>
        <BaseButton class="delivery-payment__nav-button" type="button" variant="text" @click="scrollToBlock('payment')">
          {{ terms.common.payment }}
        </BaseButton>
        <BaseButton class="delivery-payment__nav-button" type="button" variant="text" @click="scrollToBlock('returns')">
          {{ terms.common.returns }}
        </BaseButton>
      </nav>

      <CheckoutPaymentTerms />
    </div>
  </section>
</template>

<style scoped>
.delivery-payment {
  background: #ffffff;
  padding: 1rem;
}

.delivery-payment__title {
  padding: 0.5rem 0 1rem;
  font-size: 1.25rem;
  font-weight: 800;
  text-transform: uppercase;
}

.delivery-payment__body {
  display: grid;
  gap: 1.5rem;
}

.delivery-payment__nav {
  display: none;
}

@media (min-width: 900px) {
  .delivery-payment {
    padding: 1.5rem 2rem;
  }

  .delivery-payment__body {
    grid-template-columns: 18rem minmax(0, 1fr);
    align-items: start;
  }

  .delivery-payment__nav {
    position: sticky;
    top: 6rem;
    display: grid;
    gap: 0.25rem;
  }

  .delivery-payment__nav-button {
    --sc-button-text: #737373;
    --sc-button-hover-text: #0a0a0a;

    width: 100%;
    justify-content: flex-start;
    padding: 0.8rem;
    font-weight: 800;
    text-align: left;
  }

  .delivery-payment__nav-button :deep(.sc-button__text) {
    justify-content: flex-start;
  }
}
</style>
