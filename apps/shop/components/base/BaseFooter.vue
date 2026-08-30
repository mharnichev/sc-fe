<script setup lang="ts">
const auth = useCustomerAuthStore()
const modal = useModalStore()
const { terms } = useShopLocale()
const currentYear = new Date().getFullYear()

const shopLinks = computed(() => [
  { label: terms.value.common.catalog, to: '/catalog' },
  { label: terms.value.common.delivery, to: '/delivery-payment#delivery' },
  { label: terms.value.common.payment, to: '/delivery-payment#payment' },
  { label: terms.value.common.returns, to: '/delivery-payment#returns' },
  { label: terms.value.common.favorites, to: '/cabinet/favorites' },
])

const supportLinks = computed(() => [
  { label: terms.value.common.contact, to: '/contacts' },
  { label: terms.value.common.checkout, to: '/checkout/purchase' },
])

const contacts = computed(() => [
  {
    icon: 'pin',
    label: terms.value.footer.location,
    href: 'https://maps.app.goo.gl/h9AqbjAoWUksTRw96',
    external: true,
  },
  {
    icon: 'phone',
    label: '+380 63 699 57 30',
    href: 'tel:+380636995730',
  },
  {
    icon: 'email',
    label: 'Soulcutsplace@gmail.com',
    href: 'mailto:Soulcutsplace@gmail.com',
  },
])

const hours = computed(() => [
  [terms.value.footer.tueSun, '09:00-20:00'],
  [terms.value.footer.monday, terms.value.footer.closed],
  [terms.value.footer.onlineOrders, '24/7'],
])

const openAccount = () => modal.openModal(auth.isAuthenticated ? 'CabinetModal' : 'UserAuthModal')

</script>

<template>
  <footer class="shop-footer" data-header-theme="dark">
    <div class="shop-footer__inner">

      <div class="shop-footer__grid">
        <div class="shop-footer__brand">
          <NuxtLink to="/" class="shop-footer__logo" :aria-label="terms.brand.homeLabel">
            <span class="shop-footer__logo-mark">{{ terms.brand.mark }}</span>
            <span class="shop-footer__logo-text">{{ terms.brand.name }}</span>
          </NuxtLink>
          <p class="shop-footer__description">
            {{ terms.footer.description }}
          </p>
        </div>

        <nav class="shop-footer__nav" :aria-label="terms.common.shop">
          <p class="shop-footer__heading">{{ terms.common.shop }}</p>
          <NuxtLink v-for="link in shopLinks" :key="link.label" :to="link.to" class="shop-footer__link">
            <BaseHoverUnderlineText>{{ link.label }}</BaseHoverUnderlineText>
          </NuxtLink>
        </nav>

        <nav class="shop-footer__nav" :aria-label="terms.common.support">
          <p class="shop-footer__heading">{{ terms.common.support }}</p>
          <NuxtLink v-for="link in supportLinks" :key="link.label" :to="link.to" class="shop-footer__link">
            <BaseHoverUnderlineText>{{ link.label }}</BaseHoverUnderlineText>
          </NuxtLink>
          <button type="button" class="shop-footer__link shop-footer__link-button" @click="openAccount">
            <BaseHoverUnderlineText>{{ auth.isAuthenticated ? terms.common.cabinet : terms.common.signIn }}</BaseHoverUnderlineText>
          </button>
          <a href="/blog/" class="shop-footer__link">
            <BaseHoverUnderlineText>{{ terms.common.journal }}</BaseHoverUnderlineText>
          </a>
        </nav>

        <div class="shop-footer__contacts">
          <p class="shop-footer__heading">{{ terms.common.contact }}</p>
          <a
            v-for="item in contacts"
            :key="item.href"
            :href="item.href"
            :target="item.external ? '_blank' : undefined"
            :rel="item.external ? 'noopener noreferrer' : undefined"
            class="shop-footer__contact"
          >
            <BaseIcon :name="item.icon" size="xxs" effect="button" variant="light" />
            <span><BaseHoverUnderlineText>{{ item.label }}</BaseHoverUnderlineText></span>
          </a>
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
        <p>(c) {{ currentYear }} {{ terms.footer.copyright }}</p>
        <p>{{ terms.footer.tagline }}</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.shop-footer {
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 18%, rgb(255 255 255 / 0.12), transparent 18rem),
    linear-gradient(180deg, #111111 0%, #050505 100%);
  color: #ffffff;
}

.shop-footer__inner {
  margin: 0 auto;
  width: 100%;
  max-width: 80rem;
  padding: 3.25rem 1rem 6.5rem;
}

.shop-footer__cta {
  display: grid;
  gap: 1.5rem;
  border-bottom: 1px solid rgb(255 255 255 / 0.12);
  padding-bottom: 2rem;
}

.shop-footer__cta-copy {
  max-width: 44rem;
}

.shop-footer__title {
  margin-top: 0.85rem;
  max-width: 48rem;
  font-size: clamp(2rem, 5vw, 4.5rem);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 0.94;
  text-transform: uppercase;
}

.shop-footer__text {
  margin-top: 1rem;
  max-width: 38rem;
  color: rgb(255 255 255 / 0.68);
  font-size: 1rem;
  line-height: 1.75;
}

.shop-footer__cta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.shop-footer__grid {
  display: grid;
  gap: 2rem;
  padding-top: 2.25rem;
}

.shop-footer__brand {
  max-width: 24rem;
}

.shop-footer__logo {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.7rem;
  color: #ffffff;
}

.shop-footer__logo-mark {
  display: inline-flex;
  height: 2.5rem;
  width: 2.5rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid #ffffff;
  background: #ffffff;
  color: #0a0a0a;
  font-size: 0.75rem;
  font-weight: 800;
}

.shop-footer__logo-text {
  max-width: 10rem;
  overflow: hidden;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-footer__description {
  margin-top: 1rem;
  color: rgb(255 255 255 / 0.58);
  font-size: 0.9rem;
  line-height: 1.75;
}

.shop-footer__nav,
.shop-footer__contacts,
.shop-footer__hours {
  display: grid;
  align-content: start;
  gap: 0.7rem;
}

.shop-footer__heading {
  margin-bottom: 0.25rem;
  color: rgb(255 255 255 / 0.45);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.shop-footer__link,
.shop-footer__contact {
  width: fit-content;
  color: rgb(255 255 255 / 0.72);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.4;
  transition:
    color 180ms ease,
    transform 180ms ease;
}

.shop-footer__link-button {
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
}

.shop-footer__link:hover,
.shop-footer__link:focus-visible,
.shop-footer__contact:hover,
.shop-footer__contact:focus-visible {
  color: #ffffff;
  outline: none;
  transform: translateX(0.2rem);
}

.shop-footer__contact {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.65rem;
}

.shop-footer__hours-list {
  display: grid;
  gap: 0.65rem;
  color: rgb(255 255 255 / 0.72);
  font-size: 0.9rem;
}

.shop-footer__hours-row {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
}

.shop-footer__hours-row dt {
  color: rgb(255 255 255 / 0.52);
}

.shop-footer__hours-row dd {
  text-align: right;
  font-weight: 700;
}

.shop-footer__bottom {
  margin-top: 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid rgb(255 255 255 / 0.12);
  padding-top: 1.25rem;
  color: rgb(255 255 255 / 0.42);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

@media (min-width: 768px) {
  .shop-footer__inner {
    padding: 4.5rem 1.5rem 3rem;
  }

  .shop-footer__cta {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 2rem;
    padding-bottom: 3rem;
  }

  .shop-footer__cta-actions {
    justify-content: flex-end;
  }

  .shop-footer__grid {
    grid-template-columns: minmax(16rem, 1.4fr) repeat(4, minmax(0, 1fr));
    gap: 2.5rem;
    padding-top: 3rem;
  }

  .shop-footer__bottom {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
