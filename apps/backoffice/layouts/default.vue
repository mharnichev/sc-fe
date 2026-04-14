<template>
  <div class="min-h-screen">
    <div class="grid min-h-screen lg:grid-cols-[260px_1fr]">
      <AppSidebar />
      <main class="p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
