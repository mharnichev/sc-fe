<script setup lang="ts">
import type { MasterDto } from '@shared-types'
import FeedbackState from '~/components/ui/FeedbackState.vue'

type LocalizedMasterDto = MasterDto & {
  title_uk?: string | null
  title_en?: string | null
  description_uk?: string | null
  description_en?: string | null
  bio_uk?: string | null
  bio_en?: string | null
}

const props = withDefaults(defineProps<{
  bookingTarget?: string
  showAllActive?: boolean
}>(), {
  bookingTarget: '#booking',
  showAllActive: false,
})

const { locale, terms } = useTerms()
const domain = useBarbershopDomain()
const assetUrl = useAssetUrl()
const { data: masters, pending: mastersPending } = await useAsyncData('home-team-masters', domain.getMasters, {
  default: () => [],
})

const activeMemberIndex = ref(0)
const teamSection = ref<HTMLElement | null>(null)
const mobileSlider = ref<HTMLElement | null>(null)
const isMobile = ref(false)
let mobileMediaQuery: MediaQueryList | null = null
let mobileMediaHandler: (() => void) | null = null
const { masterName } = useMasterDisplay()

const teamImages = [
  'https://images.unsplash.com/photo-1599351431613-18ef1fdd27e1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1588771930296-88c2cb03f386?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1618077360395-f3068be8e001?auto=format&fit=crop&w=900&q=80',
]

const masterRole = (master: LocalizedMasterDto) =>
  locale.value === 'en'
    ? master.position_en || master.title_en || master.title || master.position_uk || terms.value.home.team.defaultRole
    : master.position_uk || master.title_uk || master.title || master.position_en || terms.value.home.team.defaultRole

const masterDescription = (master: LocalizedMasterDto) =>
  locale.value === 'en'
    ? master.bio_en || master.description_en || master.bio || master.description || master.bio_uk || master.description_uk || terms.value.home.team.noDescription
    : master.bio_uk || master.description_uk || master.bio || master.description || master.bio_en || master.description_en || terms.value.home.team.noDescription

const masterPhoto = (master: MasterDto) =>
  assetUrl(master.photo || master.photo_url) || teamImages[0]

const isMasterActive = (master: MasterDto) =>
  master.is_active ?? master.status !== 'inactive'

const isVisibleInMasterBlock = (master: MasterDto) =>
  master.showOnMasterBlock ?? master.show_on_master_block ?? true

const teamMembers = computed(() =>
  (masters.value || [])
    .filter(isMasterActive)
    .filter(master => props.showAllActive || isVisibleInMasterBlock(master))
    .map(master => ({
      id: master.id,
      name: masterName(master),
      role: masterRole(master),
      description: masterDescription(master),
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
        <div class="absolute inset-x-0 top-0 z-20 pb-14 pt-5" data-reveal="soft">
          <div class="site-container">
            <SectionLabel class="text-white/75">{{ terms.home.team.label }}</SectionLabel>
            <h2 class="mt-2 text-2xl font-semibold uppercase leading-none tracking-normal text-white">
              {{ terms.home.team.title }}
            </h2>
          </div>
        </div>

        <div v-if="hasMultipleTeamMembers" class="absolute right-5 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-3" :aria-label="`${terms.home.team.title} pagination`">
          <button
            v-for="(member, index) in teamMembers"
            :key="member.name"
            type="button"
            class="w-3.5 rounded-full border border-white bg-white transition-all"
            :class="activeMemberIndex === index ? 'h-12 opacity-100' : 'h-3.5 opacity-55'"
            :aria-label="`Show ${member.name}`"
            @click="selectMember(index)"
          />
        </div>

        <template v-if="teamMembers.length">
          <div
            ref="mobileSlider"
            class="team-mobile-slider flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
            @scroll.passive="updateActiveMemberFromSlider"
          >
            <article
              v-for="(member, index) in teamMembers"
              :key="member.name"
              class="relative h-full w-screen shrink-0 snap-start overflow-hidden bg-neutral-950"
              :aria-label="member.name"
            >
              <img
                :src="member.image"
                :alt="member.imageAlt"
                class="absolute inset-0 h-full w-full object-cover object-top"
                loading="lazy"
              >
            </article>
          </div>

          <div v-if="activeMember" class="pointer-events-none absolute bottom-28 left-0 right-0 z-20 text-white">
            <Transition name="team-member-copy" mode="out-in" :duration="{ enter: 380, leave: 320 }">
              <div :key="activeMember.id" class="site-container">
                <p class="type-meta type-eyebrow--wide text-xs text-white">
                  {{ activeMember.role }}
                </p>
                <h3 class="type-display mt-3 text-2xl leading-none text-white">
                  {{ activeMember.name }}
                </h3>
                <p class="mt-4 max-w-sm break-words text-base leading-7 text-white/82">
                  {{ activeMember.description }}
                </p>
                <MasterRatingBlock
                  :master-id="activeMember.id"
                  tone="dark"
                  compact
                  class="mt-4"
                />
              </div>
            </Transition>
          </div>
        </template>

        <div v-else class="site-container flex h-full items-end pb-20 text-neutral-950">
          <FeedbackState
            compact
            :kind="mastersPending ? 'empty' : 'unavailable'"
            :face="mastersPending ? 'wide-eyed-smile' : 'sad-droopy-face'"
            :title="mastersPending ? terms.home.team.loading : terms.home.team.empty"
            style="--feedback-state-surface: #fff"
          />
        </div>

        <div v-if="hasMultipleTeamMembers" class="type-meta pointer-events-none absolute bottom-6 right-5 z-30 flex items-center gap-2 text-xs text-white">
          <span>{{ terms.home.team.swipeHint }}</span>
          <svg class="team-swipe-arrow h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>

      <div class="relative left-1/2 hidden h-screen w-screen -translate-x-1/2 overflow-hidden bg-white md:block">
        <div class="site-container grid h-full gap-12 md:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:gap-16 xl:gap-20">
        <div class="relative z-10 flex h-full min-h-0 py-5 pl-3 sm:py-8 md:pb-10 md:pt-24 lg:pt-28" data-reveal="soft">
          <div class="flex h-full min-w-0 max-w-[17rem] flex-col items-start justify-between gap-8 text-left">
            <div class="flex flex-col items-start gap-3">
              <div class="flex w-fit max-w-full items-start justify-start pb-4">
                <div>
                  <SectionLabel>{{ terms.home.team.label }}</SectionLabel>
                  <h2 class="mt-2 text-2xl font-semibold uppercase leading-none tracking-normal text-neutral-950 sm:text-2xl md:text-4xl lg:text-4xl">
                    {{ terms.home.team.title }}
                  </h2>
                </div>
              </div>

            </div>

            <nav class="flex gap-3 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible md:pb-0" :aria-label="terms.home.team.title">
              <button
                v-for="(member, index) in teamMembers"
                :key="member.name"
                type="button"
                class="type-display shrink-0 border px-3 py-2 text-left text-2xl leading-none tracking-normal transition duration-300 sm:text-2xl md:block md:w-full md:border-transparent md:px-0 md:py-1 md:text-4xl xl:text-[42px]"
                :class="activeMemberIndex === index ? 'border-neutral-950 bg-stone-100 text-neutral-950 md:bg-transparent md:text-neutral-950' : 'border-transparent text-neutral-950/35 hover:text-neutral-950/70'"
                :aria-current="activeMemberIndex === index ? 'true' : undefined"
                @click="selectMember(index)"
                @focus="selectMember(index)"
              >
                {{ member.name }}
              </button>
            </nav>

            <BaseButton :to="props.bookingTarget">
              {{ terms.home.team.cta }}
            </BaseButton>

          </div>
        </div>

        <article v-if="activeMember" class="relative -mr-6 min-h-0 overflow-hidden bg-neutral-950 lg:-mr-8 min-[1280px]:-mr-[calc((100vw-80rem)/2+2rem)]" data-reveal="image" data-reveal-delay="160">
          <Transition name="team-photo" mode="out-in">
            <img
              :key="activeMember.name"
              :src="activeImage"
              :alt="activeMember.imageAlt"
              class="absolute inset-0 h-full w-full object-cover object-top"
              loading="lazy"
            >
          </Transition>
          <div class="absolute bottom-0 left-0 right-0 text-white md:left-auto">
            <Transition name="team-member-copy" mode="out-in" :duration="{ enter: 380, leave: 320 }">
              <div :key="activeMember.id" class="site-container py-6 sm:py-8 md:max-w-xl md:px-12 md:py-12">
                <p class="type-meta type-eyebrow--wide text-xs text-white">
                  {{ activeMember.role }}
                </p>
                <h3 class="type-display mt-3 text-2xl leading-none text-white md:hidden">
                  {{ activeMember.name }}
                </h3>
                <p class="mt-4 max-w-md break-words text-base leading-8 text-white/78">
                  {{ activeMember.description }}
                </p>
                <MasterRatingBlock
                  :master-id="activeMember.id"
                  :review-limit="1"
                  show-reviews
                  tone="dark"
                  class="mt-5 max-w-md"
                />
              </div>
            </Transition>
          </div>
        </article>

        <FeedbackState
          v-else
          class="-mr-6 min-h-0 bg-white text-neutral-950 lg:-mr-8 min-[1280px]:-mr-[calc((100vw-80rem)/2+2rem)]"
          :kind="mastersPending ? 'empty' : 'unavailable'"
          :face="mastersPending ? 'wide-eyed-smile' : 'sad-droopy-face'"
          :title="mastersPending ? terms.home.team.loading : terms.home.team.empty"
          style="--feedback-state-surface: #fff"
        />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.team-photo-enter-active,
.team-photo-leave-active {
  transition: opacity 260ms ease, filter 320ms ease, transform 420ms ease;
}

.team-photo-enter-from,
.team-photo-leave-to {
  opacity: 0;
  filter: brightness(0);
  transform: scale(1.03);
}

.team-member-copy-enter-active,
.team-member-copy-leave-active {
  transition: opacity 320ms ease, transform 380ms cubic-bezier(0.22, 1, 0.36, 1);
}

.team-member-copy-enter-from {
  opacity: 0;
  transform: translateY(1rem);
}

.team-member-copy-leave-to {
  opacity: 0;
  transform: translateY(-0.75rem);
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
