<script setup lang="ts">
const { terms } = useTerms()
const domain = useBarbershopDomain()
const localizedService = useLocalizedService()
const { data: services } = await useAsyncData('service-catalog', domain.getServiceCatalog)
const activeServices = computed(() => activeBaseCatalogItems(services.value))
const structuredServices = computed(() =>
  activeServices.value.map(service => ({
    name: localizedService.serviceName(service),
    description: localizedService.serviceDescription(service),
    price: service.price,
    durationMinutes: service.duration_minutes,
  })),
)

useSeo(
  () => terms.value.seo.servicesTitle,
  () => terms.value.seo.servicesDescription,
)
useServiceCatalogStructuredData(structuredServices)
</script>

<template>
  <ServicesGrid />
</template>
