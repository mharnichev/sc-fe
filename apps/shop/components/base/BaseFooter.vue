<script setup lang="ts">
const { terms } = useShopLocale()
const currentYear = new Date().getFullYear()

const contacts = computed(() => [
  {
    label: terms.value.footer.location,
    href: 'https://maps.app.goo.gl/h9AqbjAoWUksTRw96',
    external: true,
  },
  {
    label: '+380 63 699 57 30',
    href: 'tel:+380636995730',
  },
  {
    label: 'Soulcutsplace@gmail.com',
    href: 'mailto:Soulcutsplace@gmail.com',
  },
])

const footerLinks = computed(() => [
  { label: terms.value.common.journal, to: '/blog/' },
  { label: terms.value.common.catalog, to: '/catalog' },
  { label: terms.value.common.contact, to: '/contacts' },
  { label: terms.value.support.title, to: '/delivery-payment' },
])

const hours = computed(() => [
  [terms.value.footer.tueSun, '09:30-20:00'],
  [terms.value.footer.monday, terms.value.footer.closed],
  [terms.value.footer.onlineOrders, '24/7'],
])
</script>

<template>
  <footer class="shop-footer" data-header-theme="dark">
    <div class="shop-footer__inner">
      <div class="shop-footer__details">
        <div class="shop-footer__info">
          <p class="shop-footer__heading">{{ terms.common.contact }}</p>
          <div class="shop-footer__info-links">
            <p v-for="item in contacts" :key="item.href">
              <a
                :href="item.href"
                :target="item.external ? '_blank' : undefined"
                :rel="item.external ? 'noopener noreferrer' : undefined"
                class="shop-footer__link"
              >
                <BaseHoverUnderlineText>{{ item.label }}</BaseHoverUnderlineText>
              </a>
            </p>
            <p v-for="link in footerLinks" :key="link.to">
              <NuxtLink :to="link.to" class="shop-footer__link">
                <BaseHoverUnderlineText>{{ link.label }}</BaseHoverUnderlineText>
              </NuxtLink>
            </p>
          </div>
        </div>

        <div class="shop-footer__hours">
          <p class="shop-footer__heading">{{ terms.common.hours }}</p>
          <dl class="shop-footer__hours-list">
            <div v-for="[day, time] in hours" :key="day" class="shop-footer__hours-row">
              <dt>{{ day }}</dt>
              <dd>{{ time }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="shop-footer__bottom">
        <p>{{ terms.footer.copyright }} {{ currentYear }} Soulcuts Journal.</p>
        <p>{{ terms.footer.tagline }}</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.shop-footer {
  overflow: hidden;
  background: #0a0a0a;
  color: #ffffff;
}

.shop-footer__inner {
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
}

.shop-footer__heading {
  color: rgb(255 255 255 / 0.45);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.shop-footer__details {
  display: grid;
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.shop-footer__info-links {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem 2rem;
  margin-top: 1rem;
  color: rgb(255 255 255 / 0.7);
  font-size: 0.875rem;
}

.shop-footer__link {
  color: inherit;
  transition: color 180ms ease;
}

.shop-footer__link:hover,
.shop-footer__link:focus-visible {
  color: #ffffff;
}

.shop-footer__hours-list {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
  color: rgb(255 255 255 / 0.7);
  font-size: 0.875rem;
}

.shop-footer__hours-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.shop-footer__hours-row dt {
  color: rgb(255 255 255 / 0.5);
}

.shop-footer__hours-row dd {
  text-align: right;
}

.shop-footer__bottom {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.5rem;
  border-top: 1px solid rgb(255 255 255 / 0.12);
  padding-top: 1.25rem;
  color: rgb(255 255 255 / 0.42);
  font-size: 0.75rem;
}

@media (min-width: 480px) {
  .shop-footer__info-links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .shop-footer__inner {
    padding: 3rem 1.5rem;
  }

  .shop-footer__details {
    grid-template-columns: minmax(0, 1.35fr) minmax(15rem, 0.65fr);
    gap: 3rem;
    margin-top: 3rem;
  }

  .shop-footer__bottom {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
