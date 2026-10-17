<script setup lang="ts">
const props = defineProps<{
  dirty: boolean
  busy?: boolean
  documentId?: number | null
  guardDocumentChanges?: boolean
}>()

const open = ref(false)
let resolveNavigation: ((leave: boolean) => void) | null = null

const finish = (leave: boolean) => {
  open.value = false
  const resolve = resolveNavigation
  resolveNavigation = null
  resolve?.(leave)
}
const requestLeave = () => {
  if (props.busy) return false
  if (!props.dirty) return true
  if (resolveNavigation) return false
  open.value = true
  return new Promise<boolean>((resolve) => { resolveNavigation = resolve })
}

onBeforeRouteLeave(requestLeave)
onBeforeRouteUpdate((to, from) => {
  if (!props.guardDocumentChanges || to.query.id === from.query.id) return true
  // Creating a draft adds its saved ID to the URL without discarding the form.
  if (props.documentId && to.query.id === String(props.documentId)) return true
  return requestLeave()
})

const beforeUnload = (event: BeforeUnloadEvent) => {
  if (!props.dirty && !props.busy) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  finish(false)
})
</script>

<template>
  <ConfirmActionModal
    :model-value="open"
    title="Залишити сторінку?"
    message="На сторінці є незбережені дані. Якщо ви підете, ці зміни буде втрачено. Збережені рядки та чернетки залишаться доступними."
    confirm-label="Вийти без збереження"
    cancel-label="Залишитися"
    destructive
    @update:model-value="!$event && finish(false)"
    @confirm="finish(true)"
  />
</template>

