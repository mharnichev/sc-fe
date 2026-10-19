<script setup lang="ts">
const { terms } = useShopLocale()

const sections = computed(() => [
  { id: 'delivery', icon: 'nova-post', title: terms.value.common.delivery, summary: terms.value.support.novaPost, text: terms.value.support.novaPostPrice, detail: terms.value.support.shippingNote3 },
  { id: 'payment', icon: 'shopping-cart', title: terms.value.common.payment, summary: terms.value.support.cash, text: terms.value.support.novaPostBranch, detail: terms.value.support.shippingNote2 },
  { id: 'returns', icon: 'arrow-left', title: terms.value.common.returns, summary: terms.value.support.returnWindow, text: terms.value.support.returnByDelivery, detail: terms.value.support.returnRequirement2 },
])

useSeo(() => terms.value.cabinet.shopRules, () => terms.value.support.description)
</script>

<template>
  <CabinetShell>
    <main class="account-rules">
      <header class="account-rules__heading">
        <p class="account-rules__eyebrow">{{ terms.common.shop }}</p>
        <h1>{{ terms.cabinet.shopRules }}</h1>
        <p>{{ terms.cabinet.accountRulesIntro }}</p>
      </header>
      <article class="account-rules__content">
        <section v-for="(section, index) in sections" :key="section.id" class="account-rules__card soft-surface">
          <div class="account-rules__card-top">
            <BaseIcon :name="section.icon" size="xs" />
            <span class="account-rules__number">0{{ index + 1 }}</span>
          </div>
          <h2>{{ section.title }}</h2>
          <h3>{{ section.summary }}</h3>
          <p>{{ section.text }}</p>
          <p class="account-rules__detail">{{ section.detail }}</p>
          <BaseButton :to="`/delivery-payment#${section.id}`" variant="text" size="sm" class="account-rules__source">
            <BaseHoverUnderlineText>{{ section.title }}</BaseHoverUnderlineText>
            <BaseIcon class="account-rules__source-arrow" name="arrow-right" size="xxs" />
          </BaseButton>
        </section>
      </article>
      <aside class="account-rules__help">
        <div class="account-rules__help-copy">
          <BaseIcon name="message-outline" size="xs" />
          <div>
            <h2>{{ terms.cabinet.contactUs }}</h2>
            <p>{{ terms.cabinet.contactIntro }}</p>
          </div>
        </div>
        <BaseButton to="/cabinet/contact" size="sm">{{ terms.contacts.send }} <BaseIcon name="arrow-right" size="xxs" /></BaseButton>
      </aside>
    </main>
  </CabinetShell>
</template>

<style scoped>
.account-rules { display: grid; gap: 1.5rem; min-width: 0; }
.account-rules__heading { display: grid; gap: .5rem; }
.account-rules__heading h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 800; line-height: 1.15; }
.account-rules__heading > p:last-child { color: #737373; line-height: 1.6; }
.account-rules__eyebrow { color: #737373; font-size: .72rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.account-rules__content { display: grid; gap: 1rem; min-width: 0; }
.account-rules__card { display: flex; flex-direction: column; align-items: flex-start; gap: .85rem; min-width: 0; padding: clamp(1.25rem, 2vw, 1.75rem); }
.account-rules__card-top { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: .75rem; }
.account-rules__number { color: #8a8a8a; font-size: .75rem; font-weight: 700; letter-spacing: .12em; }
.account-rules__card h2 { font-size: 1.25rem; font-weight: 800; line-height: 1.2; }
.account-rules__card h3 { font-size: .9rem; font-weight: 700; line-height: 1.5; }
.account-rules__card p { color: #737373; font-size: .85rem; line-height: 1.65; overflow-wrap: anywhere; }
.account-rules__card .account-rules__detail { padding-top: .85rem; border-top: 1px solid rgb(0 0 0 / .08); width: 100%; }
.account-rules__source { margin-top: auto; text-decoration: none; }
.account-rules__source :deep(.account-rules__source-arrow) { transition: transform 432ms cubic-bezier(0.3, 1, 0.3, 1); }
.account-rules__source:focus-visible :deep(.account-rules__source-arrow) { transform: rotate(90deg); }
@media (hover: hover) { .account-rules__source:hover :deep(.account-rules__source-arrow) { transform: rotate(90deg); } }
@media (prefers-reduced-motion: reduce) { .account-rules__source :deep(.account-rules__source-arrow) { transition: none; } }
.account-rules__help { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.5rem; padding: 1.5rem 0; }
.account-rules__help-copy { display: flex; align-items: flex-start; gap: 1rem; }
.account-rules__help-copy > :first-child { flex-shrink: 0; }
.account-rules__help h2 { font-size: 1rem; font-weight: 800; margin-bottom: .4rem; }
.account-rules__help p { color: #737373; font-size: .85rem; line-height: 1.6; max-width: 30rem; }
@media (min-width: 1100px) { .account-rules__content { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
