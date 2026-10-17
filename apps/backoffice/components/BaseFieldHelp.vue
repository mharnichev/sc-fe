<script setup lang="ts">
import { QuestionMarkCircleIcon } from '@heroicons/vue/24/outline'
import { useId } from 'vue'

const props = defineProps<{ text: string; label?: string; id?: string }>()
const generatedId = useId()
const tooltipId = computed(() => props.id || `field-help-${generatedId}`)
const trigger = ref<HTMLButtonElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
const visible = ref(false)
const pinned = ref(false)
const position = ref({ left: '16px', top: '16px' })
let closeTimer: ReturnType<typeof setTimeout> | undefined

const keepOpen = () => clearTimeout(closeTimer)
const place = () => {
  const rect = trigger.value?.getBoundingClientRect()
  const popup = tooltip.value
  if (!rect || !popup) return
  const margin = 12
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - popup.offsetWidth - margin))
  const below = rect.bottom + 6
  const top = below + popup.offsetHeight <= window.innerHeight - margin
    ? below
    : Math.max(margin, rect.top - popup.offsetHeight - 6)
  position.value = { left: `${left}px`, top: `${top}px` }
}
const show = async () => {
  keepOpen()
  visible.value = true
  await nextTick()
  place()
}
const close = () => { keepOpen(); visible.value = false; pinned.value = false }
const leave = () => {
  if (!pinned.value) closeTimer = setTimeout(() => {
    if (document.activeElement !== trigger.value) close()
  }, 150)
}
const blur = () => { if (!pinned.value) { keepOpen(); closeTimer = setTimeout(close, 150) } }
const toggle = () => { if (pinned.value) close(); else { void show(); pinned.value = true } }
const outside = (event: PointerEvent) => {
  if (!trigger.value?.contains(event.target as Node) && !tooltip.value?.contains(event.target as Node)) close()
}
const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && visible.value) close() }
const onScroll = (event: Event) => {
  if (tooltip.value?.contains(event.target as Node)) return
  if (pinned.value) place()
  else close()
}
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', onScroll, true)
  keepOpen()
})
</script>

<template>
  <button ref="trigger" type="button" class="field-help-trigger text-ui-muted"
    :aria-label="label ? `Пояснення: ${label}` : 'Пояснення'" :aria-expanded="visible"
    :aria-controls="visible ? tooltipId : undefined" :aria-describedby="visible ? tooltipId : undefined"
    @mouseenter="show" @mouseleave="leave" @focus="show" @blur="blur" @click.stop.prevent="toggle">
    <QuestionMarkCircleIcon class="h-4 w-4" aria-hidden="true" />
  </button>
  <Teleport to="body">
    <span v-if="visible" :id="tooltipId" ref="tooltip" role="tooltip" class="field-help-tooltip"
      :style="position" @mouseenter="keepOpen" @mouseleave="leave">{{ text }}</span>
  </Teleport>
</template>

<style scoped>
.field-help-trigger { display: inline-flex; flex-shrink: 0; width: 44px; height: 44px; margin-block: -6px; padding: 0; align-items: center; justify-content: center; border-radius: 8px; background: transparent; border: 0; cursor: help; }
.field-help-trigger:focus-visible { outline: 2px solid var(--bo-focus-border); outline-offset: 2px; }
.field-help-tooltip { position: fixed; z-index: 50040; width: min(352px, calc(100vw - 24px)); max-height: min(240px, calc(100dvh - 24px)); overflow-y: auto; padding: 12px; border: 1px solid var(--bo-help-border); border-radius: 8px; background: var(--bo-help-surface); color: var(--bo-help-text); box-shadow: 0 12px 28px var(--bo-help-shadow); font-size: 12px; line-height: 1.5; }
</style>

