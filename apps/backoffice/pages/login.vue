<script setup lang="ts">
import {
  MoonIcon,
  SunIcon,
} from '@heroicons/vue/24/outline'
import logoScUrl from '@/assets/svg/logo_sc.svg?url'

definePageMeta({ layout: false })

const auth = useAuthStore()
const { isLightTheme, themeToggleLabel, toggleTheme } = useBackofficeTheme()
const form = reactive({ email: '', password: '' })
const error = ref('')
const pending = ref(false)

const submit = async () => {
  error.value = ''
  pending.value = true
  try {
    await auth.login(form.email, form.password)
    await navigateTo('/')
  } catch (cause: unknown) {
    const message =
      typeof cause === 'object' && cause && 'data' in cause && typeof cause.data === 'object' && cause.data && 'detail' in cause.data
        ? String(cause.data.detail)
        : 'Невірні облікові дані'
    error.value = message
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="backoffice-login flex min-h-screen flex-col items-center justify-center px-6">
    <button
      type="button"
      class="theme-toggle-button fixed right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-2xl transition hover:bg-white/15"
      :aria-label="themeToggleLabel"
      :title="themeToggleLabel"
      @click="toggleTheme"
    >
      <MoonIcon v-if="isLightTheme" class="h-5 w-5" aria-hidden="true" />
      <SunIcon v-else class="h-5 w-5" aria-hidden="true" />
    </button>
    <section class="flex w-full max-w-md items-center justify-center">
      <form
        class="liquid-glass w-full space-y-5 rounded-[1.75rem] p-5 shadow-2xl md:p-8"
        @submit.prevent="submit"
      >
        <div class="flex max-w-xl flex-col items-center justify-center space-y-6 text-center text-white">
          <img
            :src="logoScUrl"
            alt="Soul Cuts logo"
            width="120"
            height="120"
            class="h-24 w-24 rounded-2xl border border-white/10 bg-white/90 object-contain p-3"
          >
          <h3 class="text-xl font-semibold text-white md:text-3xl">
            Ласкаво просимо до адмін-панелі Soul Cuts
          </h3>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-white/68">Email</label>
          <input
            v-model="form.email"
            placeholder="Введіть email"
            autocomplete="username"
            class="w-full rounded-2xl border border-white/10 bg-white/[0.065] px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
          >
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-white/68">Пароль</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="Введіть пароль"
            autocomplete="current-password"
            class="w-full rounded-2xl border border-white/10 bg-white/[0.065] px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
          >
        </div>
        <button
          type="submit"
          :disabled="pending"
          class="primary-login-button w-full rounded-full border border-white/12 bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/88 disabled:opacity-60"
        >
          {{ pending ? 'Вхід...' : 'Увійти в backoffice' }}
        </button>
        <p v-if="error" class="rounded-2xl border border-red-300/15 bg-red-400/12 px-4 py-3 text-sm text-red-100">{{ error }}</p>
      </form>
    </section>
  </div>
</template>
