<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type ButtonVariant =
  | 'primary'
  | 'success'
  | 'danger'
  | 'danger-outline'
  | 'secondary'
  | 'neutral'
  | 'create'
  | 'ghost'
  | 'outline'
  | 'icon'
  | 'unstyled'

const props = withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset'
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  loading?: boolean
  disabled?: boolean
  buttonClass?: string
}>(), {
  variant: 'unstyled',
  size: 'md',
  buttonClass: '',
})

const attrs = useAttrs()
const passthroughAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
const attrsClass = computed(() => attrs.class)

const baseClass = computed(() => {
  if (props.variant === 'unstyled') return ''

  const sizeClass = {
    sm: 'min-h-9 gap-1.5 px-3 py-1.5 text-xs',
    md: 'min-h-10 gap-2 px-4 py-2 text-sm',
    lg: 'min-h-11 gap-2 px-5 py-3 text-sm',
  }[props.size]

  return [
    'inline-flex items-center justify-center rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
    props.block ? 'w-full' : '',
    sizeClass,
  ].join(' ')
})

const variantClass = computed(() => {
  if (props.variant === 'unstyled') return ''
  if (props.variant === 'primary') return 'border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
  if (props.variant === 'success') return 'border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
  if (props.variant === 'danger') return 'border border-rose-500 bg-rose-600 text-white hover:bg-rose-700'
  if (props.variant === 'danger-outline') return 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
  if (props.variant === 'secondary') return 'border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
  if (props.variant === 'neutral') return 'border border-slate-300 text-slate-700 hover:bg-slate-50'
  if (props.variant === 'create') return 'backoffice-page-create-button border'
  if (props.variant === 'icon') return 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 p-0 text-slate-700'
  if (props.variant === 'ghost') return 'border border-transparent text-slate-700 hover:bg-slate-50'
  return 'border border-slate-300 text-slate-700'
})
</script>

<template>
  <button
    v-bind="passthroughAttrs"
    :type="type"
    :disabled="disabled || loading"
    :class="[baseClass, variantClass, buttonClass, attrsClass]"
  >
    <slot name="loading" v-if="loading">
      <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    </slot>
    <slot v-else />
  </button>
</template>
