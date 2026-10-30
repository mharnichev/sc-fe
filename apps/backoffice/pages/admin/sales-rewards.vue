<script setup lang="ts">
import Workspace from '~/components/master-rewards/Workspace.vue'
definePageMeta({ middleware: () => { const auth = useAuthStore(); if (!auth.user?.is_active || !auth.user.is_superuser) return navigateTo('/dashboard') } })
</script>
<template><Workspace admin /></template>
