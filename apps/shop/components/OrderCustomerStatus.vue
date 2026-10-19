<script setup lang="ts">
import type { CustomerOrder } from '~/types/order'
import { customerOrderStatus } from '~/utils/customerOrderStatus'
const props = defineProps<{ order: CustomerOrder, carrierIcon?: boolean }>()
const { locale } = useShopLocale()
const presentation = computed(() => customerOrderStatus(props.order, locale.value))
</script>
<template><OrderStatusBadge v-bind="presentation" :icon="carrierIcon ? 'nova-post' : presentation.icon" /></template>
