<script setup lang="ts">
const { terms } = useTerms()

const botLink = 'https://t.me/SoulcutsBot'
</script>

<template>
  <section id="bot" data-header-theme="dark" class="scroll-mt-24 bg-neutral-950 pb-12 text-white sm:pb-14 md:pb-24 xl:pb-28">
    <div class="site-container">
      <div class="grid gap-6 border border-white/15 bg-white/[0.03] p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_15rem] md:p-8 lg:grid-cols-[minmax(0,1fr)_16rem]" data-reveal="soft">
        <div class="flex flex-col justify-between gap-8">
          <div>
            <p class="inline-flex border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
              {{ terms.home.bot.badge }}
            </p>
            <h2 class="mt-5 text-4xl font-semibold leading-none tracking-normal text-white sm:text-5xl md:text-[52px]">
              {{ terms.home.bot.title }}
            </h2>
            <p class="mt-5 max-w-2xl text-base leading-7 text-white/68 md:text-lg md:leading-8">
              {{ terms.home.bot.description }}
            </p>
          </div>

          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <NuxtLink
              :to="botLink"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex w-full items-center justify-center gap-2 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-950 transition hover:bg-white/90 sm:w-auto sm:text-sm sm:tracking-[0.16em]"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 4 3.8 10.7c-1 .4-.9 1.8.1 2.1l4.4 1.3 1.7 5.2c.3.9 1.5 1.1 2.1.3l2.4-3 4.5 3.3c.8.6 1.9.1 2.1-.9L23 5.2c.1-.8-.8-1.5-2-1.2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                <path d="m8.5 14 9.8-6.1-7.7 8.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ terms.home.bot.cta }}
            </NuxtLink>
            <p class="max-w-sm text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              {{ terms.home.bot.features }}
            </p>
          </div>
        </div>

        <div class="border border-white/15 bg-white p-4 text-neutral-950">
          <img src="/soulcuts-bot-qr.svg" :alt="terms.home.bot.qrAlt" class="aspect-square w-full object-contain">
          <p class="mt-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            {{ terms.home.bot.qrCaption }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
