type ServiceGuide = {
  intro: string
  choice: string
  preparation: string
  result: string
  faq: Array<{ question: string, answer: string }>
}

type LocalizedGuide = { uk: ServiceGuide, en: ServiceGuide }

// These base IDs and service names are present in the public service catalog.
// The guidance helps visitors choose; the live catalog remains the source for offers.
const guides: Record<number, LocalizedGuide> = {
  7: {
    uk: {
      intro: 'Підійде, якщо хочете змінити або відновити форму зачіски з роботою ножицями та машинкою.',
      choice: 'Оберіть стрижку, якщо важливі форма, довжина та перехід між зонами голови. Якщо потрібна лише коротка стрижка машинкою з насадками, порівняйте послугу «Стрижка машинкою».',
      preparation: 'Перед записом подумайте, яку довжину хочете залишити зверху й з боків. На початку візиту покажіть фото бажаної форми або поясніть, що саме подобається у вашій поточній стрижці.',
      result: 'Обговоріть із барбером довжину, контур і те, як ви звичайно укладаєте волосся. Якщо хочете підібрати засіб для укладки, скажіть про це під час візиту.',
      faq: [{ question: 'Чим ця послуга відрізняється від стрижки машинкою?', answer: 'Стрижка передбачає роботу ножицями та машинкою; стрижка машинкою в каталозі описана як робота з двома насадками й тримером. Обирайте за бажаною формою та способом стрижки.' }],
    },
    en: {
      intro: 'Choose this when you want to change or refresh a hairstyle shaped with scissors and clippers.',
      choice: 'Choose a haircut when shape, length and the transition between areas matter. If you want a short clipper cut using guards, compare the Clipper cut service.',
      preparation: 'Think about the length you want to keep on top and at the sides. At the start of the visit, show a reference photo or explain what you like about your current cut.',
      result: 'Discuss length, outline and how you normally style your hair with the barber. If you want help choosing a styling product, mention it during the visit.',
      faq: [{ question: 'How is this different from a clipper cut?', answer: 'The haircut uses scissors and clippers; the catalog describes the clipper cut as using two guards and a trimmer. Choose based on the shape and cutting method you want.' }],
    },
  },
  6: {
    uk: {
      intro: 'Коротка стрижка машинкою з двома насадками та тримером.',
      choice: 'Це варіант для короткої форми, яку можна виконати машинкою. Якщо хочете зберегти довше волосся або змінити форму ножицями, перегляньте звичайну стрижку.',
      preparation: 'Визначте, наскільки короткими мають бути верх і боки. Якщо знаєте номери насадок, назвіть їх барберу; якщо ні — покажіть приклад бажаної довжини.',
      result: 'Перед початком узгодьте довжину та лінію окантовки. Це допоможе отримати саме ту коротку форму, яку ви маєте на увазі.',
      faq: [{ question: 'Чи підійде стрижка машинкою для довшої зачіски?', answer: 'У каталозі це коротка стрижка з двома насадками та тримером. Для довшої форми або роботи ножицями краще переглянути послугу «Стрижка».' }],
    },
    en: {
      intro: 'A short clipper cut using two guards and a trimmer.',
      choice: 'This suits a short shape that can be cut with clippers. For longer hair or a shape that needs scissors, look at the regular Haircut service.',
      preparation: 'Decide how short you want the top and sides. Tell the barber your preferred guard numbers if you know them, or show an example of the length.',
      result: 'Agree on the length and edge line before the cut begins so the short shape matches what you have in mind.',
      faq: [{ question: 'Is a clipper cut suitable for a longer hairstyle?', answer: 'The catalog describes a short cut with two guards and a trimmer. For a longer shape or scissor work, see the Haircut service.' }],
    },
  },
  4: {
    uk: {
      intro: 'Один запис, щоб узгодити форму зачіски та бороди.',
      choice: 'Оберіть поєднану послугу, якщо хочете попрацювати і з волоссям на голові, і з бородою під час одного візиту. Якщо потрібна тільки одна зона, перегляньте окрему стрижку або стрижку бороди.',
      preparation: 'Підготуйте побажання щодо довжини волосся та бороди окремо. Фото з бажаною формою допоможе пояснити, як вони мають поєднуватися.',
      result: 'На початку візиту обговоріть форму зачіски, довжину бороди та контури. Деталі роботи з бородою можуть відрізнятися за пропозицією барбера — уточніть їх перед записом.',
      faq: [{ question: 'Коли обрати поєднану послугу?', answer: 'Коли потрібно освіжити зачіску й бороду за один візит. Якщо волосся на голові хочете стригти лише машинкою, порівняйте також «Стрижка машинкою + стрижка бороди».' }],
    },
    en: {
      intro: 'One appointment to coordinate your haircut and beard shape.',
      choice: 'Choose the combined service when both your head hair and beard need attention in one visit. If only one needs work, compare the separate Haircut or Beard trim services.',
      preparation: 'Think about the hair and beard lengths separately. A reference photo can help explain how you want the two shapes to work together.',
      result: 'Discuss the haircut shape, beard length and outlines at the start. Beard work can vary by barber offer, so check its details when booking.',
      faq: [{ question: 'When should I choose the combined service?', answer: 'Choose it to refresh hair and beard in one visit. If you want the head hair cut only with clippers, also compare Clipper cut + beard trim.' }],
    },
  },
  5: {
    uk: {
      intro: 'Для зміни або підтримання довжини, форми та контурів бороди.',
      choice: 'Оберіть стрижку бороди, якщо зачіска зараз не потребує оновлення. Для роботи з волоссям на голові та бородою за один візит перегляньте поєднані послуги.',
      preparation: 'Подумайте, яку довжину бороди хочете залишити й наскільки чіткими мають бути контури. Покажіть фото, якщо важко описати форму словами.',
      result: 'Погодьте з барбером форму бороди та лінії щік і шиї до початку роботи. Опис конкретної пропозиції барбера підкаже деталі виконання.',
      faq: [{ question: 'Чи входить стрижка волосся на голові?', answer: 'Ця послуга стосується бороди. Якщо потрібно оновити і зачіску, і бороду, оберіть відповідну поєднану послугу.' }],
    },
    en: {
      intro: 'For changing or maintaining your beard length, shape and outlines.',
      choice: 'Choose a beard trim if your haircut does not need refreshing. To work on both head hair and beard in one visit, compare the combined services.',
      preparation: 'Think about the beard length you want to keep and how defined you want its edges. Bring a reference photo if the shape is hard to describe.',
      result: 'Agree on the beard shape and cheek and neck lines before work begins. Check the selected barber’s offer for the specific service details.',
      faq: [{ question: 'Does this include a haircut?', answer: 'This service is for the beard. If you need to refresh both hair and beard, choose a combined service.' }],
    },
  },
  1: {
    uk: {
      intro: 'Гоління обличчя бритвою-шавет з підготовкою гарячим рушником.',
      choice: 'Оберіть традиційне гоління, якщо хочете поголити обличчя. Якщо мета — зберегти бороду та змінити її форму, перегляньте стрижку бороди.',
      preparation: 'На початку візиту скажіть барберу, якщо є ділянки шкіри, яких хочете уникати, або особисті побажання до лінії гоління.',
      result: 'Каталог описує підготовку гарячим рушником і догляд після гоління. Уточніть у барбера бажаний контур до початку процедури.',
      faq: [{ question: 'Чим гоління відрізняється від стрижки бороди?', answer: 'Традиційне гоління призначене для гоління обличчя бритвою-шавет. Стрижка бороди зберігає бороду та змінює її довжину й форму.' }],
    },
    en: {
      intro: 'A facial shave with a shavette razor and hot towel preparation.',
      choice: 'Choose a traditional shave when you want your face shaved. If you want to keep your beard and adjust its shape, look at Beard trim.',
      preparation: 'At the start of the visit, tell the barber about areas of skin you want them to avoid or your preferences for the shave line.',
      result: 'The catalog describes hot towel preparation and care after the shave. Agree on your preferred outline with the barber before it starts.',
      faq: [{ question: 'How does a shave differ from a beard trim?', answer: 'The traditional shave is for shaving the face with a shavette razor. A beard trim keeps the beard while changing its length and shape.' }],
    },
  },
}

const expectedNames: Record<number, string> = {
  1: 'Традиційне гоління',
  4: 'Стрижка + борода',
  5: 'Стрижка бороди',
  6: 'Стрижка машинкою',
  7: 'Стрижка',
}

export const serviceGuide = (baseServiceId: number | null | undefined, name: string | null | undefined, locale: string): ServiceGuide | null => {
  if (!baseServiceId || name?.trim() !== expectedNames[baseServiceId]) return null
  const guide = baseServiceId ? guides[baseServiceId] : undefined
  return guide ? guide[locale === 'en' ? 'en' : 'uk'] : null
}
