<script setup lang="ts">
import { discountDigits, discountPercentPath } from '~/utils/product-discount-artwork'
const shopAsset = useShopAsset()

const props = defineProps<{
  percent: string
  locale: 'uk' | 'en'
  label: string
}>()

// Keep Figma's baseline, tracking and percentage contour for every value.
const amountArtwork = computed(() => {
  const digits = Array.from(props.percent).filter(character => character in discountDigits)
  let offset = 0
  const paths = digits.map(character => {
    const glyph = discountDigits[character]!
    const position = offset
    offset += glyph.advance + 0.2
    return { path: glyph.path, position, origin: glyph.origin }
  })
  const referenceAdvance = discountDigits['1']!.advance + discountDigits['5']!.advance + 0.4
  const shift = (referenceAdvance - offset) / 2
  return { paths, origin: 27.9328 + shift, percentOffset: offset - referenceAdvance + shift, scale: Math.min(1, 42 / (offset + 14.0064)) }
})
</script>

<template>
  <svg
    class="product-discount-sticker"
    viewBox="0 0 88 88"
    role="img"
    :aria-label="label"
  >
    <!-- Exported Figma artwork retains the original lettering and side dots. -->
    <image :href="shopAsset(`/discount-sticker-${locale}.svg`)" width="88" height="88" />

    <g class="product-discount-sticker__percent" :transform="`translate(44 45) scale(${amountArtwork.scale}) translate(-44 -45)`">
      <path
        v-for="(glyph, index) in amountArtwork.paths"
        :key="index"
        :d="glyph.path"
        :transform="`translate(${amountArtwork.origin + glyph.position - glyph.origin} 0)`"
      />
      <path :d="discountPercentPath" :transform="`translate(${amountArtwork.percentOffset} 0)`" />
    </g>
  </svg>
</template>

<style scoped>
.product-discount-sticker {
  display: block;
  width: 5.5rem;
  height: 5.5rem;
  flex: 0 0 auto;
}

.product-discount-sticker__percent {
  fill: #e85b28;
}
</style>
