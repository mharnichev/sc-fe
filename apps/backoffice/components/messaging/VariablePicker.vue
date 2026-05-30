<script setup lang="ts">
const emit = defineEmits<{ select: [variable: string] }>()
const { variables } = useMessagingUi()
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="variable in variables"
      :key="variable"
      type="button"
      class="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800 transition hover:bg-cyan-100"
      @click="emit('select', variable)"
    >
      {{ variable }}
    </button>
  </div>
</template>
