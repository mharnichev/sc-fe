<script setup lang="ts">
import FeedbackState from '~/components/ui/FeedbackState.vue'

const { terms } = useShopLocale()

useSeo(
  () => terms.value.cabinet.purchaseHistory,
  () => terms.value.cabinet.purchaseHistoryDescription,
)
</script>

<template>
  <CabinetShell>
    <FeedbackState
      class="cabinet-empty"
      face="sad-droopy-face"
      :title="terms.cabinet.stillEmpty"
      :description="terms.cabinet.purchaseHistoryEmpty"
    >
      <BaseButton to="/catalog">
        {{ terms.cabinet.toGoods }}
      </BaseButton>
    </FeedbackState>
  </CabinetShell>
</template>

<style scoped>
.cabinet-empty {
  display: grid;
  min-height: 28rem;
  align-content: center;
  justify-items: center;
  gap: 1rem;
  text-align: center;
}

</style>
