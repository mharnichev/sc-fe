<script setup lang="ts">
const emit = defineEmits<{ select: [variable: string] }>()
const { variables } = useMessagingUi()
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <BaseButton
      v-for="variable in variables"
      :key="variable"
      type="button"
      class="messaging-accent-action rounded-full px-3 py-1.5 text-xs font-medium transition"
      @click="emit('select', variable)"
    >
      {{ variable }}
    </BaseButton>
  </div>
</template>
