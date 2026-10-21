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
  15: 'Стрижка машинкою+стрижка бороди ЗСУ',
}

export const hasServiceGuide = (id: number | null | undefined, name: string | null | undefined): boolean =>
  typeof id === 'number'
  && Object.hasOwn(serviceGuideNames, id)
  && serviceGuideNames[id] === name?.trim()
