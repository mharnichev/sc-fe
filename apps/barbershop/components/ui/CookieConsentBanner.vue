<script setup lang="ts">
const { terms } = useTerms()
const {
  hasConsent,
  acceptAllCookies,
  acceptNecessaryCookies,
} = useCookieConsent()
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-4 opacity-0"
  >
    <aside
      v-if="!hasConsent"
      class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
      :aria-label="terms.cookieConsent.title"
    >
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 border border-neutral-900/10 bg-white p-5 shadow-2xl shadow-neutral-950/15 sm:p-6 md:flex-row md:items-end md:justify-between">
        <div class="max-w-2xl">
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            {{ terms.cookieConsent.label }}
          </p>
          <h2 class="mt-2 text-xl font-semibold leading-tight text-neutral-950">
            {{ terms.cookieConsent.title }}
          </h2>
          <p class="mt-3 text-sm leading-6 text-neutral-600">
            {{ terms.cookieConsent.text }}
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row md:shrink-0">
          <BaseButton
            type="button"
            variant="light"
            @click="acceptNecessaryCookies"
          >
            {{ terms.cookieConsent.necessaryOnly }}
          </BaseButton>
          <BaseButton
            type="button"
            @click="acceptAllCookies"
          >
            {{ terms.cookieConsent.acceptAll }}
          </BaseButton>
        </div>
      </div>
    </aside>
  </Transition>
</template>
