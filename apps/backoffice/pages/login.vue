<script setup lang="ts">
import {
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/vue/24/outline'
import logoScUrl from '@/assets/svg/logo_sc.svg?url'

definePageMeta({ layout: false })

const auth = useAuthStore()
const route = useRoute()
const { isLightTheme, themeToggleLabel, toggleTheme } = useBackofficeTheme()
const toast = useBaseToastNotification()
const form = reactive({ email: '', password: '' })
const pending = ref(false)
const passwordVisible = ref(false)
const loginRedirectPath = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
})

const submit = async () => {
  pending.value = true
  try {
    await auth.login(form.email, form.password)
    await navigateTo(loginRedirectPath.value)
  } catch (cause: unknown) {
    const message =
      typeof cause === 'object' && cause && 'data' in cause && typeof cause.data === 'object' && cause.data && 'detail' in cause.data
        ? String(cause.data.detail)
        : (navigator.onLine ? 'Не вдалося увійти. Перевірте дані та з’єднання.' : 'Немає з’єднання. Підключіться до інтернету й спробуйте ще раз.')
    toast.error(message)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="backoffice-login flex min-h-screen flex-col items-center justify-center px-6">
    <BaseButton
      type="button"
      class="theme-toggle-button fixed right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-2xl transition hover:bg-white/15"
      :aria-label="themeToggleLabel"
      :title="themeToggleLabel"
      @click="toggleTheme"
    >
      <MoonIcon v-if="isLightTheme" class="h-5 w-5" aria-hidden="true" />
      <SunIcon v-else class="h-5 w-5" aria-hidden="true" />
    </BaseButton>
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
          <label for="login-email" class="text-sm font-medium text-white/68">Email</label>
          <div class="relative">
            <EnvelopeIcon class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" aria-hidden="true" />
            <BaseInput
              id="login-email"
              v-model="form.email"
              placeholder="Введіть email"
              autocomplete="username"
              input-class="base-control pl-12 pr-4 py-3 text-sm"
              class="w-full rounded-2xl border border-white/10 bg-white/[0.065] text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
            />
          </div>
        </div>
        <div class="space-y-2">
          <label for="login-password" class="text-sm font-medium text-white/68">Пароль</label>
          <div class="relative">
            <LockClosedIcon class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" aria-hidden="true" />
            <BaseInput
              id="login-password"
              v-model="form.password"
              :type="passwordVisible ? 'text' : 'password'"
              placeholder="Введіть пароль"
              autocomplete="current-password"
              input-class="base-control pl-12 pr-12 py-3 text-sm"
              class="w-full rounded-2xl border border-white/10 bg-white/[0.065] text-white outline-none transition placeholder:text-white/35 focus:border-white/30"
            />
            <BaseButton
              type="button"
              class="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-2xl text-white/50 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              :aria-label="passwordVisible ? 'Приховати пароль' : 'Показати пароль'"
              :title="passwordVisible ? 'Приховати пароль' : 'Показати пароль'"
              aria-controls="login-password"
              @click="passwordVisible = !passwordVisible"
            >
              <EyeSlashIcon v-if="passwordVisible" class="h-5 w-5" aria-hidden="true" />
              <EyeIcon v-else class="h-5 w-5" aria-hidden="true" />
            </BaseButton>
          </div>
        </div>
        <BaseButton
          type="submit"
          :disabled="pending"
          class="primary-login-button w-full rounded-full border border-white/12 bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/88 disabled:opacity-60"
        >
          {{ pending ? 'Вхід...' : 'Увійти в backoffice' }}
        </BaseButton>
      <div class="flex justify-center"><AppInstallHelp /></div>
      </form>
    </section>
  </div>
</template>
