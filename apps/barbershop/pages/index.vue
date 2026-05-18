<script setup lang="ts">
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
    <BotSection />
    <!--    <AboutSection />-->
    <!--    <ImageBreak />-->
    <TeamSection />
    <!--    <EditorialSection />-->
    <ReviewsSection />
    <FAQSection />
    <FeedbackSection />
    <IdemNaBukviMarquee />
    <CTASection />
  </div>
</template>
