<script setup lang="ts">
const { terms } = useTerms()
const { resetCookieConsent } = useCookieConsent()

const phoneHref = computed(() => `tel:${terms.value.home.contact.phone.replace(/[^\d+]/g, '')}`)
const emailHref = computed(() => `mailto:${terms.value.home.contact.email}`)
</script>

<template>
  <footer class="bg-neutral-950 pb-10 text-white">
    <div class="site-container grid gap-12 border-t border-white/15 pt-12 md:grid-cols-[1.2fr_0.8fr_0.8fr]" data-reveal="soft">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.32em]">{{ terms.common.brand }}</p>
        <p class="mt-4 max-w-sm text-sm leading-7 text-white/55">
          {{ terms.home.footer.description }}
        </p>
      </div>
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">{{ terms.common.info }}</p>
        <div class="mt-4 space-y-2 text-sm text-white/70">
          <p>
            <a
              :href="terms.home.contact.mapUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              {{ terms.home.contact.address }}
            </a>
          </p>
          <p>
            <a :href="phoneHref" class="transition hover:text-white hover:underline">
              {{ terms.home.contact.phone }}
            </a>
          </p>
          <p v-if="terms.home.contact.email">
            <a :href="emailHref" class="transition hover:text-white hover:underline">
              {{ terms.home.contact.email }}
            </a>
          </p>
          <button
            type="button"
            class="text-left underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white"
            @click="resetCookieConsent"
          >
            {{ terms.common.cookieSettings }}
          </button>
        </div>
      </div>
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">{{ terms.common.hours }}</p>
        <dl class="mt-4 space-y-2 text-sm text-white/70">
          <div v-for="[day, time] in terms.home.contact.hours" :key="day" class="flex justify-between gap-4">
            <dt>{{ day }}</dt>
            <dd>{{ time }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </footer>
</template>
