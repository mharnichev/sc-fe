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
  () => terms.value.support.title,
  () => terms.value.support.description,
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

      <div class="delivery-payment__list">
        <section id="delivery" class="delivery-payment__section">
          <h2>{{ terms.common.delivery }}</h2>
          <details open class="delivery-payment__accordion">
            <summary>
              <span><BaseIcon name="nova-post" size="xs" /> {{ terms.support.novaPost }}</span>
              <span>{{ terms.support.novaPostPrice }}</span>
            </summary>
            <article>
              <h3>{{ terms.support.shippingCost }}</h3>
              <ul>
                <li>{{ terms.support.mailboxCost }}</li>
                <li>{{ terms.support.departmentCost }}</li>
                <li>{{ terms.support.courierCost }}</li>
              </ul>
              <h3>{{ terms.support.deliverySms }}</h3>
              <ul>
                <li>{{ terms.support.departmentStorage }}</li>
                <li>{{ terms.support.postomatStorage }}</li>
              </ul>
              <h3>{{ terms.support.note }}</h3>
              <ul>
                <li>{{ terms.support.shippingNote1 }}</li>
                <li>{{ terms.support.shippingNote2 }}</li>
                <li>{{ terms.support.shippingNote3 }}</li>
                <li>{{ terms.support.shippingNote4 }}</li>
              </ul>
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
          <details open class="delivery-payment__accordion">
            <summary>
              <span>{{ terms.support.cash }}</span>
            </summary>
            <article>
              <h3>{{ terms.support.canPayCash }}</h3>
              <ul>
                <li>{{ terms.support.novaPostBranch }}</li>
              </ul>
              <h3>{{ terms.support.note }}</h3>
              <ul>
                <li>{{ terms.support.identificationNote }}</li>
              </ul>
            </article>
          </details>
        </section>

        <section id="returns" class="delivery-payment__section">
          <h2>{{ terms.common.returns }}</h2>
          <details open class="delivery-payment__accordion">
            <summary>
              <span>{{ terms.support.returnWindow }}</span>
            </summary>
            <article>
              <p>{{ terms.support.returnWindowText }}</p>
              <ul>
                <li>{{ terms.support.returnByDelivery }}</li>
              </ul>
              <h3>{{ terms.support.productRequirements }}</h3>
              <ul>
                <li>{{ terms.support.returnRequirement1 }}</li>
                <li>{{ terms.support.returnRequirement2 }}</li>
                <li>{{ terms.support.returnRequirement3 }}</li>
                <li>{{ terms.support.returnRequirement4 }}</li>
                <li>{{ terms.support.returnRequirement5 }}</li>
              </ul>
              <h3>{{ terms.support.note }}</h3>
              <ul>
                <li>{{ terms.support.returnNote1 }}</li>
                <li>{{ terms.support.returnNote2 }}</li>
              </ul>
            </article>
          </details>

          <details class="delivery-payment__accordion">
            <summary>
              <span>{{ terms.support.howReturn }}</span>
            </summary>
            <article>
              <p>{{ terms.support.howReturnText }}</p>
              <p>{{ terms.support.packageWithReceipt }}</p>
              <h3>{{ terms.support.returnData }}</h3>
              <dl class="delivery-payment__info">
                <div v-for="item in terms.support.returnInfo" :key="item.label">
                  <dt>{{ item.label }}</dt>
                  <dd>{{ item.value }}</dd>
                </div>
              </dl>
              <h3>{{ terms.support.refundTitle }}</h3>
              <p>{{ terms.support.refundText }}</p>
            </article>
          </details>
        </section>
      </div>
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

.delivery-payment__accordion + .delivery-payment__accordion {
  margin-top: 0.75rem;
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

.delivery-payment__accordion h3 {
  color: #343434;
  font-size: 1rem;
  font-weight: 800;
}

.delivery-payment__accordion ul {
  display: grid;
  gap: 0.5rem;
  padding-left: 1.25rem;
}

.delivery-payment__accordion li {
  list-style: disc;
}

.delivery-payment__tracking-link {
  font-weight: 800;
  justify-self: start;
}

.delivery-payment__info {
  display: grid;
  gap: 0.8rem;
}

.delivery-payment__info div {
  display: grid;
  gap: 0.25rem;
}

.delivery-payment__info dt {
  color: #808594;
}

.delivery-payment__info dd {
  color: #343434;
  font-weight: 700;
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
