<script setup lang="ts">
const open = ref(false)
const locale = ref<'uk' | 'en'>('uk')
const eligible = ref(false)
let displayMode: MediaQueryList | undefined
const update = () => {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = displayMode?.matches || (navigator as Navigator & { standalone?: boolean }).standalone
  eligible.value = ios && !standalone
  if (!eligible.value) open.value = false
}
onMounted(() => {
  displayMode = matchMedia('(display-mode: standalone)')
  displayMode.addEventListener('change', update)
  window.addEventListener('pageshow', update)
  update()
})
onBeforeUnmount(() => {
  displayMode?.removeEventListener('change', update)
  window.removeEventListener('pageshow', update)
})
const copy = computed(() => locale.value === 'uk' ? {
  cta: 'Додати на головний екран', title: 'Soul Cuts на iPhone / iPad', close: 'Закрити',
  intro: 'Відкривайте backoffice з іконки, як застосунок.',
  steps: ['Відкрийте admin.soulcuts.com.ua у Safari.', 'Натисніть «Поширити» (Share). Залежно від вигляду Safari ця дія може бути в меню сторінки.', 'Виберіть «На початковий екран» (Add to Home Screen). Якщо пункту немає, перевірте «Редагувати дії».', 'Увімкніть «Відкрити як вебпрограму» (Open as Web App), якщо цей перемикач доступний, і натисніть «Додати».'],
  note: 'Запускайте з іконки Soul Cuts. Може знадобитися повторний вхід. Для роботи й збереження змін потрібен інтернет.',
} : {
  cta: 'Add to Home Screen', title: 'Soul Cuts on iPhone / iPad', close: 'Close',
  intro: 'Open backoffice from its icon, like an app.',
  steps: ['Open admin.soulcuts.com.ua in Safari.', 'Tap Share. Depending on your Safari layout, you may find it in the page menu.', 'Choose Add to Home Screen. If it is missing, check Edit Actions.', 'Enable Open as Web App if the switch is available, then tap Add.'],
  note: 'Launch from the Soul Cuts icon. You may need to sign in again. An internet connection is required to work and save changes.',
})
</script>

<template>
  <template v-if="eligible">
    <button type="button" class="min-h-11 rounded-xl px-3 text-sm text-[var(--bo-text-secondary)] hover:text-[var(--bo-text-primary)] focus-visible:outline focus-visible:outline-2" @click="open = true">{{ copy.cta }}</button>
    <BaseModal v-model="open" :aria-label="copy.title" max-width-class="max-w-lg">
      <template #head>
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">{{ copy.title }}</h2>
          <button type="button" class="min-h-11 px-2 text-sm" @click="open = false">{{ copy.close }}</button>
        </div>
      </template>
      <template #body>
        <div :lang="locale" class="space-y-5 text-sm leading-relaxed">
          <div class="flex gap-2" aria-label="Language / Мова">
            <button v-for="language in (['uk', 'en'] as const)" :key="language" type="button" :aria-pressed="locale === language" class="min-h-11 rounded-xl px-4" :class="locale === language ? 'bg-[var(--bo-surface-active)] font-semibold' : 'text-[var(--bo-text-secondary)]'" @click="locale = language">{{ language === 'uk' ? 'Українська' : 'English' }}</button>
          </div>
          <p>{{ copy.intro }}</p>
          <ol class="list-decimal space-y-4 pl-5"><li v-for="step in copy.steps" :key="step">{{ step }}</li></ol>
          <p class="text-[var(--bo-text-secondary)]">{{ copy.note }}</p>
        </div>
      </template>
    </BaseModal>
  </template>
</template>
