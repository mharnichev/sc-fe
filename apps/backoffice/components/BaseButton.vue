<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type ButtonVariant =
  | 'primary'
  | 'success'
  | 'danger'
  | 'danger-outline'
  | 'danger-icon'
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
  loadingLabel?: string
  disabled?: boolean
  buttonClass?: string
}>(), {
  variant: 'unstyled',
  size: 'md',
  loadingLabel: 'Завантаження',
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

  const isIconVariant = props.variant === 'icon' || props.variant === 'danger-icon'
  const sizeClass = isIconVariant ? 'h-10 w-10 gap-0 p-0' : {
    sm: 'min-h-9 gap-1.5 px-3 py-1.5 text-xs',
    md: 'min-h-10 gap-2 px-4 py-2 text-sm',
    lg: 'min-h-11 gap-2 px-5 py-3 text-sm',
  }[props.size]

  return [
    'base-button',
    props.block ? 'w-full' : '',
    sizeClass,
  ].join(' ')
})

const variantClass = computed(() => {
  if (props.variant === 'unstyled') return ''
  if (props.variant === 'create') return 'base-button--primary'
  if (props.variant === 'danger-icon') return 'base-button--danger-outline'
  return `base-button--${props.variant}`
})
</script>

<template>
  <button
    v-bind="passthroughAttrs"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="[baseClass, variantClass, buttonClass, attrsClass]"
  >
    <slot v-if="loading" name="loading">
      <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      <span class="sr-only">{{ loadingLabel }}</span>
    </slot>
    <slot v-else />
  </button>
</template>
