<script setup lang="ts">
import { QuestionMarkCircleIcon } from '@heroicons/vue/24/outline'
import { useId } from 'vue'
import { campaignFieldExplanations } from '~/utils/campaignFieldHelp'

const props = defineProps<{ label: string; help?: string }>()
const description = computed(() => props.help || campaignFieldExplanations[props.label])
const id = `campaign-field-help-${useId()}`
const trigger = ref<HTMLElement | null>(null)
const tooltip = ref<HTMLElement | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | undefined
const visible = ref(false)
const pinned = ref(false)
const position = ref({ left: '16px', top: '16px' })
const show = () => {
  clearTimeout(closeTimer)
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const width = Math.min(352, window.innerWidth - 32)
  position.value = { left: `${Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))}px`, top: `${Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - Math.min(240, window.innerHeight * 0.4) - 16))}px` }
  visible.value = true
}
const close = () => { clearTimeout(closeTimer); visible.value = false; pinned.value = false }
const leave = () => { if (!pinned.value) closeTimer = setTimeout(close, 150) }
const keepOpen = () => clearTimeout(closeTimer)
const toggle = () => { if (pinned.value) close(); else { show(); pinned.value = true } }
const outside = (event: PointerEvent) => { if (!trigger.value?.contains(event.target as Node) && !tooltip.value?.contains(event.target as Node)) close() }
const onScroll = (event: Event) => {
  if (tooltip.value?.contains(event.target as Node)) return
  if (pinned.value) show()
  else close()
}
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', onScroll, true)
  clearTimeout(closeTimer)
})
</script>

<template>
  <span role="group" :aria-label="label" class="inline-flex min-w-0 items-center gap-1.5">
    <span>{{ label }}</span>
    <span v-if="description" ref="trigger" class="inline-flex shrink-0"><BaseButton type="button" variant="unstyled" class="campaign-help-trigger text-ui-muted" :aria-label="`Пояснення: ${label}`" :aria-expanded="visible" :aria-describedby="visible ? id : undefined" @mouseenter="show" @mouseleave="leave" @focus="show" @blur="leave" @click.stop.prevent="toggle" @keydown.esc.stop.prevent="close">
      <QuestionMarkCircleIcon class="h-4 w-4" aria-hidden="true" />
    </BaseButton></span>
    <Teleport to="body">
      <span v-if="visible" :id="id" ref="tooltip" role="tooltip" class="campaign-field-tooltip" :style="position" @mouseenter="keepOpen" @mouseleave="leave">{{ description }}</span>
    </Teleport>
  </span>
</template>

<style scoped>
.campaign-help-trigger { display: inline-flex; flex-shrink: 0; width: 28px !important; min-width: 28px; height: 28px; min-height: 28px !important; padding: 0 !important; align-items: center; justify-content: center; border-radius: 4px; }
.campaign-help-trigger:focus-visible { outline: 2px solid var(--bo-focus-border); outline-offset: 2px; }
.campaign-field-tooltip { position: fixed; z-index: 50040; width: min(352px, calc(100vw - 32px)); max-height: min(240px, 40dvh); overflow-y: auto; padding: 12px; border: 1px solid var(--bo-help-border); border-radius: 8px; background: var(--bo-help-surface); color: var(--bo-help-text); box-shadow: 0 12px 28px var(--bo-help-shadow); font-size: 12px; line-height: 1.5; }
@media (max-width: 640px) { .campaign-field-tooltip { top: 50% !important; transform: translateY(-50%); } }
</style>
