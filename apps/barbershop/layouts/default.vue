<template>
  <div class="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_38%),linear-gradient(180deg,_#faf7f2,_#f4eee3)]">
    <header class="border-b border-black/5">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <NuxtLink to="/" class="text-lg font-semibold tracking-[0.2em] text-stone-900">
          ATELIER BARBER
        </NuxtLink>
        <nav class="hidden gap-6 text-sm text-stone-700 md:flex">
          <NuxtLink to="/about">About</NuxtLink>
          <NuxtLink to="/services">Services</NuxtLink>
          <NuxtLink to="/masters">Masters</NuxtLink>
          <NuxtLink to="/contacts">Contacts</NuxtLink>
          <NuxtLink to="/blog-faq">Blog & FAQ</NuxtLink>
        </nav>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-6 py-10">
      <slot />
    </main>
  </div>
</template>
