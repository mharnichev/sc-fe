<template>
  <article class="product-card-skeleton" aria-hidden="true">
    <div class="product-card-skeleton__media" />
    <div class="product-card-skeleton__body">
      <span class="product-card-skeleton__line product-card-skeleton__line--short" />
      <span class="product-card-skeleton__line product-card-skeleton__line--title" />
      <span class="product-card-skeleton__line" />
      <span class="product-card-skeleton__line product-card-skeleton__line--price" />
    </div>
  </article>
</template>

<style scoped>
.product-card-skeleton {
  display: flex;
  height: 100%;
  min-height: 25rem;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.product-card-skeleton__media,
.product-card-skeleton__line {
  position: relative;
  overflow: hidden;
  background: #eeeeea;
}

.product-card-skeleton__media::after,
.product-card-skeleton__line::after {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.65), transparent);
  animation: skeleton-shimmer 1.2s infinite;
}

.product-card-skeleton__media {
  height: 16rem;
}

.product-card-skeleton__body {
  display: grid;
  gap: 0.9rem;
  padding: 1.25rem;
}

.product-card-skeleton__line {
  height: 0.85rem;
}

.product-card-skeleton__line--short {
  width: 52%;
}

.product-card-skeleton__line--title {
  height: 1.35rem;
  width: 84%;
}

.product-card-skeleton__line--price {
  margin-top: 1.5rem;
  width: 36%;
}

@keyframes skeleton-shimmer {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(100%);
  }
}
</style>
