<script setup lang="ts">
const props = defineProps<{ code: string, applied: boolean, pending: boolean, error: string, disabled?: boolean }>()
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ apply: [], remove: [] }>()
const { locale } = useShopLocale()
const apply = () => { if (!props.disabled && !props.pending && !props.applied) emit('apply') }
const onEnter = (event: KeyboardEvent) => {
  if (!(event.target instanceof HTMLInputElement)) return
  event.preventDefault()
  event.stopPropagation()
  apply()
}
</script>
<template>
  <div class="checkout-promo" @keydown.enter="onEnter">
    <div class="checkout-promo__controls">
      <BaseInput v-model="model" :label="locale === 'uk' ? 'Промокод' : 'Promo code'" :placeholder="locale === 'uk' ? 'Введіть промокод' : 'Enter promo code'" :disabled="disabled || pending || applied" autocomplete="off" />
      <BaseButton v-if="applied" type="button" variant="outline-dark" size="sm" :disabled="disabled || pending" @click="emit('remove')">{{ locale === 'uk' ? 'Видалити' : 'Remove' }}</BaseButton>
      <BaseButton v-else type="button" variant="outline-dark" size="sm" :loading="pending" :disabled="disabled || pending || !model.trim()" @click="apply">{{ locale === 'uk' ? 'Застосувати' : 'Apply' }}</BaseButton>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div v-if="code && !applied" class="checkout-promo__status">
      <BaseButton type="button" variant="text" size="xs" :disabled="disabled" @click="emit('remove')">{{ locale === 'uk' ? 'Видалити промокод' : 'Remove promo code' }}</BaseButton>
    </div>
  </div>
</template>
<style scoped>
.checkout-promo { display: grid; gap: 0.5rem; }
.checkout-promo__controls { display: flex; align-items: flex-end; gap: 0.75rem; }
.checkout-promo__controls > :first-child { flex: 1; min-width: 0; }
.checkout-promo__controls > :last-child { margin-bottom: 0.2rem; }
.checkout-promo__status { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.8rem; }
.checkout-promo > p { color: #b91c1c; font-size: 0.8rem; }
</style>
