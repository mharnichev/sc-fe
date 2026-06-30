<script setup lang="ts">
withDefaults(defineProps<{
  show: boolean
  label?: string
  title: string
  message?: string
  actionLabel?: string
  tone?: 'light' | 'dark'
}>(), {
  label: '',
  message: '',
  actionLabel: '',
  tone: 'light',
})

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <Transition name="form-status-overlay">
    <div
      v-if="show"
      class="absolute inset-0 z-10 flex items-center justify-center p-4 backdrop-blur-[8px] md:p-8"
      :class="tone === 'dark' ? 'bg-neutral-950/92 text-white' : 'bg-white/94 text-neutral-950'"
      role="status"
      aria-live="polite"
    >
      <div class="max-w-xl text-center">
        <p v-if="label" class="text-xs font-semibold uppercase tracking-[0.24em]" :class="tone === 'dark' ? 'text-white/45' : 'text-neutral-500'">
          {{ label }}
        </p>
        <h3 class="mt-3 text-2xl font-semibold uppercase leading-tight md:text-4xl">
          {{ title }}
        </h3>
        <slot>
          <p v-if="message" class="mt-4 text-base leading-7" :class="tone === 'dark' ? 'text-white/68' : 'text-neutral-600'">
            {{ message }}
          </p>
        </slot>
        <BaseButton
          v-if="actionLabel"
          type="button"
          :variant="tone === 'dark' ? 'light' : 'dark'"
          class="mt-6"
          @click="emit('action')"
        >
          {{ actionLabel }}
        </BaseButton>
      </div>
    </div>
  </Transition>
</template>

<style>
.form-status-overlay-enter-active,
.form-status-overlay-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms ease;
}

.form-status-overlay-enter-from,
.form-status-overlay-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
</style>
