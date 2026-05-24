<script setup lang="ts">
const sidebarCollapsed = ref(false)
</script>

<template>
  <div class="min-h-screen">
    <div
      class="grid min-h-screen grid-rows-[auto_1fr] transition-[grid-template-columns] duration-200 lg:grid-rows-[minmax(0,1fr)]"
      :class="sidebarCollapsed ? 'lg:grid-cols-[5rem_1fr]' : 'lg:grid-cols-[260px_1fr]'"
    >
      <AppSidebar v-model:collapsed="sidebarCollapsed" />
      <main class="min-w-0 p-4 sm:p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
