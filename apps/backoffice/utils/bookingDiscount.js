export const validateBookingDiscountAmount = (discountAmount, subtotalAmount) => {
  if (discountAmount === '' || discountAmount === null || discountAmount === undefined) {
    return 'Вкажіть суму знижки.'
  }

  const discount = Number(discountAmount)
  const subtotal = Number(subtotalAmount)

  if (!Number.isFinite(discount)) return 'Вкажіть суму знижки.'
  if (!Number.isInteger(discount)) return 'Знижка має бути вказана цілим числом гривень.'
  if (discount < 0) return 'Знижка не може бути від’ємною.'
  if (!Number.isFinite(subtotal) || subtotal < 0) return 'Не вдалося визначити вартість послуг.'
  if (discount > subtotal) return 'Знижка не може перевищувати вартість послуг.'

  return ''
}
