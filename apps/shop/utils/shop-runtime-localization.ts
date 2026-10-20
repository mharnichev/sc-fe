import { shopTerms } from '~/data/locale'

export const shopRuntimeCopy = {
  uk: {
    trackingTitle: 'Захищений статус доставки', trackingDescription: 'Статус доставки замовлення',
    trackingHeading: 'Статус доставки', loading: 'Завантаження…',
    trackingUnavailable: 'Посилання недоступне або строк його дії закінчився.',
    noShipments: 'Відправлення ще не підготовлено.', refreshTracking: 'Оновити статус',
    documentsLabel: 'Документи замовлення', documentsTitle: 'Документи',
    preliminaryNotice: 'Попереднє замовлення. Не є фіскальним чеком',
    noDocument: 'Попередній документ ще не створено.', version: 'версія', print: 'Перегляд / друк',
    allowPopup: 'Дозвольте відкриття вікна для перегляду документа.',
    documentUnavailable: 'Не вдалося відкрити документ. Посилання могло втратити чинність.',
    restoreOrder: 'Не вдалося відновити запит замовлення.',
    allowStorage: 'Дозвольте збереження сесії браузера для безпечного оформлення замовлення.',
    cartPreserved: 'Замовлення підтверджено. Після повторної перевірки кошик залишено без змін, щоб зберегти додані вами товари. Перегляньте його перед наступним замовленням.',
    otherSession: 'Є непідтверджений запит в іншій сесії покупця. Поверніться до початкового облікового запису (або гостьового режиму), щоб безпечно перевірити результат.',
    retryNotice: 'Результат попереднього запиту ще не підтверджено. Повторна перевірка використовує той самий запит і не створює друге замовлення.',
    retryOrder: 'Перевірити / повторити попереднє замовлення',
    unknownPayment: 'Інший спосіб оплати', unknownDelivery: 'Інший спосіб доставки',
    card: 'Банківська картка', cash: 'Готівка', pickup: 'Самовивіз', novaPost: 'Нова пошта',
    unknownCarrier: 'Служба доставки', genericError: 'Не вдалося виконати дію. Спробуйте ще раз.',
  },
  en: {
    trackingTitle: 'Secure delivery tracking', trackingDescription: 'Order delivery status',
    trackingHeading: 'Delivery status', loading: 'Loading…',
    trackingUnavailable: 'This link is unavailable or has expired.',
    noShipments: 'The shipment has not been prepared yet.', refreshTracking: 'Refresh status',
    documentsLabel: 'Order documents', documentsTitle: 'Documents',
    preliminaryNotice: 'Preliminary order. This is not a fiscal receipt',
    noDocument: 'The preliminary document has not been created yet.', version: 'version', print: 'View / print',
    allowPopup: 'Allow pop-up windows to view this document.',
    documentUnavailable: 'Could not open the document. The link may have expired.',
    restoreOrder: 'Could not restore the order request.',
    allowStorage: 'Allow browser session storage to place your order safely.',
    cartPreserved: 'Your order is confirmed. After checking again, your cart was kept unchanged to preserve the items you added. Review it before placing your next order.',
    otherSession: 'An unconfirmed request belongs to another customer session. Return to the original account or guest session to check the result safely.',
    retryNotice: 'The previous request has not been confirmed yet. Checking again uses the same request and does not create a second order.',
    retryOrder: 'Check / retry the previous order',
    unknownPayment: 'Other payment method', unknownDelivery: 'Other delivery method',
    card: 'Bank card', cash: 'Cash', pickup: 'Pickup', novaPost: 'Nova Poshta',
    unknownCarrier: 'Delivery service', genericError: 'Could not complete this action. Please try again.',
  },
} as const

const validationMessages: Array<readonly [string, string]> = [
  ['Посилання MOCK недоступне, відкликане або строк його дії закінчився.', 'This MOCK link is unavailable, revoked or expired.'],
  ['Не вдалося завантажити довідник.', 'Could not load the directory.'],
  ['Не вдалося видалити товар із кошика.', 'Could not remove server cart item.'],
  ['Не вдалося завантажити кошик.', 'Could not load server cart.'],
  ['Не вдалося об’єднати кошик.', 'Could not merge cart.'],
  ['Не вдалося надіслати код.', 'Could not send OTP code.'],
  ['Не вдалося перевірити код.', 'Could not verify OTP code.'],
  ['Не вдалося оновити список бажань.', 'Could not update server wishlist.'],
  ['Не вдалося видалити товар зі списку бажань.', 'Could not remove server wishlist item.'],
  ['Не вдалося завантажити список бажань.', 'Could not load server wishlist.'],
  ['Не вдалося об’єднати список бажань.', 'Could not merge wishlist.'],
  ['Некоректний email.', 'Invalid email.'],
  ['Перевірте заповнення та довжину поля.', 'Check the field value and length.'],
  ['Вкажіть коректне ім’я.', 'Enter a valid name.'],
  ['Вкажіть коректний email.', 'Enter a valid email.'],
  ['Вкажіть коректний телефон: 10–15 цифр.', 'Enter a valid phone number: 10–15 digits.'],
  ['Код має містити 6 цифр.', 'The code must contain 6 digits.'],
  ['Перевірте текст: він закороткий або містить забагато повторів чи посилань.', 'Check the text: it is too short or contains too many repetitions or links.'],
  ['Вкажіть коректну дату народження.', 'Enter a valid date of birth.'],
  ['Ім’я має містити щонайменше 2 символи.', 'The name must contain at least 2 characters.'],
  ['Некоректна оцінка.', 'Invalid rating.'],
]
const messagePairs: Array<readonly [string, string]> = [...validationMessages]
const collectPairs = (uk: unknown, en: unknown) => {
  if (typeof uk === 'string' && typeof en === 'string') { messagePairs.push([uk, en]); return }
  if (!uk || !en || typeof uk !== 'object' || typeof en !== 'object') return
  for (const key of Object.keys(uk)) collectPairs((uk as Record<string, unknown>)[key], (en as Record<string, unknown>)[key])
}
collectPairs(shopTerms.uk, shopTerms.en)
collectPairs(shopRuntimeCopy.uk, shopRuntimeCopy.en)

/** Translate recognized interface errors without changing their stored value. */
export const localizedShopMessage = (message: string, locale: string): string => {
  if (!message) return ''
  const pair = messagePairs.find(pair => pair.includes(message))
  if (pair) return pair[locale === 'en' ? 1 : 0]
  return locale === 'en' && /[А-Яа-яІіЇїЄєҐґ]/.test(message) ? shopRuntimeCopy.en.genericError : message
}

export interface LocalizedOrderItem {
  product_name?: string | null
  product_name_en?: string | null
  product_id?: number
}
export const localizedOrderItemName = (item: LocalizedOrderItem, locale: string): string =>
  (locale === 'en' && item.product_name_en?.trim() ? item.product_name_en : item.product_name)
  || `${locale === 'en' ? 'Product' : 'Товар'} #${item.product_id ?? ''}`
