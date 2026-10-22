<script setup lang="ts">
defineProps<{ requested?: boolean | null }>()
const { locale } = useShopLocale()
</script>
<template>
  <dl class="order-callback-preference" data-testid="order-callback-preference">
    <dt>{{ locale === 'uk' ? 'Уточнення телефоном' : 'Order clarification call' }}</dt>
    <dd>{{ requested === true
      ? (locale === 'uk' ? 'Передзвонити для уточнення деталей' : 'Callback requested to clarify details')
      : requested === false
        ? (locale === 'uk' ? 'Дзвінок не запитано' : 'No callback requested')
        : (locale === 'uk' ? 'Не вказано' : 'Not specified') }}</dd>
  </dl>
</template>
<style scoped>
.order-callback-preference { display: grid; gap: .25rem; font-size: .85rem; }
.order-callback-preference dt { color: #737373; }
.order-callback-preference dd { font-weight: 700; }
</style>
