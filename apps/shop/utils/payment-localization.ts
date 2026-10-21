export const paymentCopy = {
  uk: {
    option: 'Онлайн карткою', statusPage: 'Сторінка статусу оплати',
    title: 'Оплата замовлення', description: 'Захищений статус оплати замовлення', unavailable: 'Замовлення недоступне.',
    label: 'Онлайн-оплата', heading: 'Онлайн-оплата карткою', create: 'Створити посилання на оплату',
    pay: 'Перейти до оплати', receipt: 'Переглянути фіскальний чек', refresh: 'Оновити статус оплати',
    updateError: 'Не вдалося оновити оплату. Спробуйте ще раз.',
    statuses: { not_started: 'Оплату ще не розпочато', creation_unknown: 'Уточнюємо стан оплати', waiting: 'Очікуємо оплату', paid_receipt_pending: 'Оплату отримано. Готуємо чек.', accepted: 'Оплату прийнято, чек готовий', requires_review: 'Стан оплати потребує уточнення' },
  },
  en: {
    option: 'Pay online by card', statusPage: 'Payment status page',
    title: 'Order payment', description: 'Secure order payment status', unavailable: 'This order is unavailable.',
    label: 'Online payment', heading: 'Pay online by card', create: 'Create a payment link',
    pay: 'Proceed to payment', receipt: 'View fiscal receipt', refresh: 'Refresh payment status',
    updateError: 'Could not update the payment. Please try again.',
    statuses: { not_started: 'Payment has not started', creation_unknown: 'Checking payment status', waiting: 'Awaiting payment', paid_receipt_pending: 'Payment received. Preparing the receipt.', accepted: 'Payment accepted. Receipt is ready', requires_review: 'Payment status needs review' },
  },
} as const
