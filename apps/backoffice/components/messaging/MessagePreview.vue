<script setup lang="ts">
const props = defineProps<{
  body: string
  buttonText?: string | null
  sample?: Record<string, string>
}>()

const { interpolateMessage, sampleClient } = useMessagingUi()
const rendered = computed(() => interpolateMessage(props.body || 'Повідомлення ще не заповнено.', props.sample || sampleClient))
</script>

<template>
  <section class="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
    <div class="mx-auto max-w-sm rounded-[1.25rem] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p class="whitespace-pre-line text-sm leading-6 text-slate-900">{{ rendered }}</p>
      <button
        v-if="buttonText"
        type="button"
        class="mt-4 w-full rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white"
      >
        {{ buttonText }}
      </button>
    </div>
  </section>
</template>
