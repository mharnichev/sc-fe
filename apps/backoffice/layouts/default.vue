<script setup lang="ts">
const sidebarCollapsed = ref(false)
</script>

<template>
  <div class="min-h-screen overflow-hidden">
    <div class="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_28rem)]" />
    <div
      class="relative grid min-h-screen grid-rows-[auto_1fr] transition-[grid-template-columns] duration-200 xl:grid-rows-[minmax(0,1fr)]"
      :class="sidebarCollapsed ? 'xl:grid-cols-[5.5rem_1fr]' : 'xl:grid-cols-[18rem_1fr]'"
    >
      <AppSidebar v-model:collapsed="sidebarCollapsed" />
      <main class="min-w-0 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28 xl:p-7">
        <div class="mx-auto w-full max-w-[1680px]">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
