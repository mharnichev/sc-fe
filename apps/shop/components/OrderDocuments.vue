<script setup lang="ts">
import type { PreliminaryDocument } from '~/types/order'
const props = defineProps<{ orderId: number, documents?: PreliminaryDocument[], guest?: boolean }>()
const api = useApi()
const auth = useCustomerAuthStore()
const busy = ref(false)
const error = ref('')
let context = 0
const pendingWindows = new Set<Window>()
const invalidate = () => {
  context++
  pendingWindows.forEach(preview => preview.close()); pendingWindows.clear()
  busy.value = false; error.value = ''
}
watch([() => props.orderId, () => props.guest, () => auth.customer?.id, () => auth.sessionRevision, () => auth.accessToken], invalidate, { flush: 'sync' })
onBeforeUnmount(invalidate)
const openDocument = async (document: PreliminaryDocument) => {
  if (busy.value) return
  const generation = context
  // Open synchronously so browser popup protection does not lose the print window.
  const preview = window.open('about:blank', '_blank')
  if (!preview) { error.value = 'Дозвольте відкриття вікна для перегляду документа.'; return }
  preview.opener = null
  pendingWindows.add(preview)
  busy.value = true
  error.value = ''
  try {
    const guestPath = document.print_url.replace(/^\/api\/v1/, '')
    if (props.guest && !/^\/public\/order-documents\/[A-Za-z0-9_.-]+$/.test(guestPath)) throw new Error('Invalid document path')
    const path = props.guest ? guestPath : `/public/orders/me/${props.orderId}/preliminary-documents/${document.id}/print`
    const html = await api<string>(path, { responseType: 'text' })
    if (generation !== context) { preview.close(); return }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    preview.location.replace(url)
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  catch { preview.close(); if (generation === context) error.value = 'Не вдалося відкрити документ. Посилання могло втратити чинність.' }
  finally { pendingWindows.delete(preview); if (generation === context) busy.value = false }
}
</script>

<template>
  <section aria-label="Документи замовлення">
    <h2>Документи</h2>
    <p>Попереднє замовлення. Не є фіскальним чеком</p>
    <p v-if="!documents?.length">Попередній документ ще не створено.</p>
    <BaseButton v-for="document in documents || []" :key="document.id" variant="outline-dark" :disabled="busy" @click="openDocument(document)">
      {{ document.number }} · версія {{ document.version }} · Перегляд / друк
    </BaseButton>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>
