<script setup lang="ts">
import type { MasterDto } from '@shared-types'

const { terms } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const { data: masters, pending: mastersPending } = await useAsyncData('home-team-masters', domain.getMasters)

const activeMemberIndex = ref(0)
const teamSection = ref<HTMLElement | null>(null)
const mobileSlider = ref<HTMLElement | null>(null)
const isMobile = ref(false)
let mobileMediaQuery: MediaQueryList | null = null
let mobileMediaHandler: (() => void) | null = null

const teamImages = [
  'https://images.unsplash.com/photo-1599351431613-18ef1fdd27e1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1588771930296-88c2cb03f386?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1618077360395-f3068be8e001?auto=format&fit=crop&w=900&q=80',
]

const masterName = (master: MasterDto) =>
  master.full_name || master.name || `Master #${master.id}`

const masterPhoto = (master: MasterDto) =>
  assetUrl(master.photo_url || master.photo) || teamImages[0]

const isMasterActive = (master: MasterDto) =>
  master.is_active ?? master.status !== 'inactive'

const teamMembers = computed(() =>
  (masters.value || [])
    .filter(isMasterActive)
    .map(master => ({
      id: master.id,
      name: masterName(master),
      role: master.title || terms.value.home.team.defaultRole,
      description: master.bio || master.description || terms.value.home.team.noDescription,
      image: masterPhoto(master),
      imageAlt: masterName(master),
    })),
)

const activeMember = computed(() => teamMembers.value[activeMemberIndex.value] || teamMembers.value[0] || null)
const activeImage = computed(() => activeMember.value?.image || teamImages[0])
const hasMultipleTeamMembers = computed(() => teamMembers.value.length > 1)
const teamScrollHeight = computed(() => isMobile.value ? '100svh' : `${Math.max(teamMembers.value.length, 1) * 100}vh`)

const updateActiveMemberFromScroll = () => {
  if (isMobile.value || !teamSection.value || teamMembers.value.length < 2) return

  const rect = teamSection.value.getBoundingClientRect()
  const scrollableDistance = rect.height - window.innerHeight

  if (scrollableDistance <= 0) {
    activeMemberIndex.value = 0
    return
  }

  const progress = Math.min(1, Math.max(0, -rect.top / scrollableDistance))
  activeMemberIndex.value = Math.min(
    teamMembers.value.length - 1,
    Math.floor(progress * teamMembers.value.length),
  )
}

const updateActiveMemberFromSlider = () => {
  if (!mobileSlider.value || !isMobile.value || teamMembers.value.length < 2) return

  const slideWidth = mobileSlider.value.clientWidth
  if (!slideWidth) return

  activeMemberIndex.value = Math.min(
    teamMembers.value.length - 1,
    Math.round(mobileSlider.value.scrollLeft / slideWidth),
  )
}

const selectMember = (index: number) => {
  activeMemberIndex.value = index

  if (!import.meta.client || teamMembers.value.length < 2) return

  if (isMobile.value && mobileSlider.value) {
    mobileSlider.value.scrollTo({
      left: mobileSlider.value.clientWidth * index,
      behavior: 'smooth',
    })
    return
  }

  if (!teamSection.value) return

  const sectionTop = teamSection.value.getBoundingClientRect().top + window.scrollY
  const step = window.innerHeight

  window.scrollTo({
    top: sectionTop + (step * index),
    behavior: 'smooth',
  })
}

onMounted(() => {
  mobileMediaQuery = window.matchMedia('(max-width: 767px)')
  mobileMediaHandler = () => {
    isMobile.value = Boolean(mobileMediaQuery?.matches)
    if (isMobile.value) {
      nextTick(updateActiveMemberFromSlider)
    } else {
      nextTick(updateActiveMemberFromScroll)
    }
  }

  mobileMediaHandler()
  mobileMediaQuery.addEventListener('change', mobileMediaHandler)
  updateActiveMemberFromScroll()
  window.addEventListener('scroll', updateActiveMemberFromScroll, { passive: true })
  window.addEventListener('resize', updateActiveMemberFromScroll)
})

onBeforeUnmount(() => {
  if (mobileMediaHandler) {
    mobileMediaQuery?.removeEventListener('change', mobileMediaHandler)
  }
  window.removeEventListener('scroll', updateActiveMemberFromScroll)
  window.removeEventListener('resize', updateActiveMemberFromScroll)
})

watch(teamMembers, (members) => {
  if (activeMemberIndex.value > members.length - 1) {
    activeMemberIndex.value = Math.max(members.length - 1, 0)
  }
})
</script>

<template>
  <section id="team" ref="teamSection" data-header-theme="light" class="relative bg-stone-100" :style="{ height: teamScrollHeight }">
    <div class="sticky top-0 h-screen w-full overflow-hidden">
      <div class="relative left-1/2 h-screen w-screen -translate-x-1/2 bg-white md:hidden">
        <div class="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-white via-white/90 to-transparent px-4 pb-14 pt-5" data-reveal="soft">
          <SectionLabel>{{ terms.home.team.label }}</SectionLabel>
          <h2 class="mt-2 text-4xl font-semibold leading-none tracking-normal text-neutral-950">
            {{ terms.home.team.title }}
          </h2>

          <div class="mt-5 flex items-center gap-3" :aria-label="`${terms.home.team.title} pagination`">
            <button
              v-for="(member, index) in teamMembers"
              :key="member.name"
              type="button"
              class="h-3.5 rounded-full border border-neutral-950 transition-all"
              :class="activeMemberIndex === index ? 'w-14 bg-neutral-950' : 'w-3.5 bg-white/80'"
              :aria-label="`Show ${member.name}`"
              @click="selectMember(index)"
            />
          </div>
        </div>

        <div
          v-if="teamMembers.length"
          ref="mobileSlider"
          class="team-mobile-slider flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
          @scroll.passive="updateActiveMemberFromSlider"
        >
          <article
            v-for="(member, index) in teamMembers"
            :key="member.name"
            class="relative h-full w-screen shrink-0 snap-start overflow-hidden bg-white"
            :aria-label="member.name"
          >
            <img
              :src="member.image"
              :alt="member.imageAlt"
              class="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            >
            <div class="absolute inset-0 bg-gradient-to-b from-white via-white/25 to-transparent" />
            <div class="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/28 to-transparent" />
            <div class="absolute bottom-28 left-0 right-0 px-5 text-white">
              <p class="text-xs font-black uppercase tracking-[0.32em] text-white">
                {{ member.role }}
              </p>
              <h3 class="mt-3 text-5xl font-black uppercase leading-none text-white">
                {{ member.name }}
              </h3>
              <p class="mt-4 max-w-sm break-words text-base leading-7 text-white/82">
                {{ member.description }}
              </p>
            </div>
          </article>
        </div>

        <div v-else class="flex h-full items-end px-5 pb-24 text-neutral-950">
          <p class="max-w-sm text-lg leading-8">
            {{ mastersPending ? terms.home.team.loading : terms.home.team.empty }}
          </p>
        </div>

        <div v-if="hasMultipleTeamMembers" class="pointer-events-none absolute bottom-6 right-5 z-30 flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-white">
          <span>{{ terms.home.team.swipeHint }}</span>
          <svg class="team-swipe-arrow h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>

      <div class="relative left-1/2 hidden h-screen w-screen -translate-x-1/2 bg-white md:grid md:grid-cols-[minmax(430px,0.5fr)_minmax(0,1fr)] lg:grid-cols-[minmax(520px,0.46fr)_minmax(0,1fr)]">
        <div class="relative z-10 flex min-h-0 flex-col justify-between gap-5 px-4 py-5 sm:px-8 sm:py-8 md:pb-10 md:pl-24 md:pt-24 lg:pl-28 lg:pr-14 lg:pt-28" data-reveal="soft">
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-4 border-b border-neutral-950/15 pb-4">
              <div>
                <SectionLabel>{{ terms.home.team.label }}</SectionLabel>
                <h2 class="mt-2 text-4xl font-semibold leading-none tracking-normal text-neutral-950 sm:text-5xl lg:text-[52px]">
                  {{ terms.home.team.title }}
                </h2>
              </div>
            </div>

            <p class="max-w-xs text-sm leading-6 text-neutral-600 md:hidden">
              {{ terms.home.team.description }}
            </p>
          </div>

          <nav class="flex gap-3 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible md:pb-0" :aria-label="terms.home.team.title">
            <button
              v-for="(member, index) in teamMembers"
              :key="member.name"
              type="button"
              class="shrink-0 border px-3 py-2 text-left text-4xl font-black uppercase leading-none tracking-normal transition duration-300 sm:text-5xl md:block md:w-full md:border-transparent md:px-0 md:py-1 md:text-[52px] lg:text-7xl"
              :class="activeMemberIndex === index ? 'border-neutral-950 bg-stone-100 text-neutral-950 md:bg-transparent md:text-neutral-950' : 'border-transparent text-neutral-950/35 hover:text-neutral-950/70'"
              :aria-current="activeMemberIndex === index ? 'true' : undefined"
              @click="selectMember(index)"
              @focus="selectMember(index)"
            >
              {{ member.name }}
            </button>
          </nav>

          <NuxtLink to="#booking" class="inline-flex w-fit border-b border-neutral-950 pb-2 text-sm font-semibold uppercase tracking-[0.18em] text-neutral-950 transition hover:opacity-60">
            {{ terms.home.team.cta }}
          </NuxtLink>

          <div class="hidden max-w-xs border-t border-neutral-950/20 pt-5 text-sm leading-7 text-neutral-600 md:block">
            {{ terms.home.team.description }}
          </div>
        </div>

        <article v-if="activeMember" class="relative min-h-0 overflow-hidden" data-reveal="image" data-reveal-delay="160">
          <Transition name="team-photo" mode="out-in">
            <img
              :key="activeMember.name"
              :src="activeImage"
              :alt="activeMember.imageAlt"
              class="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            >
          </Transition>
          <div class="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-neutral-950/20 to-transparent md:bg-gradient-to-r md:from-white md:via-white/65 md:to-neutral-950/20" />
          <div class="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8 md:left-auto md:max-w-xl md:p-12">
            <p class="text-xs font-black uppercase tracking-[0.32em] text-white">
              {{ activeMember.role }}
            </p>
            <h3 class="mt-3 text-4xl font-black uppercase leading-none text-white md:hidden">
              {{ activeMember.name }}
            </h3>
            <p class="mt-4 max-w-md break-words text-base leading-8 text-white/78">
              {{ activeMember.description }}
            </p>
          </div>
        </article>

        <div v-else class="flex min-h-0 items-end bg-white p-12 text-neutral-950">
          <p class="max-w-sm text-lg leading-8">
            {{ mastersPending ? terms.home.team.loading : terms.home.team.empty }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.team-photo-enter-active,
.team-photo-leave-active {
  transition: opacity 220ms ease, transform 420ms ease;
}

.team-photo-enter-from,
.team-photo-leave-to {
  opacity: 0;
  transform: scale(1.03);
}

.team-mobile-slider {
  scrollbar-width: none;
}

.team-mobile-slider::-webkit-scrollbar {
  display: none;
}

.team-swipe-arrow {
  animation: team-arrow 1.2s ease-in-out infinite;
}

@keyframes team-arrow {
  0%,
  100% {
    transform: translateX(-2px);
    opacity: 0.45;
  }

  50% {
    transform: translateX(10px);
    opacity: 1;
  }
}
</style>
