<script setup lang="ts">
import logoScUrl from '@/assets/svg/logo_sc.svg?url'

definePageMeta({layout: false})

const auth = useAuthStore()
const form = reactive({email: '', password: ''})
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
            : 'Invalid credentials'
    error.value = message
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div
      class="flex flex-col justify-center items-center min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),_transparent_28%),linear-gradient(180deg,_#020617,_#0f172a)] px-6 ">
    <section class="flex items-center justify-center w-full max-w-md">
      <form class="w-full space-y-5 rounded-2xl md:rounded-5xl border border-white/10 bg-white/95 p-4 md:p-8 shadow-2xl backdrop-blur"
            @submit.prevent="submit">
        <div class="max-w-xl space-y-6 text-white flex flex-col items-center justify-center text-center">
          <img :src="logoScUrl" alt="Soul Cuts logo" width="120" height="120"
               class="h-26 w-26 object-contain p-3 rounded-xl bg-white"/>
          <h3 class="text-xl md:text-3xl font-semibold text-slate-700">
            Welcome to Soul Cuts admin panel
          </h3>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700">Email</label>
          <input v-model="form.email" placeholder="Enter your email" autocomplete="username"
                 class="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500">
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700">Password</label>
          <input v-model="form.password" type="password" placeholder="Enter password" autocomplete="current-password"
                 class="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-500">
        </div>
        <button type="submit" :disabled="pending"
                class="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60">
          {{ pending ? 'Signing in...' : 'Enter backoffice' }}
        </button>
        <p v-if="error" class="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ error }}</p>
      </form>
    </section>
  </div>
</template>
