<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: boolean
  maxWidthClass?: string
}>(), {
  maxWidthClass: 'max-w-3xl',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-0 py-0 sm:items-center sm:px-4 sm:py-6"
      @click.self="close"
    >
      <section
        class="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.5rem] bg-white shadow-2xl sm:max-h-full sm:rounded-[1.75rem]"
        :class="maxWidthClass"
        role="dialog"
        aria-modal="true"
      >
        <header v-if="$slots.head" class="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
          <slot name="head" :close="close" />
        </header>

        <div v-if="$slots.body" class="px-4 py-5 sm:px-6">
          <slot name="body" :close="close" />
        </div>
      </section>
    </div>
  </Teleport>
</template>
