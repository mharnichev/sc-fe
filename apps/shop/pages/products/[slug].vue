<script setup lang="ts">
import { formatPrice } from '@shared-utils'

const route = useRoute()
const domain = useCatalogDomain()
const cart = useCartStore()
const favorites = useFavoritesStore()

const { data: product } = await useAsyncData(`product-${route.params.slug}`, () => domain.getProduct(String(route.params.slug)))

const reviews = ref([
  { author: 'Marcus', text: 'Balanced texture and no heavy residue.', rating: 5 },
  { author: 'Evan', text: 'Good daily product for short styles.', rating: 4 },
])
const reviewForm = reactive({ author: '', text: '', rating: 5 })

const submitReview = () => {
  if (!reviewForm.author || !reviewForm.text) return
  reviews.value.unshift({ ...reviewForm })
  reviewForm.author = ''
  reviewForm.text = ''
  reviewForm.rating = 5
}

useSeo(
  product.value?.seo_title || product.value?.name || 'Product',
  product.value?.seo_description || product.value?.short_description || product.value?.description || 'Product detail',
)

useHead(() => ({
  script: product.value ? [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.value.name,
        description: product.value.description,
        sku: product.value.sku,
        image: product.value.images.map(image => image.image),
        brand: { '@type': 'Brand', name: product.value.brand.name },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: product.value.price,
          availability: product.value.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
      }),
    },
  ] : [],
}))
</script>

<template>
  <div v-if="product" class="space-y-12">
    <nav class="text-sm text-neutral-500">
      <NuxtLink to="/catalog">Catalog</NuxtLink> / {{ product.category.name }} / {{ product.name }}
    </nav>
    <section class="grid gap-10 lg:grid-cols-2">
      <img :src="product.images[0]?.image || 'https://placehold.co/1000x1000'" :alt="product.name" class="h-[34rem] w-full rounded-[2.5rem] object-cover shadow-xl">
      <div class="space-y-5">
        <p class="text-sm uppercase tracking-[0.3em] text-emerald-700">{{ product.brand.name }}</p>
        <h1 class="text-5xl font-semibold text-neutral-900">{{ product.name }}</h1>
        <p class="text-lg leading-8 text-neutral-600">{{ product.description }}</p>
        <div class="flex items-end gap-4">
          <span class="text-3xl font-semibold text-neutral-900">{{ formatPrice(product.price) }}</span>
          <span v-if="product.compare_at_price" class="text-lg text-neutral-400 line-through">{{ formatPrice(product.compare_at_price) }}</span>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white" @click="cart.add(product)">
            Add to cart
          </button>
          <button class="rounded-full border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-700" @click="favorites.toggle(product.id)">
            {{ favorites.items.includes(product.id) ? 'Remove favorite' : 'Save favorite' }}
          </button>
        </div>
      </div>
    </section>

    <section class="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
      <div class="space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 class="text-2xl font-semibold text-neutral-900">Reviews</h2>
        <article v-for="review in reviews" :key="`${review.author}-${review.text}`" class="rounded-2xl bg-neutral-50 p-4">
          <div class="flex items-center justify-between">
            <p class="font-medium text-neutral-900">{{ review.author }}</p>
            <p class="text-sm text-neutral-500">{{ review.rating }}/5</p>
          </div>
          <p class="mt-2 text-sm leading-7 text-neutral-600">{{ review.text }}</p>
        </article>
      </div>
      <form class="space-y-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm" @submit.prevent="submitReview">
        <h2 class="text-2xl font-semibold text-neutral-900">Leave a review</h2>
        <input v-model="reviewForm.author" placeholder="Your name" class="w-full rounded-2xl border border-neutral-300 px-4 py-3">
        <textarea v-model="reviewForm.text" rows="5" placeholder="What worked well?" class="w-full rounded-2xl border border-neutral-300 px-4 py-3" />
        <select v-model="reviewForm.rating" class="w-full rounded-2xl border border-neutral-300 px-4 py-3">
          <option :value="5">5</option>
          <option :value="4">4</option>
          <option :value="3">3</option>
          <option :value="2">2</option>
          <option :value="1">1</option>
        </select>
        <button type="submit" class="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white">Submit</button>
      </form>
    </section>
  </div>
</template>
