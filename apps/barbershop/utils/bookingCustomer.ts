export interface SavedBookingCustomer {
  name: string
  phone: string
}

type BookingCustomerStorage = Pick<Storage, 'getItem' | 'setItem'>

export const BOOKING_CUSTOMER_STORAGE_KEY = 'soulcuts.booking-customer.v1'
export const BOOKING_CUSTOMER_UPDATED_EVENT = 'soulcuts:booking-customer-updated'

const isSavedBookingCustomer = (value: unknown): value is SavedBookingCustomer => {
  if (!value || typeof value !== 'object') return false

  const customer = value as Partial<SavedBookingCustomer>
  return typeof customer.name === 'string'
    && customer.name.trim().length >= 2
    && customer.name.length <= 120
    && typeof customer.phone === 'string'
    && /^\+380\d{9}$/.test(customer.phone)
}

export const readSavedBookingCustomer = (
  storage: BookingCustomerStorage,
): SavedBookingCustomer | null => {
  try {
    const stored = storage.getItem(BOOKING_CUSTOMER_STORAGE_KEY)
    if (!stored) return null

    const customer: unknown = JSON.parse(stored)
    return isSavedBookingCustomer(customer)
      ? { name: customer.name.trim(), phone: customer.phone }
      : null
  }
  catch {
    return null
  }
}

export const saveBookingCustomer = (
  storage: BookingCustomerStorage,
  customer: SavedBookingCustomer,
) => {
  try {
    storage.setItem(BOOKING_CUSTOMER_STORAGE_KEY, JSON.stringify(customer))
    return true
  }
  catch {
    // Storage can be unavailable or full; a successful booking must stay successful.
    return false
  }
}
