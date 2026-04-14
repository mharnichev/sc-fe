<script setup lang="ts">
import { formatPrice } from '@shared-utils'

const cart = useCartStore()
const domain = useCatalogDomain()

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  shipping_address: '',
  comment: '',
})
const state = reactive({ loading: false, done: false, error: '' })

const submit = async () => {
  if (!cart.items.length) return
  state.loading = true
  state.error = ''
  try {
    await domain.createOrder({
      ...form,
      items: cart.items.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
    })
    state.done = true
    cart.clear()
  }
  catch (error) {
    state.error = 'Checkout failed. Please review the cart and try again.'
    console.error(error)
  }
  finally {
    state.loading = false
  }
}

useSeo('Checkout', 'Complete your order for men’s cosmetics.')
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[1fr_0.85fr]">
    <form class="space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm" @submit.prevent="submit">
      <h1 class="text-3xl font-semibold text-neutral-900">Checkout</h1>
      <div class="grid gap-4 md:grid-cols-2">
        <input v-model="form.first_name" required placeholder="First name" class="rounded-2xl border border-neutral-300 px-4 py-3">
        <input v-model="form.last_name" required placeholder="Last name" class="rounded-2xl border border-neutral-300 px-4 py-3">
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <input v-model="form.email" type="email" required placeholder="Email" class="rounded-2xl border border-neutral-300 px-4 py-3">
        <input v-model="form.phone" placeholder="Phone" class="rounded-2xl border border-neutral-300 px-4 py-3">
      </div>
      <textarea v-model="form.shipping_address" rows="3" required placeholder="Shipping address" class="w-full rounded-2xl border border-neutral-300 px-4 py-3" />
      <textarea v-model="form.comment" rows="3" placeholder="Delivery notes" class="w-full rounded-2xl border border-neutral-300 px-4 py-3" />
      <button type="submit" :disabled="state.loading || !cart.items.length" class="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white disabled:opacity-50">
        {{ state.loading ? 'Processing...' : 'Place order' }}
      </button>
      <p v-if="state.done" class="text-sm text-emerald-700">Order placed successfully.</p>
      <p v-if="state.error" class="text-sm text-rose-700">{{ state.error }}</p>
    </form>

    <aside class="space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 class="text-2xl font-semibold text-neutral-900">Order summary</h2>
      <div v-for="item in cart.items" :key="item.product.id" class="flex items-center justify-between border-b border-neutral-100 py-3 text-sm">
        <span>{{ item.product.name }} × {{ item.quantity }}</span>
        <span>{{ formatPrice(Number(item.product.price) * item.quantity) }}</span>
      </div>
      <div class="flex items-center justify-between pt-2 text-lg font-semibold text-neutral-900">
        <span>Total</span>
        <span>{{ formatPrice(cart.total) }}</span>
      </div>
    </aside>
  </div>
</template>
