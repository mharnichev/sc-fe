<script setup lang="ts">
const shopAsset = useShopAsset()
const props = defineProps<{
  percent: string
  locale: 'uk' | 'en'
  label: string
}>()

const stickerWord = computed(() => props.locale === 'en' ? 'sale' : 'знижка')
const isFigmaDiscount = computed(() => props.percent === '15')
const isOriginalUkrainianSticker = computed(() => props.locale === 'uk' && isFigmaDiscount.value)
const englishSaleTopPathId = useId()
const englishSaleBottomPathId = useId()

</script>

<template>
  <img
    v-if="isOriginalUkrainianSticker"
    class="product-discount-sticker"
    :src="shopAsset('/discount-sticker-uk.svg')"
    :alt="label"
  >
  <svg
    v-else
    class="product-discount-sticker"
    viewBox="0 0 88 88"
    role="img"
    :aria-label="label"
  >
    <defs>
      <path :id="englishSaleTopPathId" d="M26 37Q44 23 62 37" />
      <path :id="englishSaleBottomPathId" d="M26 57Q44 73 62 57" />
    </defs>
    <path
      class="product-discount-sticker__shape"
      d="M42.0114 12.6936C42.3668 10.4252 45.6332 10.4252 45.9886 12.6936C46.9344 18.7313 54.5931 20.7834 58.431 16.0276C59.873 14.2408 62.7018 15.874 61.8753 18.0162C59.6757 23.7178 65.2822 29.3243 70.9838 27.1247C73.126 26.2982 74.7592 29.127 72.9724 30.569C68.2166 34.4069 70.2687 42.0656 76.3064 43.0114C78.5748 43.3668 78.5748 46.6332 76.3064 46.9886C70.2687 47.9344 68.2166 55.5931 72.9724 59.431C74.7592 60.873 73.126 63.7018 70.9838 62.8753C65.2822 60.6757 59.6757 66.2822 61.8753 71.9838C62.7018 74.126 59.873 75.7592 58.431 73.9724C54.5931 69.2166 46.9344 71.2687 45.9886 77.3064C45.6332 79.5748 42.3668 79.5748 42.0114 77.3064C41.0656 71.2687 33.4069 69.2166 29.569 73.9724C28.127 75.7592 25.2982 74.126 26.1247 71.9838C28.3243 66.2822 22.7178 60.6757 17.0162 62.8753C14.874 63.7018 13.2408 60.873 15.0276 59.431C19.7834 55.5931 17.7313 47.9344 11.6936 46.9886C9.42523 46.6332 9.42522 43.3668 11.6936 43.0114C17.7313 42.0656 19.7834 34.4069 15.0276 30.569C13.2408 29.127 14.874 26.2982 17.0162 27.1247C22.7178 29.3243 28.3243 23.7178 26.1247 18.0162C25.2982 15.874 28.127 14.2408 29.569 16.0276C33.4069 20.7834 41.0656 18.7313 42.0114 12.6936Z"
    />
    <template v-if="locale === 'en'">
      <text class="product-discount-sticker__english-word">
        <textPath :href="`#${englishSaleTopPathId}`" startOffset="50%" text-anchor="middle">
          SALE
        </textPath>
      </text>
    </template>
    <text v-else class="product-discount-sticker__word product-discount-sticker__word--top" x="44" y="31">
      {{ stickerWord }}
    </text>
    <circle class="product-discount-sticker__dot" cx="20" cy="44" r="1" />
    <circle class="product-discount-sticker__dot" cx="68" cy="44" r="1" />
    <path
      v-if="locale === 'en' && isFigmaDiscount"
      class="product-discount-sticker__percent-path"
      d="M33.4368 51H30.6688V42.696C30.2848 43.064 29.3408 43.432 28.3008 43.464V41.256C30.0768 41.128 30.8128 40.456 31.0048 39.32H33.4368V51ZM40.9841 43.016C43.8641 43.016 45.3361 44.488 45.3361 47.016C45.3361 49.624 43.7201 51.208 40.2641 51.208C36.7601 51.208 35.2401 49.656 35.1441 47.048H37.9761C38.1041 48.104 38.8081 48.872 40.2321 48.872C41.7041 48.872 42.5041 48.088 42.5041 46.776C42.5041 45.464 41.7041 44.68 40.2641 44.68C38.9681 44.68 38.3601 45.304 38.1521 45.768L35.5441 45.4L36.3121 39.32H44.6641V41.656H38.6641L38.3921 43.656C38.9841 43.256 39.8321 43.016 40.9841 43.016ZM49.2192 39.416C50.0832 39.416 50.7339 39.7307 51.1712 40.36C51.6192 40.9787 51.8432 41.8533 51.8432 42.984C51.8432 44.1147 51.6299 45 51.2032 45.64C50.7872 46.2693 50.1259 46.584 49.2192 46.584C48.6752 46.584 48.2112 46.44 47.8272 46.152C47.4432 45.864 47.1552 45.4533 46.9632 44.92C46.7712 44.376 46.6752 43.7307 46.6752 42.984C46.6752 41.8533 46.8779 40.9787 47.2832 40.36C47.6885 39.7307 48.3339 39.416 49.2192 39.416ZM49.2352 40.808C48.9259 40.808 48.6965 40.9893 48.5472 41.352C48.4085 41.7147 48.3392 42.2587 48.3392 42.984C48.3392 43.72 48.4085 44.2747 48.5472 44.648C48.6965 45.0107 48.9259 45.192 49.2352 45.192C49.5552 45.192 49.7899 45.0107 49.9392 44.648C50.0885 44.2747 50.1632 43.7253 50.1632 43C50.1632 42.264 50.0885 41.7147 49.9392 41.352C49.7899 40.9893 49.5552 40.808 49.2352 40.808ZM57.0432 39.576L50.7072 51H49.0752L55.4112 39.576H57.0432ZM56.8512 43.976C57.4165 43.976 57.8912 44.12 58.2752 44.408C58.6592 44.6853 58.9525 45.0907 59.1552 45.624C59.3579 46.1467 59.4592 46.7867 59.4592 47.544C59.4592 48.6747 59.2459 49.56 58.8192 50.2C58.4032 50.8293 57.7419 51.144 56.8352 51.144C56.2912 51.144 55.8272 51 55.4432 50.712C55.0592 50.424 54.7712 50.0133 54.5792 49.48C54.3872 48.936 54.2912 48.2907 54.2912 47.544C54.2912 46.4133 54.4939 45.5387 54.8992 44.92C55.3152 44.2907 55.9659 43.976 56.8512 43.976ZM56.8512 45.384C56.5419 45.384 56.3125 45.5653 56.1632 45.928C56.0245 46.28 55.9552 46.824 55.9552 47.56C55.9552 48.296 56.0245 48.8507 56.1632 49.224C56.3125 49.5867 56.5419 49.768 56.8512 49.768C57.1712 49.768 57.4059 49.5867 57.5552 49.224C57.7152 48.8613 57.7952 48.3067 57.7952 47.56C57.7952 46.824 57.7152 46.28 57.5552 45.928C57.4059 45.5653 57.1712 45.384 56.8512 45.384Z"
    />
    <text v-else class="product-discount-sticker__percent" x="44" y="51">
      {{ percent }}%
    </text>
    <template v-if="locale === 'en'">
      <text class="product-discount-sticker__english-word">
        <textPath :href="`#${englishSaleBottomPathId}`" startOffset="50%" text-anchor="middle">
          SALE
        </textPath>
      </text>
    </template>
    <text v-else class="product-discount-sticker__word product-discount-sticker__word--bottom" x="44" y="62">
      {{ stickerWord }}
    </text>
  </svg>
</template>

<style scoped>
.product-discount-sticker {
  display: block;
  width: 5.5rem;
  height: 5.5rem;
  flex: 0 0 auto;
  filter: drop-shadow(0 0.125rem 0.25rem rgb(10 10 10 / 0.1));
}

.product-discount-sticker__shape {
  fill: #ffffff;
}

.product-discount-sticker__word {
  fill: #6d6b6b;
  font-family: "Cy Grotesk", sans-serif;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.85px;
  text-anchor: middle;
}

.product-discount-sticker__word--top {
  transform: rotate(-10deg);
  transform-origin: center;
}

.product-discount-sticker__word--bottom {
  transform: rotate(10deg);
  transform-origin: center;
}

.product-discount-sticker__english-word {
  fill: #6d6b6b;
  font-family: "Cy Grotesk", sans-serif;
  font-size: 8.5px;
  font-weight: 400;
  letter-spacing: 0.41px;
  text-anchor: middle;
}

.product-discount-sticker__dot {
  fill: #6d6b6b;
}

.product-discount-sticker__percent {
  fill: #f64551;
  font-family: "Cy Grotesk", sans-serif;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -1px;
  text-anchor: middle;
}

.product-discount-sticker__percent-path {
  fill: #f64551;
}
</style>
