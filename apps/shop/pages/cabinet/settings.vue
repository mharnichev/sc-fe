<script setup lang="ts">
const auth = useCustomerAuthStore()
const { terms } = useShopLocale()

const form = reactive({
  name: auth.customer?.name || '',
  surname: auth.customer?.surname || '',
  email: auth.customer?.email || '',
  phone: auth.customer?.phone || '',
  birthday: auth.customer?.birthday || '',
})
const state = reactive({ loading: false, done: false, error: '' })

watch(() => auth.customer, customer => {
  if (!customer) return
  form.name = customer.name || ''
  form.surname = customer.surname || ''
  form.email = customer.email || ''
  form.phone = customer.phone || ''
  form.birthday = customer.birthday || ''
}, { immediate: true })

const hasChanges = computed(() => {
  const customer = auth.customer
  if (!customer) return false

  return (
    form.name !== (customer.name || '')
    || form.surname !== (customer.surname || '')
    || form.email !== (customer.email || '')
    || form.phone !== (customer.phone || '')
    || form.birthday !== (customer.birthday || '')
  )
})

const submit = async () => {
  state.loading = true
  state.done = false
  state.error = ''
  try {
    await auth.updateProfile({ ...form })
    state.done = true
  }
  catch (error) {
    state.error = terms.value.cabinet.saveError
    console.error(error)
  }
  finally {
    state.loading = false
  }
}

useSeo(
  () => terms.value.cabinet.settings,
  () => terms.value.cabinet.settingsDescription,
)
</script>

<template>
  <CabinetShell>
    <form class="cabinet-settings" @submit.prevent="submit">
      <section class="cabinet-settings__row">
        <div class="cabinet-settings__copy">
          <h2>{{ terms.cabinet.personalData }}</h2>
          <p>{{ terms.cabinet.personalDataText }}</p>
        </div>
        <div class="cabinet-settings__fields cabinet-settings__fields--two">
          <BaseInput v-model="form.name" :label="terms.checkout.firstName" autocomplete="given-name" />
          <BaseInput v-model="form.surname" :label="terms.checkout.lastName" autocomplete="family-name" />
        </div>
      </section>

      <section class="cabinet-settings__row">
        <div class="cabinet-settings__copy">
          <h2>{{ terms.cabinet.contactInfo }}</h2>
          <p>{{ terms.cabinet.contactInfoText }}</p>
        </div>
        <div class="cabinet-settings__fields cabinet-settings__fields--two">
          <BaseInput
            v-model="form.phone"
            type="tel"
            :label="terms.checkout.phone"
            autocomplete="tel"
            inputmode="tel"
          />
          <BaseInput v-model="form.email" type="email" :label="terms.checkout.email" autocomplete="email" />
        </div>
      </section>

      <section class="cabinet-settings__row">
        <div class="cabinet-settings__copy">
          <h2>{{ terms.cabinet.birthDate }}</h2>
          <p>{{ terms.cabinet.birthDateText }}</p>
        </div>
        <BaseInput v-model="form.birthday" type="date" :label="terms.cabinet.birthDate" />
      </section>

      <div class="cabinet-settings__actions">
        <BaseButton type="submit" :disabled="!hasChanges || state.loading">
          {{ state.loading ? terms.checkout.processing : terms.cabinet.saveProfile }}
        </BaseButton>
        <p v-if="state.done" class="cabinet-settings__success">{{ terms.cabinet.saved }}</p>
        <p v-if="state.error" class="cabinet-settings__error">{{ state.error }}</p>
      </div>
    </form>
  </CabinetShell>
</template>

<style scoped>
.cabinet-settings {
  display: grid;
  gap: 1.5rem;
}

.cabinet-settings__row {
  display: grid;
  gap: 1rem;
  padding-bottom: 1.5rem;
}

.cabinet-settings :deep(.base-control),
.cabinet-settings :deep(.base-control:focus),
.cabinet-settings :deep(.base-control:focus-visible) {
  border: 0;
}

.cabinet-settings__copy {
  display: grid;
  gap: 0.45rem;
}

.cabinet-settings__copy h2 {
  font-size: 1.1rem;
  font-weight: 800;
}

.cabinet-settings__copy p {
  color: #737373;
  font-size: 0.85rem;
  line-height: 1.6;
}

.cabinet-settings__fields {
  display: grid;
  gap: 1rem;
}

.cabinet-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.cabinet-settings__success {
  color: #047857;
  font-size: 0.9rem;
  font-weight: 700;
}

.cabinet-settings__error {
  color: #be123c;
  font-size: 0.9rem;
  font-weight: 700;
}

@media (min-width: 768px) {
  .cabinet-settings__fields--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
