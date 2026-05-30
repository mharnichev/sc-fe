<script setup lang="ts">
definePageMeta({
  middleware: () => {
    const auth = useAuthStore()
    if (!auth.user?.is_superuser && auth.user?.role !== 'admin') {
      return navigateTo('/dashboard')
    }
    return navigateTo('/admin/dashboards/barbershop')
  },
})
</script>

<template>
  <div />
</template>
