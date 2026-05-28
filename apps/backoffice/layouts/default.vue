<script setup lang="ts">
const sidebarCollapsed = ref(false)
</script>

<template>
  <div class="min-h-screen">
    <div
      class="grid min-h-screen grid-rows-[auto_1fr] transition-[grid-template-columns] duration-200 xl:grid-rows-[minmax(0,1fr)]"
      :class="sidebarCollapsed ? 'xl:grid-cols-[5rem_1fr]' : 'xl:grid-cols-[260px_1fr]'"
    >
      <AppSidebar v-model:collapsed="sidebarCollapsed" />
      <main class="min-w-0 p-4 pb-28 sm:p-6 sm:pb-28 xl:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
