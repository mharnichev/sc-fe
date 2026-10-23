// Exact catalog identities with approved editorial service guides.
export const serviceGuideNames: Record<number, string> = {
  1: 'Традиційне гоління',
  2: 'Дитяча стрижка',
  3: 'Стрижка машинкою + стрижка бороди',
  4: 'Стрижка + борода',
  5: 'Стрижка бороди',
  6: 'Стрижка машинкою',
  7: 'Стрижка',
  8: 'Укладка волосся',
  10: 'Камуфляж сивини бороди',
}

// Significant editorial revision in git commit 444f5293 (2026-10-21 15:59:14 +03:00).
// Update only the affected guide when its published content changes substantially.
export const serviceGuideEditorialUpdatedAt: Readonly<Record<number, string>> = {
  1: '2026-10-21T12:59:14.000Z',
  2: '2026-10-21T12:59:14.000Z',
  3: '2026-10-21T12:59:14.000Z',
  4: '2026-10-21T12:59:14.000Z',
  5: '2026-10-21T12:59:14.000Z',
  6: '2026-10-21T12:59:14.000Z',
  7: '2026-10-21T12:59:14.000Z',
  8: '2026-10-21T12:59:14.000Z',
  10: '2026-10-21T12:59:14.000Z',
}

export const hasServiceGuide = (id: number | null | undefined, name: string | null | undefined): boolean =>
  typeof id === 'number'
  && Object.hasOwn(serviceGuideNames, id)
  && serviceGuideNames[id] === name?.trim()

export const serviceGuideLastmod = (id: number | null | undefined, name: string | null | undefined) =>
  hasServiceGuide(id, name) ? serviceGuideEditorialUpdatedAt[id as number] : undefined
