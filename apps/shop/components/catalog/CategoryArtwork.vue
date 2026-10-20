<script setup lang="ts">
import { categoryArtwork } from '~/utils/category-artwork'

const props = defineProps<{ slug: string }>()
const shopAsset = useShopAsset()
const artwork = computed(() => categoryArtwork(props.slug))
</script>

<template>
  <span class="category-artwork" aria-hidden="true">
    <img
      v-if="artwork"
      :src="shopAsset(artwork.src)"
      alt=""
      :width="artwork.width"
      :height="artwork.height"
      loading="lazy"
      decoding="async"
    >
    <BaseIcon v-else name="catalog" size="lg" />
  </span>
</template>

<style scoped>
.category-artwork {
  display: grid;
  aspect-ratio: 1;
  place-items: center;
  min-width: 0;
}
.category-artwork img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
