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
        <h3 class="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
          {{ title }}
        </h3>
        <slot>
          <p v-if="message" class="mt-4 text-base leading-7" :class="tone === 'dark' ? 'text-white/68' : 'text-neutral-600'">
            {{ message }}
          </p>
        </slot>
        <button
          v-if="actionLabel"
          type="button"
          class="mt-6 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] transition"
          :class="tone === 'dark' ? 'bg-white text-neutral-950 hover:bg-white/90' : 'bg-neutral-950 text-white hover:bg-neutral-800'"
          @click="emit('action')"
        >
          {{ actionLabel }}
        </button>
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
