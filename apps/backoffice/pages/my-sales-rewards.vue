<script setup lang="ts">
import Workspace from '~/components/master-rewards/Workspace.vue'
definePageMeta({ middleware: () => { const auth = useAuthStore(); if (!auth.user?.is_active) return navigateTo('/login'); if (auth.user.is_superuser) return navigateTo('/admin/sales-rewards') } })
</script>
<template><Workspace :admin="false" /></template>
