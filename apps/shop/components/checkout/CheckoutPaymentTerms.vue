<script setup lang="ts">
const { terms } = useShopLocale()
</script>

<template>
  <div class="delivery-payment__list">
    <p>{{ terms.support.description }}</p>
    <section id="delivery" class="delivery-payment__section">
      <h2>{{ terms.common.delivery }}</h2>
      <details open class="delivery-payment__accordion">
        <summary>
          <span><BaseIcon name="nova-post" size="xs" /> {{ terms.support.novaPost }}</span>
        </summary>
        <article>
          <p>{{ terms.support.shipping }}</p>
          <BaseButton
            class="delivery-payment__tracking-link"
            href="https://tracking.novaposhta.ua/"
            target="_blank"
            rel="noopener noreferrer"
            variant="text"
          >
            {{ terms.support.trackShipment }}
          </BaseButton>
        </article>
      </details>
    </section>

    <section id="payment" class="delivery-payment__section">
      <h2>{{ terms.common.payment }}</h2>
      <p>{{ terms.support.payment }}</p>
    </section>

    <section id="returns" class="delivery-payment__section">
      <h2>{{ terms.common.returns }}</h2>
      <p>{{ terms.support.returns }}</p>
    </section>

    <section class="delivery-payment__section">
      <h2>{{ terms.support.refundTitle }}</h2>
      <p>{{ terms.support.refundText }}</p>
    </section>
  </div>
</template>

<style scoped>
.delivery-payment__list {
  display: grid;
  gap: 2rem;
}

.delivery-payment__section {
  scroll-margin-top: 6rem;
}

.delivery-payment__section h2 {
  margin-bottom: 0.75rem;
  color: #525252;
  font-size: 1rem;
  font-weight: 800;
  text-transform: uppercase;
}

.delivery-payment__accordion {
  border: 1px solid rgb(10 10 10 / 0.08);
  background: #ffffff;
}

.delivery-payment__accordion summary {
  display: flex;
  min-height: 3.5rem;
  cursor: pointer;
  list-style: none;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  font-weight: 800;
  text-transform: uppercase;
}

.delivery-payment__accordion summary::-webkit-details-marker {
  display: none;
}

.delivery-payment__accordion summary span {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.delivery-payment__accordion article {
  display: grid;
  gap: 0.9rem;
  border-top: 1px solid rgb(10 10 10 / 0.08);
  padding: 1rem 1.25rem 1.5rem;
  color: #525252;
  line-height: 1.7;
}

.delivery-payment__tracking-link {
  font-weight: 800;
  justify-self: start;
}

</style>
