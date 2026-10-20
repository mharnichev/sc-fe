import type { OrderDto, CustomerOrderDto } from '@shared-types'

export interface CheckoutOrderRequest {
  firstName: string
  lastName: string
  email?: string
  phoneNumber: string
  shippingCompany: string
  shippingMethod: string
  shippingArea: string
  shippingCity: string
  shippingWarehouseNumber: string
  shippingStreet: string
  buildingNumber: string
  shippingApartment: string
  paymentMethod: string
  comment: string
  shippingSettlementRef?: string
  shippingCityRef?: string
  shippingWarehouseRef?: string
  shippingStreetRef?: string
  shipping_payload_json?: Record<string, unknown>
  items: Array<{ product_id: number, quantity: number }>
}

export interface PreliminaryDocument {
  id: number
  number: string
  version: number
  document_kind: 'preliminary'
  created_at: string
  print_url: string
}

export interface CustomerShipment {
  id: number, tracking_number: string | null, status: string, simulation: boolean,
  carrier: string, last_checked_at: string | null
  delivery_status?: string
  provider_event_at?: string | null
  last_successful_check_at?: string | null
  stale?: boolean
  last_attempt_status?: 'never' | 'success' | 'error'
  return_of_shipment_id?: number | null
  items?: Array<{ order_item_id: number, quantity: number }> | null
  events?: Array<{ raw_status: string, normalized_status: string, event_at: string | null, observed_at: string }>
}
export interface OrderProjections {
  shipments?: CustomerShipment[]
  delivery_summary?: Record<string, number>
  guest_tracking_url?: string | null
  channel?: 'shop' | 'backoffice_pos' | null
  fulfillment_method?: 'pickup' | 'nova_poshta' | null
  revision?: number
  payment_status?: string
  payment_channel?: string | null
  fulfillment_status?: string
  fiscal_status?: string
  receipt_delivery_status?: string
  preliminary_documents?: PreliminaryDocument[]
}
export type CheckoutOrder = OrderDto & OrderProjections & { guest_payment_token?: string | null, payment_method?: string }
export type CustomerOrder = Omit<CustomerOrderDto, 'items'> & OrderProjections & {
  items: Array<CustomerOrderDto['items'][number] & { product_image_url?: string | null }>
}

export interface TrackingRefreshResponse {
  status: 'queued' | 'cooldown' | 'disabled' | 'no_real_shipments'
  retry_after_seconds: number
}

export interface OnlinePayment {
  order_id: number
  enabled: boolean
  status: 'not_started' | 'creation_unknown' | 'waiting' | 'paid_receipt_pending' | 'accepted' | 'requires_review'
  paid: boolean
  receipt_accepted: boolean
  page_url: string | null
  receipt_url: string | null
  amount_minor: number
  currency: 'UAH'
  retry_after_seconds: number
}
