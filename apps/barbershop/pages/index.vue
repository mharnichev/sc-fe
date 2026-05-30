<script setup lang="ts">
import bookingSectionPhotos from '~/assets/images/main/sc-open-img.webp'

const { terms } = useTerms()

useSeo(
  () => terms.value.seo.homeTitle,
  () => terms.value.seo.homeDescription,
)
</script>

<template>
  <div>
    <HeroSection />
    <IntroSection />
    <ServicesGrid />
    <BookingSection />
    <section data-header-theme="dark" class="bg-neutral-950 px-4 pb-12 min-[560px]:hidden">
      <img
        :src="bookingSectionPhotos"
        alt="photo booking"
        class="mx-auto w-full max-w-md object-contain"
        loading="lazy"
      >
    </section>
    <BotSection />
    <!--    <AboutSection />-->
    <!--    <ImageBreak />-->
    <TeamSection />
    <!--    <EditorialSection />-->
    <ReviewsSection />
    <FAQSection />
    <FeedbackSection />
    <IdemNaBukviMarquee />
  </div>
</template>
