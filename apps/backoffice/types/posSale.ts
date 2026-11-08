export interface PosCapabilities {
  mode: 'mono_checkbox'; currency: 'UAH'; max_quantity: 1
  cart_limits?: { max_items: number; max_quantity: number }
  can_search: boolean; can_start: boolean; can_view_admin_sales: boolean
  automatic_reconciliation_enabled: boolean; poll_after_ms: number; blocking_reasons: string[]
}
export interface PosOffer {
  id: number; name: string; brand_name: string | null; sku: string | null; barcode: string | null
  image_url: string | null; variant_label: string | null; amount_minor: number; currency: 'UAH'
  available_quantity: number; can_sell: boolean; blocking_reasons: string[]
}
export interface PosPage<T> { items: T[]; total: number; page: number; page_size: number }
export interface PosCreate { intent_id: string; product_id: number; quantity: 1; expected_amount_minor: number; currency: 'UAH' }
export interface PosCartRequest {
  items: { product_id: number; quantity: number }[]
  promo_code: string | null
  promotion_id?: number | null
}
export interface PosCartCreate extends PosCartRequest {
  intent_id: string
  quote_revision: string
  currency: 'UAH'
}
export interface PosCartPromotion { id: number; name: string; product_ids: number[] }
export interface PosCartQuote {
  items: {
    product_id: number; quantity: number; base_unit_minor: number; unit_minor: number
    promotion_id: number | null; promotion_name: string | null; promotion_code: string | null
    discount_source: 'automatic' | 'selected_promotion' | 'promo_code' | null
    subtotal_minor: number; discount_minor: number; amount_minor: number
  }[]
  subtotal_minor: number
  discount_minor: number
  amount_minor: number
  applied_promo_code: string | null
  promotion_id: number | null
  available_promotions: PosCartPromotion[]
  quote_revision: string
  currency: 'UAH'
}
export interface PosCheckout {
  checkout_id: string; intent_id: string; order_id: number; revision: number; created_at: string
  employee: { user_id: number; master_id: number | null; display_name: string }
  items: { product_id: number; name: string; sku: string | null; barcode: string | null; image_url: string | null; variant_label: string | null; quantity: number; unit_minor: number; total_minor: number }[]
  order_status: 'pending' | 'confirmed' | 'paid' | 'completed' | 'cancelled'
  amount_minor: number; currency: 'UAH'
  status: 'prepared' | 'creating_invoice' | 'awaiting_payment' | 'payment_processing' | 'paid_receipt_pending' | 'ready_to_handover' | 'completed' | 'requires_review'
  payment: { provider: 'monobank'; status: 'not_started' | 'pending' | 'processing' | 'paid' | 'failed' | 'expired' | 'reversed' | 'unknown'; invoice_id: string | null; confirmed_at: string | null; qr_payload: string | null }
  receipt: { issuer: 'checkbox'; status: 'not_requested' | 'pending' | 'accepted' | 'failed' | 'requires_review'; recorded_at: string | null; pdf_url: string | null }
  handover: { status: 'not_ready' | 'ready' | 'handed_over'; actor_user_id: number | null; handed_over_at: string | null }
  actions: { can_resume: boolean; can_refresh: boolean; can_handover: boolean; can_recover_invoice: boolean; can_start_new: boolean }
  poll_after_ms: number; blocking_reasons: string[]
}

export interface PosSaleSummary {
 order_id: number; checkout_id: string | null; intent_id: string | null; created_at: string; employee: PosCheckout['employee']; items: { product_id: number; name: string; sku: string | null; quantity: number; unit_minor: number; total_minor: number }[]; amount_minor: number; currency: 'UAH'; order_status: PosCheckout['order_status']; status: PosCheckout['status']; payment_status: PosCheckout['payment']['status']; receipt_status: PosCheckout['receipt']['status']; handover_status: PosCheckout['handover']['status']; source: 'quick_pos' | 'existing_mono_pos'
}
export interface PosSaleDetail extends PosSaleSummary { payment: PosCheckout['payment']; receipt: PosCheckout['receipt']; handover: PosCheckout['handover']; actions: PosCheckout['actions'] }
