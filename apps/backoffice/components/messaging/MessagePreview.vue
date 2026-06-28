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
  <section class="messaging-preview-shell rounded-[1.25rem] border p-4">
    <div class="messaging-preview-bubble mx-auto max-w-sm rounded-[1.25rem] p-4 shadow-sm">
      <p class="whitespace-pre-line text-sm leading-6 text-slate-900">{{ rendered }}</p>
      <BaseButton
        v-if="buttonText"
        type="button"
        class="messaging-accent-action mt-4 w-full rounded-xl px-4 py-2 text-sm font-medium"
      >
        {{ buttonText }}
      </BaseButton>
    </div>
  </section>
</template>
