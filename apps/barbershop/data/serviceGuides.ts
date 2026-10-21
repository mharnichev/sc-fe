import { hasServiceGuide } from './serviceGuideNames'

type ServiceGuide = {
  intro: string
  choice: string
  preparation: string
  result: string
  relatedServiceIds: number[]
  faq: Array<{ question: string, answer: string }>
}

type LocalizedGuide = { uk: ServiceGuide, en: ServiceGuide }

// Editorial guidance based on the public catalog and Hlib Anotskyi’s answers.
// Personal techniques and recommendations are attributed to Hlib, not every barber.
// Prices, appointment lengths and eligibility remain owned by the live catalog.
const guides: Record<number, LocalizedGuide> = {
  "7": {
    "uk": {
      "intro": "Чоловіча стрижка для підтримання звичної форми або зміни зачіски. Ножиці та машинка допомагають узгодити довжину й переходи між зонами.",
      "choice": "Оберіть цю послугу для fade, складніших переходів або роботи ножицями. Проста стрижка під насадки — окрема послуга; якщо потрібно також оформити бороду, зручніше обрати комплекс.",
      "preparation": "Скажіть, що не влаштовує в поточній зачісці, як часто стрижетеся та чи укладаєте волосся вдома. Референс або фото попередньої вдалої стрижки допоможе пояснити побажання.",
      "result": "Узгодьте довжину, переходи та час, який готові витрачати на укладку. Розкажіть про особливості шкіри й ділянки, які потребують обережності. Попросіть показати, як відтворити укладку вдома.",
      "faq": [
        {
          "question": "Для fade обирати стрижку чи стрижку машинкою?",
          "answer": "Для fade обирайте повноцінну стрижку. Послуга «Стрижка машинкою» — це форма під насадки й контури без складних переходів."
        },
        {
          "question": "Що входить у стрижку у Глеба?",
          "answer": "Глеб Аноцький підтвердив, що миття, укладка та підбір засобу входять у вартість його стрижки."
        },
        {
          "question": "Як часто оновлювати форму?",
          "answer": "Глеб радить орієнтуватися приблизно на 2–3 тижні; для короткої стрижки машинкою — близько 2 тижнів, для подовженої форми — 3–4. Це його орієнтир, а не обов’язковий графік: домовтеся про наступний візит під вашу форму."
        }
      ],
      "relatedServiceIds": [
        6,
        4
      ]
    },
    "en": {
      "intro": "A men’s haircut to maintain a familiar shape or change your hairstyle, using scissors and clippers to coordinate length and transitions.",
      "choice": "Choose this service for a fade, more detailed transitions or scissor work. A simple cut with guards is a separate service. Choose a combined appointment if your beard also needs shaping.",
      "preparation": "Explain what does not work about your current haircut, how often you have it cut and whether you style it at home. A reference or a photo of a previous cut can help describe your preferences.",
      "result": "Agree on length, transitions and how much time you want to spend styling. Mention skin concerns or areas that need care, and ask how to recreate the style at home.",
      "faq": [
        {
          "question": "Should I book a haircut or a clipper cut for a fade?",
          "answer": "Book a full haircut for a fade. The Clipper cut service is a guard-length cut with tidy outlines, without detailed transitions."
        },
        {
          "question": "What does a haircut with Hlib include?",
          "answer": "Hlib Anotskyi confirmed that washing, styling and help choosing a product are included in his haircut price."
        },
        {
          "question": "How often should I refresh the shape?",
          "answer": "Hlib suggests around 2–3 weeks, roughly 2 weeks for a short clipper cut and 3–4 for a longer shape. This is his guidance, not a fixed schedule; agree on the next visit for your style."
        }
      ],
      "relatedServiceIds": [
        6,
        4
      ]
    }
  },
  "6": {
    "uk": {
      "intro": "Коротка стрижка голови машинкою з двома насадками та тримером: узгоджена довжина й охайні контури.",
      "choice": "Оберіть її, якщо потрібна проста коротка форма без складних переходів. Для fade, зміни форми ножицями або збереження довших зон обирайте повноцінну стрижку.",
      "preparation": "Назвіть бажану довжину зверху та з боків. Номери насадок знати необов’язково — покажіть приклад і поясніть, наскільки коротко хочете.",
      "result": "Перед початком погодьте довжину та контури. Якщо потрібна борода, оберіть комплекс «Стрижка машинкою + стрижка бороди», щоб запис відповідав обсягу роботи.",
      "faq": [
        {
          "question": "Чи входить fade у стрижку машинкою?",
          "answer": "Ні. За поясненням Глеба, fade належить до повноцінної стрижки; проста машинка — це довжина під насадки та контури."
        },
        {
          "question": "Чи треба знати номери насадок?",
          "answer": "Ні. Опишіть бажану довжину або покажіть фото; конкретні насадки узгодьте з барбером."
        }
      ],
      "relatedServiceIds": [
        7,
        3
      ]
    },
    "en": {
      "intro": "A short clipper cut with two guards and a trimmer, with agreed lengths and tidy outlines.",
      "choice": "Choose it for a simple short shape without detailed transitions. Book a full haircut for a fade, scissor shaping or longer sections.",
      "preparation": "Describe the length you want on top and at the sides. You do not need to know guard numbers: bring an example and explain how short you want to go.",
      "result": "Agree on lengths and outlines before work begins. If your beard also needs attention, choose Clipper cut + beard trim so the appointment covers both.",
      "faq": [
        {
          "question": "Is a fade included in a clipper cut?",
          "answer": "No. Hlib explains that a fade is a full haircut; a simple clipper cut is a guard-length cut with tidy outlines."
        },
        {
          "question": "Do I need to know the guard numbers?",
          "answer": "No. Describe the length or show a photo and agree on the guards with your barber."
        }
      ],
      "relatedServiceIds": [
        7,
        3
      ]
    }
  },
  "5": {
    "uk": {
      "intro": "Стрижка бороди для корекції довжини, форми й контурів, коли бороду потрібно зберегти, а не зголити повністю.",
      "choice": "Оберіть окрему послугу, якщо зачіска не потребує оновлення. Для роботи з волоссям і бородою за один візит є два комплекси — зі звичайною стрижкою або стрижкою машинкою.",
      "preparation": "Поясніть, де хочете залишити густоту й довжину та якими бачите вуса, лінії щік і шиї. Референс допоможе, якщо форму важко описати.",
      "result": "Уточніть обсяг роботи й спосіб обробки контурів у свого майстра. Глеб підбирає ножиці, машинку та потребу в розпарюванні під густоту волосся й задачу; гаряче полотенце потрібне не в кожному випадку.",
      "faq": [
        {
          "question": "Гаряче полотенце використовують завжди?",
          "answer": "Ні. Глеб пояснив, що у своїй роботі вирішує це за густотою волосся й задачею. Склад конкретної послуги уточнюйте у вибраного барбера."
        },
        {
          "question": "Стрижка бороди — це повне гоління?",
          "answer": "Ні, мета — зберегти бороду й скоригувати форму. Якщо хочете зголити її, перегляньте традиційне гоління."
        }
      ],
      "relatedServiceIds": [
        4,
        3,
        1
      ]
    },
    "en": {
      "intro": "A beard trim to adjust length, shape and outlines while keeping the beard rather than shaving it off.",
      "choice": "Book it separately if your haircut does not need refreshing. For hair and beard in one visit, choose a combined haircut or clipper cut appointment.",
      "preparation": "Explain where you want to keep length and fullness, and your preferences for the moustache, cheeks and neck. A reference can help describe the shape.",
      "result": "Agree on the work and outline method with your barber. Hlib chooses scissors, clippers and whether to steam the beard according to hair density and the task; a hot towel is not needed every time.",
      "faq": [
        {
          "question": "Is a hot towel always used?",
          "answer": "No. Hlib says he decides according to hair density and the task. Check the specific service with your chosen barber."
        },
        {
          "question": "Is a beard trim a full shave?",
          "answer": "No, it keeps the beard and adjusts its shape. See Traditional shave if you want to shave it off."
        }
      ],
      "relatedServiceIds": [
        4,
        3,
        1
      ]
    }
  },
  "4": {
    "uk": {
      "intro": "Один візит для стрижки волосся й оформлення бороди як узгодженого образу.",
      "choice": "Оберіть цей комплекс, якщо потрібно попрацювати з обома зонами. Для простої короткої форми під насадки порівняйте «Стрижка машинкою + стрижка бороди».",
      "preparation": "Підготуйте побажання до волосся та бороди окремо: довжина, переходи, густота, контури. Покажіть референс або поясніть, що хочете змінити в поточній формі.",
      "result": "Глеб підтвердив, що робота з бородою в обох його комплексах однакова за принципом вибору під задачу. Узгодьте контури й обсяг із вибраним майстром; гаряче полотенце не слід вважати обов’язковим для кожного візиту.",
      "faq": [
        {
          "question": "Чим відрізняються два комплекси?",
          "answer": "Способом стрижки волосся на голові: звичайна стрижка або проста машинка під насадки. Глеб пояснив, що принцип роботи з бородою в його комплексах однаковий."
        },
        {
          "question": "Чи можна записатися на комплекс, якщо потрібна тільки борода?",
          "answer": "Для роботи лише з бородою оберіть «Стрижка бороди». Так запис відповідатиме потрібній послузі."
        }
      ],
      "relatedServiceIds": [
        6,
        3,
        5
      ]
    },
    "en": {
      "intro": "One visit for a haircut and beard shaping that work together.",
      "choice": "Choose this when both areas need attention. For a simple short guard-length cut, compare Clipper cut + beard trim.",
      "preparation": "Think about hair and beard preferences separately: lengths, transitions, fullness and outlines. Bring a reference or explain what you want to change.",
      "result": "Hlib confirmed that he approaches beard work in both of his combined services according to the same individual task. Agree on outlines and scope with your barber; a hot towel is not an automatic part of every visit.",
      "faq": [
        {
          "question": "What is different about the two combined services?",
          "answer": "The cutting method on the head: a full haircut or a simple guard-length clipper cut. Hlib says he approaches the beard work in both of his combined services in the same way."
        },
        {
          "question": "Should I book a combined appointment for beard work only?",
          "answer": "Choose Beard trim if only your beard needs work, so the booking matches the service you need."
        }
      ],
      "relatedServiceIds": [
        6,
        3,
        5
      ]
    }
  },
  "3": {
    "uk": {
      "intro": "Один візит для короткої стрижки голови під насадки та оформлення бороди.",
      "choice": "Оберіть цей комплекс, якщо потрібно попрацювати з обома зонами. Для fade або роботи ножицями на голові оберіть «Стрижка + борода».",
      "preparation": "Підготуйте побажання до волосся та бороди окремо: довжина, переходи, густота, контури. Покажіть референс або поясніть, що хочете змінити в поточній формі.",
      "result": "Глеб підтвердив, що робота з бородою в обох його комплексах однакова за принципом вибору під задачу. Узгодьте контури й обсяг із вибраним майстром; гаряче полотенце не слід вважати обов’язковим для кожного візиту.",
      "faq": [
        {
          "question": "Чим відрізняються два комплекси?",
          "answer": "Способом стрижки волосся на голові: звичайна стрижка або проста машинка під насадки. Глеб пояснив, що принцип роботи з бородою в його комплексах однаковий."
        },
        {
          "question": "Чи можна записатися на комплекс, якщо потрібна тільки борода?",
          "answer": "Для роботи лише з бородою оберіть «Стрижка бороди». Так запис відповідатиме потрібній послузі."
        }
      ],
      "relatedServiceIds": [
        7,
        4,
        5
      ]
    },
    "en": {
      "intro": "One visit for a short guard-length clipper cut and beard shaping.",
      "choice": "Choose this when both areas need attention. For a fade or scissor work on the head, choose Haircut + beard trim.",
      "preparation": "Think about hair and beard preferences separately: lengths, transitions, fullness and outlines. Bring a reference or explain what you want to change.",
      "result": "Hlib confirmed that he approaches beard work in both of his combined services according to the same individual task. Agree on outlines and scope with your barber; a hot towel is not an automatic part of every visit.",
      "faq": [
        {
          "question": "What is different about the two combined services?",
          "answer": "The cutting method on the head: a full haircut or a simple guard-length clipper cut. Hlib says he approaches the beard work in both of his combined services in the same way."
        },
        {
          "question": "Should I book a combined appointment for beard work only?",
          "answer": "Choose Beard trim if only your beard needs work, so the booking matches the service you need."
        }
      ],
      "relatedServiceIds": [
        7,
        4,
        5
      ]
    }
  },
  "1": {
    "uk": {
      "intro": "Традиційне гоління шаветом для тих, хто хоче прибрати волосся, а не зберегти довжину бороди. Потрібну зону та обсяг роботи узгодьте з барбером.",
      "choice": "Оберіть гоління, якщо хочете прибрати волосся; для збереження бороди й корекції її форми потрібна стрижка бороди. Уточніть потрібну зону до вибору часу.",
      "preparation": "При записі повідомте, що саме потрібно поголити: обличчя, голову чи контури. Глеб підтвердив, що виконує ці варіанти; засоби для його процедури є на місці.",
      "result": "Погодьте зону й спосіб роботи з вибраним барбером. Повідомте про подразнення, родинки та інші особливості шкіри, які важливо врахувати. Обсяг і можливість гоління голови уточнюйте саме у свого майстра.",
      "faq": [
        {
          "question": "Чи можна поголити голову?",
          "answer": "Глеб підтвердив, що виконує гоління голови. Вкажіть цю задачу при записі; доступність і обсяг у іншого барбера потрібно узгодити окремо."
        },
        {
          "question": "Потрібно приносити свої засоби?",
          "answer": "Для гоління у Глеба засоби є на місці. Якщо маєте власні побажання до них, обговоріть це перед візитом."
        }
      ],
      "relatedServiceIds": [
        5
      ]
    },
    "en": {
      "intro": "A traditional shavette shave removes hair rather than preserving beard length. Agree on the area and scope with your barber.",
      "choice": "Choose shaving to remove hair; choose Beard trim to keep and shape the beard. Confirm the area before choosing an appointment time.",
      "preparation": "Say whether you need your face, head or outlines shaved. Hlib confirmed that he offers these options and has the products for his procedure on site.",
      "result": "Agree on the area and method with your chosen barber. Mention irritation, moles or other skin features they should take into account. Confirm head shaving and its scope with your barber.",
      "faq": [
        {
          "question": "Can I have my head shaved?",
          "answer": "Hlib confirmed that he offers head shaving. Mention this when booking; confirm availability and scope separately with another barber."
        },
        {
          "question": "Should I bring my own products?",
          "answer": "Hlib has the products for his shave on site. Discuss any product preferences before your visit."
        }
      ],
      "relatedServiceIds": [
        5
      ]
    }
  },
  "2": {
    "uk": {
      "intro": "Дитяча стрижка з узгодженням бажаної довжини й форми з батьками та дитиною.",
      "choice": "Оберіть цю послугу для дитини. Вік і те, наскільки комфортно їй сидіти під час стрижки, краще обговорити з майстром до запису.",
      "preparation": "Повідомте вік дитини, досвід попередніх стрижок і що може викликати дискомфорт. Поясніть побажання до довжини й покажіть приклад форми.",
      "result": "Глеб працює й з маленькими дітьми; за його практикою, батько або мати можуть тримати дитину на руках, якщо їй складно сидіти. Це особливість його роботи, а не підтверджений порядок для кожного майстра.",
      "faq": [
        {
          "question": "З якого віку можна записати дитину?",
          "answer": "Повідомте вік дитини до запису та узгодьте візит із вибраним барбером. Глеб працює й з маленькими дітьми; комфортний формат обговоріть заздалегідь."
        },
        {
          "question": "Чи може хтось із батьків бути поруч?",
          "answer": "Глеб підтвердив, що за потреби дитина може бути на руках у батьків. Домовтеся про зручний формат із майстром до початку стрижки."
        }
      ],
      "relatedServiceIds": [
        7
      ]
    },
    "en": {
      "intro": "A child’s haircut with length and shape agreed with the child and parent.",
      "choice": "Choose this service for a child. Discuss their age and comfort with sitting through a haircut before booking.",
      "preparation": "Mention the child’s age, previous haircut experiences and anything that makes them uncomfortable. Describe the length you want and bring an example.",
      "result": "Hlib also cuts young children’s hair and says a parent can hold the child if sitting alone is difficult. This describes his practice, not a confirmed policy for every barber.",
      "faq": [
        {
          "question": "What is the minimum age?",
          "answer": "Mention the child’s age and agree on the visit with your chosen barber. Hlib also cuts young children’s hair; discuss a comfortable arrangement beforehand."
        },
        {
          "question": "Can a parent stay beside the child?",
          "answer": "Hlib confirmed that a child can sit in a parent’s arms when needed. Agree on a comfortable arrangement with the barber before the haircut."
        }
      ],
      "relatedServiceIds": [
        7
      ]
    }
  },
  "10": {
    "uk": {
      "intro": "Камуфляж сивини бороди — тонування барвником із підбором відтінку та бажаного ступеня перекриття.",
      "choice": "Оберіть послугу, якщо хочете пом’якшити контраст сивини або перекрити її помітніше. Це робота з кольором; необхідність стрижки бороди обговоріть окремо.",
      "preparation": "Поясніть, чи хочете залишити частину сивини та наскільки природним має бути результат. До запису уточніть склад послуги, підготовку й особливості застосування засобу у майстра.",
      "result": "Узгодьте відтінок і насиченість. Глеб пояснює, що часте миття прискорює вимивання кольору, і рекомендує шампунь для бороди. Попросіть рекомендацію з догляду під обраний засіб.",
      "faq": [
        {
          "question": "Чи обов’язково повністю перекривати сивину?",
          "answer": "Ні. За поясненням Глеба, можна м’яко тонувати з природним результатом або перекрити сивину сильніше — залежно від задачі й обраного тону."
        },
        {
          "question": "Стрижка бороди входить у камуфляж?",
          "answer": "Перед записом уточніть склад пропозиції у вибраного барбера. Якщо потрібно також змінити довжину й форму бороди, узгодьте це разом із тонуванням."
        },
        {
          "question": "Як довго тримається колір?",
          "answer": "Точний строк не гарантуємо: Глеб підтвердив, що частота миття впливає на вимивання. Уточніть очікуваний результат і догляд у майстра перед процедурою."
        }
      ],
      "relatedServiceIds": [
        5
      ]
    },
    "en": {
      "intro": "Beard grey blending tones the hair with a colour product, with the shade and level of coverage selected for your goal.",
      "choice": "Choose it to soften the contrast of grey hair or cover it more noticeably. It changes colour; discuss beard trimming separately.",
      "preparation": "Explain whether you want to keep some grey and how natural the result should look. Confirm the service scope, preparation and product requirements before booking.",
      "result": "Agree on the shade and intensity. Hlib explains that frequent washing makes the colour fade faster and recommends beard shampoo. Ask for care advice suited to the selected product.",
      "faq": [
        {
          "question": "Does all the grey have to be covered?",
          "answer": "No. Hlib explains that the hair can be softly toned for a natural result or covered more strongly, depending on the goal and shade."
        },
        {
          "question": "Is a beard trim included?",
          "answer": "Confirm the scope of your chosen barber’s offer before booking. If you also need the beard’s length and shape changed, agree on that alongside the colour service."
        },
        {
          "question": "How long does the colour last?",
          "answer": "A fixed duration is not guaranteed: Hlib confirmed that washing frequency affects fading. Discuss the expected result and care with your barber."
        }
      ],
      "relatedServiceIds": [
        5
      ]
    }
  },
  "8": {
    "uk": {
      "intro": "Окрема укладка волосся перед подією: миття голови та робота феном, гребінцем і засобом під тип волосся.",
      "choice": "Оберіть укладку, якщо довжину змінювати не потрібно, а хочете підготувати зачіску до весілля, зустрічі чи іншої події. Якщо форма потребує стрижки, оберіть відповідну послугу.",
      "preparation": "Повідомте, до якого часу потрібно бути готовим, і покажіть бажаний образ. Ранній візит перед подією узгоджуйте заздалегідь — поза графіком не обіцяємо.",
      "result": "Глеб радить укладати волосся безпосередньо перед подією. Обговоріть засіб і бажаний результат; можливість та час візиту перевірте у вибраного барбера.",
      "faq": [
        {
          "question": "Чи можна прийти тільки на укладку?",
          "answer": "Так, у каталозі є окрема послуга укладки з миттям голови, феном, гребінцем і підібраними засобами."
        },
        {
          "question": "Чи входить сюди стрижка?",
          "answer": "Укладка не змінює довжину стрижкою. Якщо потрібно оновити форму, оберіть послугу стрижки."
        }
      ],
      "relatedServiceIds": [
        7
      ]
    },
    "en": {
      "intro": "A separate hair styling appointment before an event: washing, blow-drying, a comb and products selected for your hair type.",
      "choice": "Choose styling when the length does not need changing and you want your hair prepared for a wedding, meeting or other event. Book a haircut if the shape also needs work.",
      "preparation": "Say when you need to be ready and show the look you want. Arrange an early visit in advance; appointments outside published hours are not guaranteed.",
      "result": "Hlib recommends styling shortly before the event. Discuss the product and result, and check appointment availability with your chosen barber.",
      "faq": [
        {
          "question": "Can I visit just for styling?",
          "answer": "Yes. The catalog lists a separate styling service with washing, blow-drying, a comb and selected products."
        },
        {
          "question": "Is a haircut included?",
          "answer": "Styling does not cut the hair to change its length. Choose a haircut service if you need the shape refreshed."
        }
      ],
      "relatedServiceIds": [
        7
      ]
    }
  },
  "15": {
    "uk": {
      "intro": "Один візит для короткої стрижки голови під насадки та оформлення бороди.",
      "choice": "Оберіть цей комплекс, якщо потрібно попрацювати з обома зонами. Для fade або роботи ножицями на голові оберіть «Стрижка + борода».",
      "preparation": "Підготуйте побажання до волосся та бороди окремо: довжина, переходи, густота, контури. Покажіть референс або поясніть, що хочете змінити в поточній формі.",
      "result": "Глеб підтвердив, що робота з бородою в обох його комплексах однакова за принципом вибору під задачу. Узгодьте контури й обсяг із вибраним майстром; гаряче полотенце не слід вважати обов’язковим для кожного візиту.",
      "faq": [
        {
          "question": "Чим відрізняються два комплекси?",
          "answer": "Способом стрижки волосся на голові: звичайна стрижка або проста машинка під насадки. Глеб пояснив, що принцип роботи з бородою в його комплексах однаковий."
        },
        {
          "question": "Чи можна записатися на комплекс, якщо потрібна тільки борода?",
          "answer": "Для роботи лише з бородою оберіть «Стрижка бороди». Так запис відповідатиме потрібній послузі."
        }
      ],
      "relatedServiceIds": [
        7,
        4,
        5
      ]
    },
    "en": {
      "intro": "One visit for a short guard-length clipper cut and beard shaping.",
      "choice": "Choose this when both areas need attention. For a fade or scissor work on the head, choose Haircut + beard trim.",
      "preparation": "Think about hair and beard preferences separately: lengths, transitions, fullness and outlines. Bring a reference or explain what you want to change.",
      "result": "Hlib confirmed that he approaches beard work in both of his combined services according to the same individual task. Agree on outlines and scope with your barber; a hot towel is not an automatic part of every visit.",
      "faq": [
        {
          "question": "What is different about the two combined services?",
          "answer": "The cutting method on the head: a full haircut or a simple guard-length clipper cut. Hlib says he approaches the beard work in both of his combined services in the same way."
        },
        {
          "question": "Should I book a combined appointment for beard work only?",
          "answer": "Choose Beard trim if only your beard needs work, so the booking matches the service you need."
        }
      ],
      "relatedServiceIds": [
        7,
        4,
        5
      ]
    }
  }
}

export const serviceGuide = (baseServiceId: number | null | undefined, name: string | null | undefined, locale: string): ServiceGuide | null => {
  if (!baseServiceId || !hasServiceGuide(baseServiceId, name)) return null
  return guides[baseServiceId]?.[locale === 'en' ? 'en' : 'uk'] ?? null
}
