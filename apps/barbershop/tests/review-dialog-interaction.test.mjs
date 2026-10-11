import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('mobile team review dialog trigger overrides its noninteractive overlay', async () => {
  const team = await readFile(new URL('../components/sections/TeamSection.vue', import.meta.url), 'utf8')
  const rating = await readFile(new URL('../components/ui/MasterRatingBlock.vue', import.meta.url), 'utf8')
  assert.match(team, /pointer-events-none absolute bottom-28/)
  assert.match(team, /v-if="isTeamVisible && isMobile"[\s\S]*?reviews-dialog/)
  assert.match(rating, /:class="reviewsDialog \? 'pointer-events-auto cursor-pointer/)
})
