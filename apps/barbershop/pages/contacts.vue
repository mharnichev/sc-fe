<script setup lang="ts">
const domain = useBarbershopDomain()
const [{ data: masters }, { data: services }] = await Promise.all([
  useAsyncData('booking-masters', domain.getMasters),
  useAsyncData('booking-services', domain.getServices),
])

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  master_id: '',
  service_id: '',
  scheduled_at: '',
  note: '',
})

const state = reactive({ loading: false, success: '', error: '' })

useSeo('Contacts & Booking', 'Contacts, opening hours and appointment request form.')

const submit = async () => {
  state.loading = true
  state.success = ''
  state.error = ''
  try {
    await domain.createBooking({
      ...form,
      master_id: Number(form.master_id),
      service_id: Number(form.service_id),
      scheduled_at: new Date(form.scheduled_at).toISOString(),
    })
    state.success = 'Booking request sent. The team will confirm the slot shortly.'
    Object.assign(form, {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      master_id: '',
      service_id: '',
      scheduled_at: '',
      note: '',
    })
  }
  catch (error) {
    state.error = 'Unable to create the booking request.'
    console.error(error)
  }
  finally {
    state.loading = false
  }
}
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
    <section class="space-y-6">
      <div class="space-y-3">
        <p class="text-sm uppercase tracking-[0.3em] text-amber-700">Contacts</p>
        <h1 class="text-5xl font-semibold text-stone-900">Visit the studio or request a booking.</h1>
      </div>
      <div class="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
        <div class="space-y-4 text-sm leading-7 text-stone-600">
          <p><strong class="text-stone-900">Address:</strong> 214 West Elm Street, Chicago, IL</p>
          <p><strong class="text-stone-900">Phone:</strong> +1 (312) 555-0199</p>
          <p><strong class="text-stone-900">Hours:</strong> Mon-Sat 10:00-20:00</p>
          <p><strong class="text-stone-900">Email:</strong> hello@atelierbarber.local</p>
        </div>
      </div>
    </section>

    <form class="space-y-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm" @submit.prevent="submit">
      <div class="grid gap-4 md:grid-cols-2">
        <input v-model="form.first_name" required placeholder="First name" class="rounded-2xl border border-stone-300 px-4 py-3 outline-none ring-0">
        <input v-model="form.last_name" required placeholder="Last name" class="rounded-2xl border border-stone-300 px-4 py-3 outline-none ring-0">
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <input v-model="form.email" type="email" required placeholder="Email" class="rounded-2xl border border-stone-300 px-4 py-3">
        <input v-model="form.phone" placeholder="Phone" class="rounded-2xl border border-stone-300 px-4 py-3">
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <select v-model="form.master_id" required class="rounded-2xl border border-stone-300 px-4 py-3">
          <option value="">Choose master</option>
          <option v-for="master in masters || []" :key="master.id" :value="master.id">{{ master.name }}</option>
        </select>
        <select v-model="form.service_id" required class="rounded-2xl border border-stone-300 px-4 py-3">
          <option value="">Choose service</option>
          <option v-for="service in services || []" :key="service.id" :value="service.id">{{ service.name }}</option>
        </select>
      </div>
      <input v-model="form.scheduled_at" type="datetime-local" required class="w-full rounded-2xl border border-stone-300 px-4 py-3">
      <textarea v-model="form.note" rows="4" placeholder="Notes" class="w-full rounded-2xl border border-stone-300 px-4 py-3" />
      <button type="submit" :disabled="state.loading" class="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white disabled:opacity-50">
        {{ state.loading ? 'Sending...' : 'Send request' }}
      </button>
      <p v-if="state.success" class="text-sm text-emerald-700">{{ state.success }}</p>
      <p v-if="state.error" class="text-sm text-rose-700">{{ state.error }}</p>
    </form>
  </div>
</template>
