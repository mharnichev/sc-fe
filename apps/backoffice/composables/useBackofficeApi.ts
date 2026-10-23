import type {
  CustomerSegment, SegmentList, SegmentCreate, SegmentUpdate, SegmentMemberQuery,
  SegmentPreviewRequest, SegmentPreviewResponse, CampaignAudiencePreview,
  CampaignRun, CampaignRunCreate, CampaignRunDetail, CampaignRunMember,
} from '~/types/segments'
import type {
  AudienceEstimate,
  AudienceRule,
  CampaignPayload,
  CustomerCommunicationProfile,
  MessageRecipient,
  MessageTemplate,
  MessageTemplatePayload,
  MessagingCampaign,
  MessagingDashboard,
  MessagingSettings,
  RecipientPreview,
  SendLog,
} from '~/types/messaging'
import type {
  BookingReviewDetail,
  BookingReviewSummary,
  MasterRatingStatistics,
  ReviewFilters,
  ReviewRequestSettings,
  ReviewRequestSettingsUpdate,
} from '~/types/reviews'
import type {
  InventoryCount,
  InventoryCountCreate,
  InventoryCountItemUpsert,
  InventoryManualOperationCreate,
  InventoryMovement,
  InventoryProduct,
  InventoryProductCreate,
  InventoryReceipt,
  InventoryReceiptCreate,
  InventoryReceiptItemCreate,
  ManualInventoryOperationType,
  ProcurementQueueItem,
  ProcurementStatus,
  ProductInventorySettingsUpdate,
} from '~/types/inventory'
import { parseAdminDashboardResponse } from '~/utils/adminDashboardContract'
import { parseBookingRecoverySummary, type BookingRecoverySummary } from '~/utils/bookingRecoveryContract'
import { parseReviewMetricsResponse } from '~/utils/reviews'
import { createInventoryIdempotencyKey } from '~/utils/inventory'
import type { NewMasterCampaignInput, CampaignReadiness, CampaignOfferAnalytics, CampaignQueueProgress } from '~/types/newMaster'

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface AdminUser {
  can_manage_fiscal_settings?: boolean
  can_fiscalize_sales?: boolean
  can_fiscalize_returns?: boolean
  id: number
  email: string
  full_name?: string | null
  role?: string | null
  master_id?: number | null
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
}

export interface UploadAsset {
  id: number
  file_name: string
  file_path: string
  file_url: string | null
  content_type: string | null
  size: number | null
  created_at: string
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  is_active: boolean
  parent_id: number | null
  is_effectively_visible: boolean
  hidden_reason: 'category' | 'parent_category' | null
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[]
}

export interface Brand {
  id: number
  name: string
  slug: string
  description: string | null
  is_active: boolean
}

export interface Product {
  id: number
  created_at: string
  updated_at: string
  name: string
  model_name: string | null
  package_size: string | null
  slug: string
  description: string | null
  ingredients: string | null
  short_description: string | null
  price: string
  recommended_retail_price: string | null
  shop_price?: string | null
  sku: string | null
  stock_quantity: number
  reserved_quantity: number
  available_quantity: number
  barcode: string | null
  allow_backorder: boolean
  is_active: boolean
  image_url: string | null
  images: ProductImage[]
  display_image_url?: string | null
  display_image_urls?: string[]
  external_url: string | null
  availability_status: string | null
  attributes_json: Record<string, unknown> | null
  variant_group_key: string | null
  volume_ml: number | null
  brand_id: number | null
  category_id: number | null
  brand?: Brand | null
  category?: Category | null
  is_effectively_visible: boolean
  hidden_reason: 'product' | 'category' | 'parent_category' | null
}

export interface ProductImage {
  id: number
  product_id: number
  upload_id: number | null
  image_url: string | null
  alt: string | null
  sort_order: number
  is_active: boolean
}

export interface ProductPayload {
  name: string
  slug: string
  description: string | null
  ingredients: string | null
  short_description: string | null
  price: number
  recommended_retail_price: number | null
  shop_price?: number | null
  sku: string | null
  stock_quantity: number
  is_active: boolean
  image_url: string | null
  external_url: string | null
  availability_status: string | null
  attributes_json: Record<string, unknown> | null
  brand_id: number | null
  category_id: number | null
}

export interface FiscalMockRegister { id: string, label: string, credential_kind: 'mock', shift_status: 'closed' | 'open', shift_revision: number }
export interface FiscalMockReadiness { mode: 'mock_only', available: boolean, blocking_reasons: string[], cash_registers: FiscalMockRegister[] }
export interface FiscalMockTax { code: 'MOCK_NO_TAX', rate_basis_points: 0, amount_minor: 0 }
export interface FiscalMockSaleSnapshot {
  source?: 'mock_ettn', automation?: { id: number, provider_uuid: string, approval_snapshot_hash: string, external_id: string, shipment_id: number, tracking_number: string, condition: 'mock_delivery_confirmed' },
  document_kind: 'mock_fiscal_receipt', kind?: 'sale', simulation: true, notice: string, is_sent_dps: false, currency: 'UAH',
  order_id: number, order_revision: number, cash_register_id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: number,
  items: Array<{ order_item_id: number, product_id: number, name: string | null, sku: string | null, quantity: number, base_price_minor: number, price_minor: number, discount_minor: number, total_minor: number, tax: FiscalMockTax }>,
  subtotal_minor: number, discount_minor: number, additional_discount_minor: number, amount_minor: number,
  payment: { id: number, amount_minor: number, method: 'cash' | 'card' | 'monobank_qr', source: 'operator_confirmation' | 'provider_confirmation', simulation: true },
  taxes: FiscalMockTax[], tax_mapping: 'mock_only_no_legal_tax_claim', delivery_channel: 'local_display_print'
}
export interface FiscalMockReturnSnapshot {
  document_kind: 'mock_fiscal_receipt', kind: 'return', simulation: true, notice: string, is_sent_dps: false, currency: 'UAH',
  order_id: number, return_id: number, parent_sale_id: number, parent_sale_hash: string, refund_id: number,
  cash_register_id: 'MOCK-KASA-1', credential_kind: 'mock', shift_revision: number,
  items: MockReturnItem[], amount_minor: number,
  payment: { id: number, amount_minor: number, method: 'cash' | 'card' | 'monobank_qr', simulation: true }, delivery_channel: 'local_display_print'
}
export type FiscalMockSnapshot = FiscalMockSaleSnapshot | FiscalMockReturnSnapshot
export type MockCaseType = 'automation_receipt_missing' | 'payments_without_receipts' | 'receipts_without_basis' | 'unknown' | 'refund_pending' | 'fiscal_return_pending' | 'receipt_pending' | 'open_shifts'
export interface MockReconciliationAck { id: number, case_type: MockCaseType, resource_id: string, evidence: string, actor_id: number, created_at: string }
export interface MockReconciliation { simulation: true, notice: string, buckets: Record<MockCaseType, Array<{ resource_id: string, order_id: number | null, amount_minor: number, acknowledgements: MockReconciliationAck[] }>>, totals: { sales_minor: number, reserved_returns_minor: number, refunds_minor: number, fiscal_returns_minor: number }, acknowledgements: MockReconciliationAck[] }
export interface MockFiscalReport { id: number, kind: 'x' | 'z', cash_register_id: string, shift_revision: number, totals: { sale_count: number, return_count: number, sales_minor: number, returns_minor: number, net_minor: number, document_ids: number[] }, created_at: string, simulation: true, notice: string }
export interface MockFiscalShare { document_id: number, generation: number, url: string | null, expires_at: string | null, revoked: boolean }
export interface MockReturnItem { order_item_id: number, product_id: number, name: string | null, quantity: number, total_minor: number }
export interface MockReturnCreate { parent_sale_id: number, items: Array<{ order_item_id: number, quantity: number }>, reason: string }
export interface MockReturnRefund { method?: 'cash' | 'card' | 'monobank_qr', evidence: string }
export interface MockReturnReceipt { items: Array<{ order_item_id: number, quantity: number, disposition: 'restock' | 'not_restock' }>, evidence: string }
export interface MockReturn {
  id: number, order_id: number, parent_sale_id: number, amount_minor: number, currency: 'UAH', items: MockReturnItem[], reason: string, simulation: true, created_at: string,
  refund: { id: number, amount_minor: number, method: 'cash' | 'card' | 'monobank_qr', evidence: string, operator_id: number, created_at: string } | null,
  receipt: { id: number, items: MockReturnReceipt['items'], evidence: string, operator_id: number, created_at: string } | null,
  fiscal_document_ids: number[], allowed_actions: string[], blocking_reasons: string[]
}
export interface FiscalMockPreview {
  kind?: 'sale' | 'return', parent_sale_id?: number | null, return_id?: number | null,
  id: number, order_id: number, revision: number, snapshot_hash: string, cash_register_id: string, shift_revision: number,
  expires_at: string, snapshot: FiscalMockSnapshot, simulation: true, document_kind: 'mock_fiscal_receipt', is_sent_dps: false,
  allowed_actions: string[], blocking_reasons: string[]
}
export interface FiscalMockSubmission { preview_id: number, expected_revision: number, snapshot_hash: string, cash_register_id: string, confirm: true, mock_outcome?: 'accepted' | 'timeout_after_acceptance' }
export interface FiscalMockDocument {
  automation_id: number | null, source: 'manual' | 'automation' | 'qr', qr_attempt_id?: number | null,
  kind?: 'sale' | 'return', parent_sale_id?: number | null, return_id?: number | null,
  id: number, order_id: number, status: 'queued' | 'submitting' | 'unknown' | 'processing' | 'issued' | 'cancelled' | 'error',
  revision: number, simulation: true, document_kind: 'mock_fiscal_receipt', provider_uuid: string, is_sent_dps: false,
  cash_register_id: string, shift_revision: number, snapshot_hash: string, snapshot: FiscalMockSnapshot,
  delivery: { status: 'pending_document' | 'queued' | 'delivered' | 'failed', channel: 'local_display_print', attempts: number, last_error: string | null },
  allowed_actions: string[], blocking_reasons: string[], print_url: string | null
}
export interface FiscalMockDocumentCommand { expected_revision: number, mock_delivery_outcome?: 'delivered' | 'failed', mock_outcome?: 'delivered' | 'failed' }

export type EttnMockOutcome = 'accepted' | 'timeout_before_acceptance' | 'timeout_after_acceptance'
export interface EttnMockSafety { mode: 'mock_only', provider_contract: 'unknown', simulation: true, is_sent_dps: false, notice: string }
export interface EttnMockSnapshot { amount_minor: number, tracking_number: string, shipment_id: number, condition: 'mock_delivery_confirmed', [key: string]: unknown }
export interface EttnMockPreview extends EttnMockSafety {
  id: number, order_id: number, revision: number, cash_register_id: string, shift_revision: number,
  snapshot_hash: string, snapshot: EttnMockSnapshot, expires_at: string, allowed_actions: string[], blocking_reasons: string[]
}
export interface EttnMockProject extends EttnMockSafety {
  fiscal_document_id: number | null,
  id: number, order_id: number, payment_id: number, shipment_id: number, tracking_number: string,
  status: 'queued' | 'unknown' | 'armed' | 'cancel_pending' | 'cancel_unknown' | 'cancelled' | 'issued' | 'error', revision: number,
  provider_uuid: string, external_id: string | null, cash_register_id: string, shift_revision: number,
  condition: 'mock_delivery_confirmed', snapshot_hash: string, snapshot: EttnMockSnapshot, approved_at: string,
  dispatched_at: string | null, cancellation_confirmed_at: string | null, result: Record<string, unknown> | null,
  allowed_actions: string[], blocking_reasons: string[]
}
export interface EttnMockList extends EttnMockSafety { available: boolean, owner: 'sc_manual' | 'checkbox_ettn' | null, allowed_actions: string[], blocking_reasons: string[], items: EttnMockProject[] }
export interface EttnMockPrepare { shipment_id: number, cash_register_id: string, condition: 'mock_delivery_confirmed' }
export interface EttnMockApproval { preview_id: number, expected_revision: number, snapshot_hash: string, cash_register_id: string, confirm: true, mock_outcome: EttnMockOutcome }
export interface EttnMockCommand { expected_revision: number, mock_outcome?: 'confirmed' | 'timeout_before_acceptance' | 'timeout_after_acceptance' }

export interface PreliminaryOrderDocument {
  id: number
  number: string
  version: number
  document_kind: 'preliminary'
  created_at: string
  print_url: string
}
export type QrMockOutcome = 'success' | 'decline' | 'expiry' | 'processing' | 'hold' | 'timeout_after_acceptance' | 'success_receipt_error' | 'success_receipt_pending' | 'receipt_issued'
export interface QrMockReadiness { mode: 'mock_only', available: boolean, blocking_reasons: string[], cash_registers: FiscalMockRegister[] }
export interface ProviderSandboxVerification {
  monobank_policy?: 'operator_attested_test_token_with_pinned_sha256', monobank_provider_confirmed?: false,
  checkbox_provider_confirmed?: boolean, provider_confirmed?: false, shift_id?: string, [key: string]: unknown
}
export interface ProviderSandboxReadiness {
  mode: 'provider_sandbox', available: boolean, blocking_reasons: string[], verification: ProviderSandboxVerification,
  checkbox_cash_register_id?: string | null, checkbox_cashier_id?: string | null, checkbox_organization_id?: string | null
}
export interface MasterMonoState {
  order_id: number
  revision: number
  mode: 'mono_checkbox'
  enabled: boolean
  paid: boolean
  receipt_accepted: boolean
  status: string
  amount_minor: number
  invoice_id: string | null
  payment_url: string | null
  receipt_pdf_path: string | null
  can_handover: boolean
  blocking_reasons: string[]
}
export interface MasterMonoCommand { expected_revision: number }
export interface QrMockCreate { expected_revision: number, confirm: true, cash_register_id: string }
export interface QrMockAttempt {
  id: number, order_id: number, revision: number, provider_invoice_id: string,
  payment_status: 'waiting' | 'processing' | 'unknown' | 'paid' | 'declined' | 'expired' | 'cancelled',
  receipt_status: 'pending' | 'issued' | 'error', amount_minor: number, currency: 'UAH', expires_at: string,
  snapshot: { items?: Array<{ order_item_id: number, name?: string, product_id: number, quantity: number, total_minor: number }>, [key: string]: unknown },
  local_payment_path: string, payment_url?: string | null, checkbox_receipt_id?: string | null, verification?: ProviderSandboxVerification | null, payment_id: number | null, fiscal_document_id: number | null, receipt_url?: string | null,
  allowed_actions: string[], blocking_reasons: string[], mode: 'mock_only' | 'provider_sandbox', simulation: true
}
export interface QrMockCommand { expected_revision: number, event_id?: string, outcome?: QrMockOutcome }
export interface PosCapabilities {
  live_qr_available: boolean
  mode: string
  can_prepare: boolean
  simulation_available: boolean
  blocking_reasons: string[]
}
export interface PosOrderCreate {
  items: { product_id: number, quantity: number }[]
  customer_name?: string
  customer_phone?: string
  promo_code?: string
  fulfillment_method: 'pickup'
  simulation: boolean
}
export interface OrderSalesActions {
  can_record_payment: boolean
  can_handover: boolean
  blocking_reasons: string[]
}
export interface OrderPaymentCommand {
  expected_revision: number
  amount_minor: number
  method: 'cash' | 'card'
  source: 'operator_confirmation'
  evidence: string
}
export interface OrderHandoverCommand { expected_revision: number, evidence: string }
export interface ShipmentPackaging {
  weight_kg: number, length_cm: number, width_cm: number, height_cm: number, places: number,
  payer: 'sender' | 'recipient', declared_value_minor: number, cod_amount_minor: number
}
export interface ShipmentAddress { shippingCityRef: string, shippingWarehouseRef?: string, shippingStreetRef?: string, cityLabel: string, warehouseLabel?: string, streetLabel?: string, buildingNumber?: string, shippingApartment?: string }
export interface ShipmentCreateCommand {
  address_snapshot?: ShipmentAddress
  expected_revision: number, source: 'create' | 'attach', packaging: ShipmentPackaging, tracking_number?: string
}
export interface ShipmentCommand { expected_revision: number, mock_status?: string, evidence?: string }
export interface ShipmentSettlement {
  mode: 'mock_only', available: boolean, order_id: number, shipment_id: number, tracking_number: string,
  revision: number, amount_minor: number,
  cod_payment: { id: number, payment_id: number, amount_minor: number, provider_event_id: string, evidence: string, operator_id: number, created_at: string } | null,
  return_receipt: { id: number, tracking_number: string, evidence: string, operator_id: number, created_at: string, items: Array<{ order_item_id: number, quantity: number, disposition: 'restock' | 'not_restock' }> } | null,
  items: Array<{ order_item_id: number, product_id: number, name: string | null, quantity: number }>,
  allowed_actions: Array<'confirm_cod' | 'receive_return' | 'create_return_shipment'>, blocking_reasons: string[]
}
export interface ShipmentCodCommand { expected_revision: number, provider_event_id: string, evidence: string, confirm: true }
export interface ShipmentReturnReceiptCommand {
  expected_revision: number, evidence: string, confirm: true,
  items: Array<{ order_item_id: number, quantity: number, disposition: 'restock' | 'not_restock' }>
}
export interface ShipmentReturnCommand { expected_revision: number, evidence: string, confirm: true, items?: Array<{ order_item_id: number, quantity: number }> }
export interface Shipment {
  id: number, tracking_number: string | null, status: string, simulation: boolean, carrier: string,
  last_checked_at: string | null, active: boolean, source: string, raw_status: string,
  address_snapshot?: Record<string, unknown>, packaging?: Record<string, unknown>,
  handed_over_at: string | null, label_url?: string | null,
  events: Array<{ operation: string, raw_status: string, normalized_status: string, outcome: string, created_at: string }>
}
export interface ShipmentActions { mode: string, can_manage: boolean, can_create: boolean, simulation_available: boolean, can_handover: boolean, blocking_reasons: string[] }
export interface OrderProjections {
  shipments?: Shipment[]
  shipment_actions?: ShipmentActions
  simulation?: boolean
  sales_actions?: OrderSalesActions
  channel?: string | null
  fulfillment_method?: string | null
  revision?: number
  payment_status?: string
  payment_channel?: 'online_monobank' | null
  fulfillment_status?: string
  fiscal_status?: string
  receipt_delivery_status?: string
  preliminary_documents?: PreliminaryOrderDocument[]
}

export interface OrderSummary extends OrderProjections {
  id: number
  status: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  subtotal_amount: string
  discount_amount: string
  promo_code: string | null
  shipping_company?: string | null
  shipping_method?: string | null
  shipping_city?: string | null
  payment_method?: string | null
  external_sync_status?: string | null
  total_amount: string
  created_at: string
  updated_at: string
}

export interface OrderItemResponse {
  product_image_url?: string | null
  product_variant?: string | null
  id: number
  product_id: number
  quantity: number
  base_price: string | null
  price: string
  discount_amount: string
  shop_promotion_id: number | null
  promotion_name: string | null
  promotion_code: string | null
  product_name: string | null
  product_sku: string | null
  total_price: string | null
  quantity_from_stock: number
  quantity_to_order: number
  quantity_received_for_order: number
  procurement_status: ProcurementStatus
}

export interface OrderPaymentFact {
  id: number, amount_minor: number, currency?: 'UAH', method: 'cash' | 'card' | 'monobank_qr', source: string, evidence: string,
  operator_id: number, simulation: boolean, created_at: string
}
export interface OrderHandoverFact { id: number, evidence: string, operator_id: number, simulation: boolean, created_at: string }
export interface OrderResponse extends OrderProjections {
  callback_requested?: boolean | null
  payments?: OrderPaymentFact[]
  handovers?: OrderHandoverFact[]
  id: number
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  comment: string | null
  first_name: string | null
  last_name: string | null
  shipping_company: string | null
  shipping_method: string | null
  shipping_area: string | null
  shipping_city: string | null
  shipping_warehouse_number: string | null
  shipping_street: string | null
  building_number: string | null
  shipping_apartment: string | null
  delivery_address: string | null
  shipping_settlement_ref?: string | null
  shipping_city_ref?: string | null
  shipping_warehouse_ref?: string | null
  shipping_street_ref?: string | null
  shipping_payload_json: Record<string, unknown> | null
  payment_method: string | null
  tracking_number: string | null
  external_id: string | null
  external_sync_status: string | null
  external_sync_error: string | null
  subtotal_amount: string
  discount_amount: string
  promo_code: string | null
  total_amount: string
  status: string
  items: OrderItemResponse[]
  created_at?: string
  updated_at?: string
}

export type ShopPromotionDiscountType = 'percent' | 'fixed_amount' | 'fixed_price'
export type ShopPromotionTrigger = 'automatic' | 'promocode'
export type ShopPromotionStatus = 'scheduled' | 'active' | 'expired' | 'disabled'

export interface ShopPromotionPayload {
  name: string
  description: string | null
  trigger: ShopPromotionTrigger
  code: string | null
  discount_type: ShopPromotionDiscountType
  discount_value: string | number
  priority: number
  starts_at: string | null
  ends_at: string | null
  usage_limit: number | null
  usage_limit_per_customer: number | null
  applies_to_all_products: boolean
  include_subcategories: boolean
  product_ids: number[]
  category_ids: number[]
  brand_ids: number[]
  is_active: boolean
}

export interface ShopPromotionResponse {
  id: number
  created_at: string
  updated_at: string
  name: string
  description: string | null
  trigger: ShopPromotionTrigger
  code: string | null
  discount_type: ShopPromotionDiscountType
  discount_value: string | number
  priority: number
  starts_at: string | null
  ends_at: string | null
  usage_limit: number | null
  usage_limit_per_customer: number | null
  applies_to_all_products: boolean
  include_subcategories: boolean
  product_ids: number[]
  category_ids: number[]
  brand_ids: number[]
  is_active: boolean
  status: ShopPromotionStatus
}

export type ShopPromotion = ShopPromotionResponse

export interface ShopPromotionPreviewPromotion {
  id: number | null
  name: string
  code: string | null
  trigger: ShopPromotionTrigger
  price: string | number
}

export interface ShopPromotionPreviewConflict {
  promotion_id: number
  name: string
  trigger: ShopPromotionTrigger
  priority: number
  price: string | number
}

export interface ShopPromotionPreviewProduct {
  product_id: number
  product_name: string
  base_price: string | number
  new_price: string | number
  discount_amount: string | number
  currently_applied_promotion: ShopPromotionPreviewPromotion | null
  applied_promotion: ShopPromotionPreviewPromotion | null
  conflicts: ShopPromotionPreviewConflict[]
}

export interface ShopPromotionPreviewResponse {
  evaluated_at: string
  affected_products_count: number
  products: ShopPromotionPreviewProduct[]
}

export interface ShopPromotionProduct {
  product_id: number
  product_name: string
  sku: string | null
  base_price: string | number
  is_effectively_visible: boolean
  hidden_reason: string | null
}

export interface ShopPromotionProductsResponse {
  affected_products_count: number
  products: ShopPromotionProduct[]
}

export interface CustomerSummary {
  id: number
  phone: string
  email: string | null
  name: string | null
  surname: string | null
  notes: string | null
  imported_total_spent: string | number
  imported_last_visit_at: string | null
  imported_is_new_client: boolean
  is_verified: boolean
  telegram_connected?: boolean
}

export interface Customer {
  id: number
  created_at: string
  updated_at: string
  phone: string
  email: string | null
  name: string | null
  surname: string | null
  birthday: string | null
  notes: string | null
  imported_total_spent: string | number
  imported_last_visit_at: string | null
  imported_is_new_client: boolean
  is_active: boolean
  phone_verified_at: string | null
  last_login_at: string | null
}

export interface CustomerUpdatePayload {
  phone: string
  name: string | null
  birthday: string | null
  notes: string | null
}

export interface CustomerBookingStatsItem {
  id: number | null
  name: string
  count: number
}

export interface CustomerBookingStats {
  total_bookings: number
  most_visited_barber: CustomerBookingStatsItem | null
  most_used_services: CustomerBookingStatsItem[]
  last_visit_date: string | null
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type MasterPosition = 'ambassador' | 'senior_master' | 'master'

export interface Master {
  id: number
  admin_user_id?: number | null
  last_name?: string | null
  first_name_uk?: string | null
  last_name_uk?: string | null
  first_name_en?: string | null
  last_name_en?: string | null
  full_name?: string | null
  full_name_uk?: string | null
  full_name_en?: string | null
  name?: string | null
  position?: MasterPosition | null
  position_uk?: string | null
  position_en?: string | null
  phone?: string | null
  email?: string | null
  telegram_chat_id?: string | null
  description?: string | null
  photo_url?: string | null
  photo_upload_id?: number | null
  photo?: string | UploadAsset | null
  avatar_url?: string | null
  avatar_upload_id?: number | null
  avatar?: string | UploadAsset | null
  passport_photo_url?: string | null
  passport_photo_upload_id?: number | null
  passport_photo?: string | UploadAsset | null
  is_active?: boolean
  showOnMasterBlock?: boolean
  show_on_master_block?: boolean
  bookingRedirectMasterId?: number | null
  booking_redirect_master_id?: number | null
  status?: string | null
  service_ids?: number[]
  services?: Service[]
}

export interface ServicePromotion {
  id: number
  code: string
  name_uk: string
  name_en: string
  discount_percent: number
  discount_amount: number | string
  promotional_price: number | string
}

export interface Service {
  id: number
  barber_id?: number | string
  base_service_id?: number | string | null
  source_type?: 'base' | 'custom'
  name: string
  title_uk?: string | null
  title_en?: string | null
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  duration_minutes: number
  price: string | number
  is_active?: boolean
  active_promotion?: ServicePromotion | null
  status?: string | null
  base_service?: BaseServiceSummary | null
}

export interface BaseServiceSummary {
  id: number | string
  name: string
  title_uk?: string | null
  title_en?: string | null
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  duration_minutes: number
  price: string | number
  is_active: boolean
}

export interface BaseService {
  id: number | string
  name: string
  title_uk?: string | null
  title_en?: string | null
  duration_minutes: number
  price: string | number
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface MasterService {
  id: number | string
  barber_id: number | string
  base_service_id?: number | string | null
  source_type: 'base' | 'custom'
  name: string
  title_uk?: string | null
  title_en?: string | null
  duration_minutes: number
  price: string | number
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  is_active: boolean
  active_promotion?: ServicePromotion | null
  base_service?: BaseServiceSummary | null
  created_at?: string
  updated_at?: string
}

export interface Booking {
  id: number
  master_id?: number
  service_id?: number
  service_ids?: number[]
  customer_id?: number | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  customer_comment?: string | null
  comment?: string | null
  note?: string | null
  start_at?: string
  end_at?: string
  scheduled_at?: string
  status: BookingStatus | string
  created_at?: string
  updated_at?: string
  cancelled_at?: string | null
  completed_at?: string | null
  master?: Master | null
  barber?: Master | null
  redirectedFromMasterId?: number | null
  redirected_from_master_id?: number | null
  redirectedFromMaster?: BookingRedirectMaster | null
  redirected_from_master?: BookingRedirectMaster | null
  service?: Service | null
  services?: Service[]
  service_prices?: Record<string, number>
  subtotal_amount?: string | number | null
  discount_amount?: string | number | null
  total_amount?: string | number | null
  promotion_id?: number | null
  promotion_code?: string | null
  promotion_name_uk?: string | null
  promotion_name_en?: string | null
  promotion_discount_percent?: number | null
  customer?: {
    id?: number
    name?: string | null
    first_name?: string | null
    surname?: string | null
    last_name?: string | null
    phone?: string | null
    email?: string | null
  } | null
}

export interface BookingRedirectMaster {
  id: number
  full_name: string
}

export interface AvailableSlot {
  start_at: string
  end_at: string
}

export interface PublicBookingPayload {
  master_id: number
  service_id: number
  service_ids?: number[]
  duration_minutes?: number
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  customer_comment?: string | null
  promotion_code?: string | null
  start_at: string
}

export interface ManualBookingPayload extends PublicBookingPayload {
  end_at: string
  note?: string | null
  status?: BookingStatus
  promotion_code?: string | null
}

export interface BookingSchedulePayload {
  start_at?: string
  end_at?: string
  service_ids?: number[]
}

export interface BookingServicePricePayload {
  service_id: number
  price_amount: number
}

export interface BookingPricingPayload {
  service_prices: BookingServicePricePayload[]
  promotion_code: string | null
}

export interface TimeBlock {
  id: number
  master_id: number
  start_at: string
  end_at: string
  reason?: string | null
  created_at?: string
  master?: Master | null
}

export interface CalendarHold {
  kind: 'waitlist_hold'
  master_id: number
  start_at: string
  end_at: string
  expires_at: string
}

export interface CalendarCapacityBooking {
  kind: 'booking'
  master_id: number
  start_at: string
  end_at: string
}

export interface MasterAvailabilityWindow {
  id: number
  master_id: number
  start_at: string
  end_at: string
  created_at?: string
  updated_at?: string
  master?: Master | null
}

export interface TimeBlockPayload {
  start_at: string
  end_at: string
  reason?: string | null
  master_id?: number
}

export interface AvailabilityWindowPayload {
  start_at: string
  end_at: string
  master_id?: number
}

export interface AvailabilityFilters {
  date_from?: string
  date_to?: string
  master_id?: number | null
}

export interface ServicePayload {
  name: string
  title_uk: string
  title_en: string
  description: string | null
  description_uk: string | null
  description_en: string | null
  duration_minutes: number
  price: number
  is_active: boolean
}

export type BaseServicePayload = ServicePayload

export type PromotionDiscountType = 'percent'
export type PromotionApplicationMode = 'code' | 'automatic'
export type PromotionEligibilityType = 'all_customers' | 'inactive_customers' | 'military_customers' | 'first_visit'

export interface Promotion {
  id: number
  created_at?: string
  updated_at?: string
  code: string
  name_uk: string
  name_en: string
  description_uk: string | null
  description_en: string | null
  discount_type: PromotionDiscountType
  discount_percent: number
  application_mode: PromotionApplicationMode
  eligibility_type: PromotionEligibilityType
  inactive_days: number | null
  starts_at: string | null
  ends_at: string | null
  applies_to_all_masters: boolean
  master_ids: number[]
  applies_to_all_services: boolean
  base_service_ids: number[]
  is_active: boolean
  is_public: boolean
  recipient_offer_only?: boolean
}

export interface PromotionPayload {
  code: string
  name_uk: string
  name_en: string
  description_uk: string | null
  description_en: string | null
  discount_type: PromotionDiscountType
  discount_percent: number
  application_mode: PromotionApplicationMode
  eligibility_type: PromotionEligibilityType
  inactive_days: number | null
  starts_at: string | null
  ends_at: string | null
  applies_to_all_masters: boolean
  master_ids: number[]
  applies_to_all_services: boolean
  base_service_ids: number[]
  is_active: boolean
  is_public: boolean
  recipient_offer_only?: boolean
}

export interface MasterServicePayload {
  base_service_id?: number | null
  name?: string
  title_uk?: string
  title_en?: string
  description?: string | null
  description_uk?: string | null
  description_en?: string | null
  duration_minutes?: number
  price?: number
  is_active?: boolean
}

export interface SyncDefaultServicesResponse {
  barber_id: number
  created_count: number
}

export interface StatisticsBarberSummary {
  id: number
  first_name_uk?: string | null
  last_name_uk?: string | null
  first_name_en?: string | null
  last_name_en?: string | null
  full_name: string
  full_name_uk?: string | null
  full_name_en?: string | null
}

export interface StatisticsServiceItem {
  service_id: number
  service_name: string
  count: number
  revenue: string | number
}

export interface StatisticsCategoryItem {
  category: string
  count: number
  revenue: string | number
}

export interface StatisticsWorkloadDayItem {
  date: string
  completed_appointments: number
  revenue: string | number
}

export interface StatisticsWorkloadWeekItem {
  week: number
  completed_appointments: number
  revenue: string | number
}

export interface StatisticsClientBreakdown {
  new_clients: number
  returning_clients: number
}

export interface BarberMonthlyStatisticsResponse {
  year: number
  month: number
  barber: StatisticsBarberSummary | null
  total_income: string | number
  completed_appointments: number
  unique_clients: number
  total_services_performed: number
  most_popular_services: StatisticsServiceItem[]
  revenue_by_service: StatisticsServiceItem[]
  average_check_per_appointment: string | number
  average_revenue_per_client: string | number
  clients: StatisticsClientBreakdown
  cancelled_appointments: number
  no_show_appointments: number
  workload_by_day: StatisticsWorkloadDayItem[]
  workload_by_week: StatisticsWorkloadWeekItem[]
  best_revenue_day: StatisticsWorkloadDayItem | null
  service_category_breakdown: StatisticsCategoryItem[]
  tips: string | number
  bonuses: string | number
}

export interface BarberComparisonItem {
  barber: StatisticsBarberSummary
  revenue: string | number
  unique_clients: number
  completed_appointments: number
  average_check: string | number
  popular_services: StatisticsServiceItem[]
}

export interface AdminMonthlyStatisticsResponse {
  year: number
  month: number
  barber_id: number | null
  total_barbershop_monthly_revenue: string | number
  total_clients: number
  total_completed_appointments: number
  total_cancelled_appointments: number
  aggregate: BarberMonthlyStatisticsResponse
  top_barbers: BarberComparisonItem[]
  most_popular_services: StatisticsServiceItem[]
}

export interface BarbersComparisonResponse {
  year: number
  month: number
  barbers: BarberComparisonItem[]
  top_performing_barbers: BarberComparisonItem[]
}

export type BlogSubscriptionStatus = 'subscribed' | 'unsubscribed'
export type BlogSubscriptionEventType = 'subscribed' | 'resubscribed' | 'unsubscribed'

export interface BlogSubscription {
  id: number
  created_at: string
  updated_at: string
  email: string
  name: string | null
  status: BlogSubscriptionStatus
  source: string | null
  language: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  first_subscribed_at: string
  subscribed_at: string
  unsubscribed_at: string | null
  unsubscribe_reason: string | null
  metadata_json: Record<string, unknown>
}

export interface BlogSubscriptionEvent {
  id: number
  subscription_id: number
  event_type: BlogSubscriptionEventType
  source: string | null
  occurred_at: string
  metadata_json: Record<string, unknown>
}

export interface BlogSubscriptionDailyStats {
  date: string
  subscribed: number
  unsubscribed: number
  net_growth: number
}

export interface BlogSubscriptionSourceStats {
  source: string
  active_subscribers: number
  subscribe_events: number
  unsubscribe_events: number
}

export interface BlogSubscriptionLanguageStats {
  language: string
  active_subscribers: number
}

export interface BlogSubscriptionReasonStats {
  reason: string
  count: number
}

export interface BlogSubscriptionEventStats {
  event_type: BlogSubscriptionEventType
  count: number
}

export interface BlogSubscriptionAnalytics {
  period_start: string
  period_end: string
  total_subscribers: number
  active_subscribers: number
  unsubscribed_subscribers: number
  subscribe_events: number
  unsubscribe_events: number
  net_growth: number
  unsubscribe_rate: number
  events: BlogSubscriptionEventStats[]
  by_date: BlogSubscriptionDailyStats[]
  by_source: BlogSubscriptionSourceStats[]
  by_language: BlogSubscriptionLanguageStats[]
  unsubscribe_reasons: BlogSubscriptionReasonStats[]
}

export interface MasterPayload {
  full_name: string
  last_name: string | null
  first_name_en: string | null
  last_name_en: string | null
  position: MasterPosition
  phone: string | null
  email: string | null
  password?: string | null
  description: string | null
  photo_upload_id?: number | null
  avatar_url?: string | null
  avatar_upload_id?: number | null
  passport_photo_upload_id?: number | null
  bookingRedirectMasterId?: number | null
  is_active: boolean
  showOnMasterBlock: boolean
  service_ids?: number[]
  admin_user_id?: number | null
}

export type MasterFormPayload = Partial<MasterPayload> & {
  photo?: File | null
  avatar?: File | null
  passport_photo?: File | null
}

export interface BookingFilters {
  date_from?: string
  date_to?: string
  master_id?: number | null
  service_id?: number | null
  status?: BookingStatus | '' | null
}

export interface CalendarRangeFilters {
  date_from: string
  date_to: string
  master_id?: number | null
}

export interface CalendarBookingFilters extends CalendarRangeFilters {
  status?: BookingStatus | '' | null
}

export const useBackofficeApi = () => {
  const api = useApi()
  const config = useRuntimeConfig()
  const apiBase = typeof config.public.apiBase === 'string' ? config.public.apiBase : ''
  const normalizePageSize = (pageSize: number) => Math.min(Math.max(pageSize, 1), 100)
  const normalizeDeliveryRate = (value: number | null | undefined) => {
    const rate = Number(value || 0)
    return rate > 0 && rate <= 1 ? Math.round(rate * 100) : Math.round(rate)
  }
  const campaignPurpose = (type?: string) => {
    if (type === 'post_visit_review_request') return 'review_request'
    if (['booking_confirmation', 'appointment_reminder', 'master_schedule_reminder', 'master_booking_created', 'master_booking_cancelled'].includes(type || '')) return 'transactional'
    return 'marketing'
  }

  const toBackendAudience = (rules: AudienceRule[] = []) => {
    const audience: Record<string, unknown> = {
      all_clients: false,
      barber_ids: [],
      service_ids: [],
    }
    if (!rules.length) audience.all_clients = true // Legacy empty rules mean all clients.
    for (const rule of rules) {
      if (rule.type === 'specific_clients') throw new Error('Аудиторія за конкретними ID клієнтів не підтримується для збереження кампанії.')
      if (rule.type === 'all_clients') { audience.all_clients = true; continue }
      if (rule.type === 'selected_barber') {
        if (!Number.isSafeInteger(rule.barber_id) || (rule.barber_id ?? 0) <= 0) throw new Error('Оберіть майстра для аудиторії.')
        const ids = audience.barber_ids as number[]
        ids.push(rule.barber_id!)
        continue
      }
      if (rule.type === 'selected_service') {
        if (!Number.isSafeInteger(rule.service_id) || (rule.service_id ?? 0) <= 0) throw new Error('Оберіть послугу для аудиторії.')
        const ids = audience.service_ids as number[]
        ids.push(rule.service_id!)
        continue
      }
      if (rule.type === 'visited_date_range') {
        const from = rule.date_from?.trim()
        const to = rule.date_to?.trim()
        if (!from && !to) throw new Error('Вкажіть хоча б одну дату для аудиторії.')
        const fromTime = from ? Date.parse(from) : null
        const toTime = to ? Date.parse(to) : null
        if ((from && !Number.isFinite(fromTime)) || (to && !Number.isFinite(toTime))) throw new Error('Вкажіть коректні дати для аудиторії.')
        if (fromTime !== null && toTime !== null && fromTime > toTime) throw new Error('Дата початку аудиторії має бути не пізніше дати завершення.')
        if (from) audience.visited_from = from
        if (to) audience.visited_to = to
        continue
      }
      if (rule.type === 'inactive_clients') {
        if (!Number.isSafeInteger(rule.inactive_days) || (rule.inactive_days ?? 0) < 1) throw new Error('Вкажіть ціле число днів без візиту від 1.')
        audience.inactive_days = rule.inactive_days
        continue
      }
      if (rule.type === 'first_time_clients') { audience.first_time_clients = true; continue }
      if (rule.type === 'vip_clients') { audience.vip_clients = true; continue }
      if (rule.type === 'birthday_this_month') { audience.birthday_month = new Date().getMonth() + 1; continue }
      throw new Error('Невідоме правило аудиторії.')
    }
    return audience
  }

  const fromBackendAudience = (audience?: Record<string, any> | null): AudienceRule[] => {
    if (!audience) return [{ type: 'all_clients' }]
    const rules: AudienceRule[] = []
    if (audience.all_clients) rules.push({ type: 'all_clients' })
    for (const barberId of audience.barber_ids || []) rules.push({ type: 'selected_barber', barber_id: Number(barberId) })
    for (const serviceId of audience.service_ids || []) rules.push({ type: 'selected_service', service_id: Number(serviceId) })
    if (audience.visited_from || audience.visited_to) rules.push({ type: 'visited_date_range', date_from: audience.visited_from || null, date_to: audience.visited_to || null })
    if (audience.inactive_days) rules.push({ type: 'inactive_clients', inactive_days: Number(audience.inactive_days) })
    if (audience.first_time_clients) rules.push({ type: 'first_time_clients' })
    if (audience.vip_clients) rules.push({ type: 'vip_clients' })
    if (audience.birthday_month) rules.push({ type: 'birthday_this_month' })
    return rules.length ? rules : [{ type: 'all_clients' }]
  }

  const normalizeTemplate = (template: any): MessageTemplate => ({
    id: template.id,
    name: template.name,
    campaign_type: template.campaign_type || template.metadata_json?.campaign_type || 'manual',
    channel: template.channel || 'telegram',
    language: template.language || 'uk',
    message_body: template.message_body || template.body || '',
    variables: template.variables || [],
    is_active: template.is_active ?? true,
    is_default: template.is_default ?? false,
    created_at: template.created_at || null,
    updated_at: template.updated_at || null,
  })

  const templatePayload = (payload: Partial<MessageTemplatePayload>) => ({
    name: payload.name,
    channel: payload.channel || 'telegram',
    language: payload.language || 'uk',
    body: payload.message_body,
    is_active: payload.is_active ?? true,
  })

  const normalizeCampaign = (campaign: any): MessagingCampaign => {
    const metadata = campaign.metadata_json || {}
    const messageBody = campaign.message_body || campaign.template_body || metadata.message_body || ''
    const audienceRules = campaign.audience_rules?.length ? campaign.audience_rules
      : metadata.audience_rules?.length ? metadata.audience_rules : fromBackendAudience(campaign.audience)
    const sent = campaign.sent_count || campaign.metrics?.sent || 0
    const failed = campaign.failed_count || campaign.metrics?.failed || 0
    const audienceSize = campaign.audience_size || campaign.metrics?.total_recipients || 0
    return {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      channel: campaign.channel || 'telegram',
      status: campaign.status,
      recipient: campaign.recipient === 'master' || metadata.recipient === 'master' || metadata.recipient === 'barber'
        ? 'master'
        : 'customer',
      purpose: campaign.purpose || null,
      template_id: campaign.template_id || null,
      audience_size: audienceSize,
      sent_count: sent,
      failed_count: failed,
      scheduled_at: campaign.scheduled_at || null,
      created_by: campaign.created_by || 'Soul Cuts',
      created_at: campaign.created_at,
      updated_at: campaign.updated_at || null,
      message_body: messageBody,
      audience_rules: audienceRules,
      audience_estimate: campaign.audience_estimate || null,
      metrics: campaign.metrics || {
        total_recipients: audienceSize,
        sent,
        failed,
        skipped: 0,
        delivery_rate: audienceSize ? Math.round((sent / audienceSize) * 100) : 0,
      },
      review_link: campaign.review_link || campaign.review_url || null,
      promo_code: campaign.promo_code ?? campaign.discount_code ?? null,
      timezone: campaign.timezone || 'Europe/Kyiv',
      location_key: campaign.location_key || null,
      metadata_json: metadata,
      segment_ids: campaign.segment_ids ?? metadata.segment_ids ?? [],
      channel_strategy: campaign.channel_strategy ?? metadata.channel_strategy ?? 'single',
      offer_audience_mode: campaign.offer_audience_mode ?? metadata.offer_audience_mode ?? 'last_visit_3_12',
      exclude_returned_since_snapshot: campaign.exclude_returned_since_snapshot ?? metadata.exclude_returned_since_snapshot ?? false,
      exclude_upcoming_booking: campaign.exclude_upcoming_booking ?? metadata.exclude_upcoming_booking ?? false,
      marketing_frequency_days: campaign.marketing_frequency_days ?? metadata.marketing_frequency_days ?? 7,
      sending_window: campaign.sending_window ?? null,
      sms_recipients_per_minute: campaign.sms_recipients_per_minute,
      offer_master_id: campaign.offer_master_id ?? null,
      offer_promotion_id: campaign.offer_promotion_id ?? null,
      offer_service_ids: campaign.offer_service_ids ?? null,
      offer_starts_at: campaign.offer_starts_at ?? null,
      offer_expires_at: campaign.offer_expires_at ?? null,
      master_name_for_message: campaign.master_name_for_message ?? null,
      marketing_max_contacts: campaign.marketing_max_contacts ?? null,
      marketing_cap_days: campaign.marketing_cap_days ?? null,
    }
  }

  const normalizeCampaignPage = (page: PaginatedResponse<any>): PaginatedResponse<MessagingCampaign> => ({
    ...page,
    items: page.items.map(normalizeCampaign),
  })

  const normalizeTemplatePage = (page: PaginatedResponse<any>): PaginatedResponse<MessageTemplate> => ({
    ...page,
    items: page.items.map(normalizeTemplate),
  })

  const automationDelayMinutes = (value?: string | null) => {
    if (value == null) return null
    const minutes: Record<string, number> = { immediate: 0, '1h': 60, '24h': 1440 }
    if (!(value in minutes)) throw new Error('Невідомий інтервал автоматичного повідомлення.')
    return minutes[value]
  }

  const campaignPayload = (payload: Partial<CampaignPayload>, templateId?: number | string | null) => ({
    name: payload.name,
    type: payload.type,
    status: payload.status || 'draft',
    channel: payload.channel || 'telegram',
    recipient: payload.recipient || 'customer',
    purpose: payload.purpose || campaignPurpose(payload.type),
    template_id: templateId ?? payload.template_id ?? null,
    scheduled_at: payload.schedule_mode === 'later' ? payload.scheduled_at || null : null,
    timezone: payload.timezone || 'Europe/Kyiv',
    review_delay_minutes: automationDelayMinutes(payload.automation_delay),
    follow_up_delay_days: payload.follow_up_after_days || null,
    review_platform: payload.review_platform || null,
    review_url: payload.review_link || null,
    discount_code: payload.promo_code || null,
    location_key: payload.location_key || null,
    metadata_json: {
      ...(payload.metadata_json || {}),
      recipient: payload.recipient || 'customer',
      message_body: payload.message_body,
      language_versions: payload.language_versions,
      audience_rules: payload.audience_rules,
      inline_button_text: payload.inline_button_text,
      schedule_mode: payload.schedule_mode,
      max_messages_per_minute: payload.max_messages_per_minute,
      quiet_hours_enabled: payload.quiet_hours_enabled,
      quiet_hours_from: payload.quiet_hours_from,
      quiet_hours_to: payload.quiet_hours_to,
      duplicate_protection_days: payload.duplicate_protection_days,
    },
    ...(payload.segment_ids !== undefined ? { segment_ids: payload.segment_ids } : {}),
    channel_strategy: payload.channel_strategy,
    exclude_returned_since_snapshot: payload.exclude_returned_since_snapshot,
    exclude_upcoming_booking: payload.exclude_upcoming_booking,
    marketing_frequency_days: payload.marketing_frequency_days,
    sms_recipients_per_minute: payload.max_messages_per_minute,
    // Segment unions are evaluated by the backend; never also send inline filters.
    ...(payload.segment_ids?.length || payload.audience_rules === undefined
      ? {} : { audience: toBackendAudience(payload.audience_rules || []) }),
  })

  // CampaignUpdate is sparse. Defaults belong to creation, never to an edit of
  // an existing audience, schedule, template, or notification configuration.
  const campaignUpdatePayload = (payload: Partial<CampaignPayload>, existingMetadata: Record<string, unknown> = {}) => {
    const body: Record<string, unknown> = campaignPayload(payload)
    const fields: Record<string, keyof CampaignPayload> = {
      name: 'name', type: 'type', status: 'status', channel: 'channel', recipient: 'recipient', purpose: 'purpose',
      template_id: 'template_id', scheduled_at: 'schedule_mode', timezone: 'timezone',
      review_delay_minutes: 'automation_delay', follow_up_delay_days: 'follow_up_after_days',
      sms_recipients_per_minute: 'max_messages_per_minute',
      review_platform: 'review_platform', review_url: 'review_link', discount_code: 'promo_code', location_key: 'location_key',
    }
    for (const [field, input] of Object.entries(fields)) {
      if (payload[input] === undefined) delete body[field]
    }
    const metadata: Record<string, unknown> = { ...existingMetadata, ...payload.metadata_json }
    for (const key of ['recipient', 'message_body', 'language_versions', 'audience_rules', 'inline_button_text', 'schedule_mode', 'max_messages_per_minute', 'quiet_hours_enabled', 'quiet_hours_from', 'quiet_hours_to', 'duplicate_protection_days'] as const) {
      if (payload[key] !== undefined) metadata[key] = payload[key]
    }
    body.metadata_json = metadata
    return body
  }

  const login = (email: string, password: string) =>
    $fetch<TokenResponse>('/backoffice/auth/login', {
      baseURL: apiBase,
      method: 'POST',
      body: new URLSearchParams({
        username: email,
        password,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

  const me = () => api<AdminUser>('/backoffice/auth/me')

  const getProducts = (
    page = 1,
    pageSize = 10,
    filters: {
      search?: string
      category_id?: number | null
      brand_id?: number | null
      is_active?: boolean | null
      availability_status?: string | null
    } = {},
  ) =>
    api<PaginatedResponse<Product>>('/backoffice/products', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        category_id: filters.category_id ?? undefined,
        brand_id: filters.brand_id ?? undefined,
        is_active: filters.is_active ?? undefined,
        availability_status: filters.availability_status || undefined,
      },
    })

  const getProduct = (productId: number | string) =>
    api<Product>(`/backoffice/products/${productId}`)

  const createProduct = (payload: ProductPayload) =>
    api<Product>('/backoffice/products', {
      method: 'POST',
      body: payload,
    })

  const updateProduct = (productId: number | string, payload: Partial<ProductPayload>) =>
    api<Product>(`/backoffice/products/${productId}`, {
      method: 'PUT',
      body: payload,
    })

  const deleteProduct = (productId: number | string) =>
    api(`/backoffice/products/${productId}`, {
      method: 'DELETE',
    })

  const getProductImages = (productId: number | string) =>
    api<ProductImage[]>(`/backoffice/products/${productId}/images`)

  const uploadProductImage = (productId: number | string, file: File, alt?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (alt?.trim()) formData.append('alt', alt.trim())
    return api<ProductImage>(`/backoffice/products/${productId}/images`, {
      method: 'POST',
      body: formData,
    })
  }

  const replaceProductImage = (productId: number | string, imageId: number | string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api<ProductImage>(`/backoffice/products/${productId}/images/${imageId}/file`, {
      method: 'PUT',
      body: formData,
    })
  }

  const updateProductImage = (
    productId: number | string,
    imageId: number | string,
    payload: { alt?: string | null, is_active?: boolean | null },
  ) => api<ProductImage>(`/backoffice/products/${productId}/images/${imageId}`, {
    method: 'PATCH',
    body: payload,
  })

  const reorderProductImages = (productId: number | string, imageIds: Array<number | string>) =>
    api<ProductImage[]>(`/backoffice/products/${productId}/images/reorder`, {
      method: 'PATCH',
      body: { image_ids: imageIds.map(Number) },
    })

  const deleteProductImage = (productId: number | string, imageId: number | string) =>
    api(`/backoffice/products/${productId}/images/${imageId}`, { method: 'DELETE' })

  const getCategories = (
    page = 1,
    pageSize = 10,
    filters: {
      search?: string
      parent_id?: number | null
      is_active?: boolean | null
    } = {},
  ) =>
    api<PaginatedResponse<Category>>('/backoffice/categories', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        parent_id: filters.parent_id ?? undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const getCategoryTree = () => api<CategoryTreeNode[]>('/backoffice/categories/tree')

  const updateCategory = (categoryId: number | string, payload: { is_active: boolean }) =>
    api<Category>(`/backoffice/categories/${categoryId}`, {
      method: 'PUT',
      body: payload,
    })

  const getBrands = (page = 1, pageSize = 10) =>
    api<PaginatedResponse<Brand>>('/backoffice/brands', {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const updateBrand = (brandId: number | string, payload: { is_active: boolean }) =>
    api<Brand>(`/backoffice/brands/${brandId}`, {
      method: 'PUT',
      body: payload,
    })

  const getMockReconciliation = () => api<MockReconciliation>('/backoffice/integrations/checkbox/reconciliation', { retry: 0 })
  const acknowledgeMockReconciliation = (body: { case_type: MockCaseType, resource_id: string, evidence: string }, key: string) => api<MockReconciliationAck>('/backoffice/integrations/checkbox/reconciliation/acknowledgements', { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getMockFiscalReports = (register: string) => api<MockFiscalReport[]>(`/backoffice/integrations/checkbox/cash-registers/${encodeURIComponent(register)}/reports`, { retry: 0 })
  const createMockFiscalReport = (register: string, body: { kind: 'x' | 'z', expected_shift_revision: number, confirm: true }, key: string) => api<MockFiscalReport>(`/backoffice/integrations/checkbox/cash-registers/${encodeURIComponent(register)}/reports`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const shareMockFiscalDocument = (id: number, operation: 'share' | 'revoke-share', body: { expires_in_seconds?: number }, key: string) => api<MockFiscalShare>(`/backoffice/fiscal-documents/${id}/${operation}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getMockReturns = (order: number) => api<MockReturn[]>(`/backoffice/orders/${order}/returns`, { retry: 0 })
  const createMockReturn = (order: number, body: MockReturnCreate, key: string) => api<MockReturn>(`/backoffice/orders/${order}/returns`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const refundMockReturn = (id: number, body: MockReturnRefund, key: string) => api<MockReturn>(`/backoffice/returns/${id}/refunds`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const receiveMockReturn = (id: number, body: MockReturnReceipt, key: string) => api<MockReturn>(`/backoffice/returns/${id}/receipts`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const createReturnFiscalMockPreview = (id: number, body: { cash_register_id: string }, key: string) => api<FiscalMockPreview>(`/backoffice/returns/${id}/fiscal-preview`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getFiscalMockReadiness = () => api<FiscalMockReadiness>('/backoffice/integrations/readiness', { retry: 0 })
  const runFiscalMockShift = (register: string, operation: 'open-shift' | 'close-shift', body: { expected_shift_revision: number }, key: string) =>
    api<FiscalMockReadiness>(`/backoffice/integrations/checkbox/cash-registers/${encodeURIComponent(register)}/${operation}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const createFiscalMockPreview = (id: number, body: { cash_register_id: string }, key: string) =>
    api<FiscalMockPreview>(`/backoffice/orders/${id}/fiscal-preview`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getFiscalMockPreview = (order: number, id: number) => api<FiscalMockPreview>(`/backoffice/orders/${order}/fiscal-previews/${id}`, { retry: 0 })
  const submitFiscalMock = (id: number, body: FiscalMockSubmission, key: string) =>
    api<FiscalMockDocument>(`/backoffice/orders/${id}/fiscal-submissions`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getFiscalMockDocuments = (order: number) => api<FiscalMockDocument[]>(`/backoffice/orders/${order}/fiscal-documents`, { retry: 0 })
  const getFiscalMockDocument = (id: number) => api<FiscalMockDocument>(`/backoffice/fiscal-documents/${id}`, { retry: 0 })
  const runFiscalMockDocument = (id: number, operation: 'process' | 'cancel' | 'delivery', body: FiscalMockDocumentCommand, key: string) =>
    api<FiscalMockDocument>(`/backoffice/fiscal-documents/${id}/${operation}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getFiscalMockPrint = (id: number) => api<string>(`/backoffice/fiscal-documents/${id}/print`, { responseType: 'text', retry: 0 })

  const getEttnMockProjects = (order: number) => api<EttnMockList>(`/backoffice/orders/${order}/fiscal-automations`, { retry: 0 })
  const createEttnMockPreview = (order: number, body: EttnMockPrepare, key: string) => api<EttnMockPreview>(`/backoffice/orders/${order}/fiscal-automation-preview`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getEttnMockPreview = (order: number, id: number) => api<EttnMockPreview>(`/backoffice/orders/${order}/fiscal-automation-previews/${id}`, { retry: 0 })
  const armEttnMock = (order: number, body: EttnMockApproval, key: string) => api<EttnMockProject>(`/backoffice/orders/${order}/fiscal-automations`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getEttnMockProject = (id: number) => api<EttnMockProject>(`/backoffice/fiscal-automations/${id}`, { retry: 0 })
  const runEttnMockProject = (id: number, operation: 'process' | 'cancel' | 'reconcile' | 'trigger' | 'materialize', body: EttnMockCommand, key: string) => api<EttnMockProject>(`/backoffice/fiscal-automations/${id}/${operation}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })

  const getProviderSandboxReadiness = () => api<ProviderSandboxReadiness>('/backoffice/integrations/provider-sandbox/readiness', { retry: 0 })
  const createOrderSandboxQrAttempt = (id: number, body: QrMockCreate, key: string) => api<QrMockAttempt>(`/backoffice/orders/${id}/sandbox-qr-payment-attempts`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const refreshSandboxQrAttempt = (id: number, body: QrMockCommand, key: string) => api<QrMockAttempt>(`/backoffice/qr-payment-attempts/${id}/sandbox-refresh`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getMasterMonoState = (id: number) => api<MasterMonoState>(`/backoffice/master-mono/orders/${id}`, { retry: 0 })
  const startMasterMono = (id: number, body: MasterMonoCommand, key: string) => api<MasterMonoState>(`/backoffice/master-mono/orders/${id}/start`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const refreshMasterMono = (id: number, body: MasterMonoCommand, key: string) => api<MasterMonoState>(`/backoffice/master-mono/orders/${id}/refresh`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  // Always use this authenticated endpoint; never follow a provider-returned PDF URL.
  const getMasterMonoReceiptPdf = (id: number) => api<Blob>(`/backoffice/master-mono/orders/${id}/receipt/pdf`, { responseType: 'blob', retry: 0 })
  const getQrMockReadiness = () => api<QrMockReadiness>('/backoffice/integrations/monobank-qr/readiness', { retry: 0 })
  const getOrderQrMockAttempts = (id: number) => api<QrMockAttempt[]>(`/backoffice/orders/${id}/qr-payment-attempts`, { retry: 0 })
  const createOrderQrMockAttempt = (id: number, body: QrMockCreate, key: string) => api<QrMockAttempt>(`/backoffice/orders/${id}/qr-payment-attempts`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getQrMockAttempt = (id: number) => api<QrMockAttempt>(`/backoffice/qr-payment-attempts/${id}`, { retry: 0 })
  const runQrMockAttempt = (id: number, operation: 'refresh' | 'cancel' | 'simulate', body: QrMockCommand, key: string) => api<QrMockAttempt>(`/backoffice/qr-payment-attempts/${id}/${operation}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getQrMockReceipt = (id: number) => api<string>(`/backoffice/qr-payment-attempts/${id}/receipt`, { responseType: 'text', retry: 0 })
  const getPosCapabilities = () => api<PosCapabilities>('/backoffice/orders/pos-capabilities')
  const createPosOrder = (payload: PosOrderCreate, key: string) =>
    api<OrderResponse>('/backoffice/orders', { method: 'POST', body: payload, headers: { 'Idempotency-Key': key }, retry: 0 })
  const recordOrderPayment = (id: number, payload: OrderPaymentCommand, key: string) =>
    api<OrderResponse>(`/backoffice/orders/${id}/payments`, { method: 'POST', body: payload, headers: { 'Idempotency-Key': key }, retry: 0 })
  const handoverOrder = (id: number, payload: OrderHandoverCommand, key: string) =>
    api<OrderResponse>(`/backoffice/orders/${id}/handover`, { method: 'POST', body: payload, headers: { 'Idempotency-Key': key }, retry: 0 })

  const createMockShipmentFixture = (id: number, body: { expected_revision: number, address_snapshot?: ShipmentAddress }, key: string) =>
    api<{ tracking_number: string, simulation: boolean }>(`/backoffice/orders/${id}/mock-shipment-fixtures`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const createOrderShipment = (id: number, body: ShipmentCreateCommand, key: string) =>
    api<OrderResponse>(`/backoffice/orders/${id}/shipments`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const runShipmentCommand = (orderId: number, id: number, operation: 'refresh' | 'cancel' | 'handover', body: ShipmentCommand, key: string) =>
    api<OrderResponse>(`/backoffice/orders/${orderId}/shipments/${id}/${operation}`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getShipmentSettlement = (orderId: number, id: number) => api<ShipmentSettlement>(`/backoffice/orders/${orderId}/shipments/${id}/settlement`, { retry: 0 })
  const confirmShipmentCod = (orderId: number, id: number, body: ShipmentCodCommand, key: string) => api<OrderResponse>(`/backoffice/orders/${orderId}/shipments/${id}/cod-payment`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const receiveShipmentReturn = (orderId: number, id: number, body: ShipmentReturnReceiptCommand, key: string) => api<OrderResponse>(`/backoffice/orders/${orderId}/shipments/${id}/return-receipt`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const createShipmentReturn = (orderId: number, id: number, body: ShipmentReturnCommand, key: string) => api<OrderResponse>(`/backoffice/orders/${orderId}/shipments/${id}/return-shipment`, { method: 'POST', body, headers: { 'Idempotency-Key': key }, retry: 0 })
  const getShipmentLabel = (orderId: number, id: number) => api<string>(`/backoffice/orders/${orderId}/shipments/${id}/label`, { responseType: 'text', retry: 0 })

  const getOrders = (page = 1, pageSize = 10) =>
    api<PaginatedResponse<OrderSummary>>('/backoffice/orders', {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getOrder = (orderId: number | string) =>
    api<OrderResponse>(`/backoffice/orders/${orderId}`)

  const createOrderPreliminaryDocument = (orderId: number, revision: number, key: string) =>
    api<PreliminaryOrderDocument>(`/backoffice/orders/${orderId}/preliminary-documents`, {
      method: 'POST', body: { expected_revision: revision }, headers: { 'Idempotency-Key': key }, retry: 0,
    })

  const getOrderPreliminaryDocumentHtml = (orderId: number, documentId: number) =>
    api<string>(`/backoffice/orders/${orderId}/preliminary-documents/${documentId}/print`, { responseType: 'text' })

  const updateOrderStatus = (orderId: number | string, status: string) =>
    api<OrderResponse>(`/backoffice/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status },
    })

  const getInventoryStock = (
    page = 1,
    pageSize = 10,
    filters: { search?: string } = {},
  ) =>
    api<PaginatedResponse<InventoryProduct>>('/backoffice/inventory/stock', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search?.trim() || undefined,
      },
    })

  const lookupInventoryProductByBarcode = (barcode: string) =>
    api<InventoryProduct>(`/backoffice/inventory/products/barcode/${encodeURIComponent(barcode)}`)

  const bindInventoryBarcode = (productId: number, barcode: string) =>
    api<InventoryProduct>(`/backoffice/inventory/products/${productId}/barcode`, {
      method: 'PUT', body: { barcode },
    })

  const createInventoryProduct = (payload: InventoryProductCreate, idempotencyKey: string) =>
    api<InventoryProduct>('/backoffice/inventory/products', {
      method: 'POST', body: payload, headers: { 'Idempotency-Key': idempotencyKey },
    })

  const getInventoryProduct = async (productId: number | string): Promise<InventoryProduct> => {
    const product = await api<Product>(`/backoffice/products/${productId}`)
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      on_hand: product.stock_quantity,
      reserved: product.reserved_quantity,
      available: product.available_quantity,
      allow_backorder: product.allow_backorder,
      image_url: product.image_url,
      display_image_url: product.display_image_url,
      display_image_urls: product.display_image_urls,
      brand_name: product.brand?.name,
      package_size: product.package_size,
      model_name: product.model_name,
      volume_ml: product.volume_ml,
    }
  }

  const updateProductInventorySettings = (productId: number | string, payload: ProductInventorySettingsUpdate) =>
    api<InventoryProduct>(`/backoffice/inventory/products/${productId}/settings`, {
      method: 'PATCH',
      body: payload,
    })

  const getProcurementQueue = (statuses?: ProcurementStatus[]) =>
    api<ProcurementQueueItem[]>('/backoffice/inventory/procurement', {
      query: { status: statuses?.length ? statuses : undefined },
    })

  const markProcurementOrdered = (orderItemIds: number[]) =>
    api<void>('/backoffice/inventory/procurement/mark-ordered', {
      method: 'POST',
      body: { order_item_ids: orderItemIds },
    })

  const idempotencyHeaders = (idempotencyKey = createInventoryIdempotencyKey()) => ({
    'Idempotency-Key': idempotencyKey,
  })

  const createInventoryReceipt = (payload: InventoryReceiptCreate, idempotencyKey = createInventoryIdempotencyKey()) =>
    api<InventoryReceipt>('/backoffice/inventory/receipts', {
      method: 'POST',
      body: payload,
      headers: idempotencyHeaders(idempotencyKey),
    })

  const getInventoryReceipts = (page = 1, pageSize = 20) =>
    api<PaginatedResponse<InventoryReceipt>>('/backoffice/inventory/receipts', {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getInventoryReceipt = (receiptId: number | string) =>
    api<InventoryReceipt>(`/backoffice/inventory/receipts/${receiptId}`)

  const addInventoryReceiptItem = (receiptId: number | string, payload: InventoryReceiptItemCreate, idempotencyKey: string) => {
    if (!idempotencyKey?.trim() || idempotencyKey.length > 128) throw new Error('A receipt item Idempotency-Key is required')
    return api<InventoryReceipt>(`/backoffice/inventory/receipts/${receiptId}/items`, {
      method: 'POST',
      body: payload,
      headers: idempotencyHeaders(idempotencyKey),
    })
  }

  const postInventoryReceipt = (receiptId: number | string, idempotencyKey = createInventoryIdempotencyKey()) =>
    api<InventoryReceipt>(`/backoffice/inventory/receipts/${receiptId}/post`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
    })

  const createInventoryOperation = (
    operation: ManualInventoryOperationType,
    payload: InventoryManualOperationCreate,
    idempotencyKey = createInventoryIdempotencyKey(),
  ) =>
    api<InventoryMovement>(`/backoffice/inventory/operations/${operation}`, {
      method: 'POST',
      body: payload,
      headers: idempotencyHeaders(idempotencyKey),
    })

  const getProductInventoryMovements = (productId: number | string, page = 1, pageSize = 10) =>
    api<PaginatedResponse<InventoryMovement>>(`/backoffice/inventory/products/${productId}/movements`, {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const createInventoryCount = (payload: InventoryCountCreate, idempotencyKey = createInventoryIdempotencyKey()) =>
    api<InventoryCount>('/backoffice/inventory/counts', {
      method: 'POST',
      body: payload,
      headers: idempotencyHeaders(idempotencyKey),
    })

  const getInventoryCount = (countId: number | string) =>
    api<InventoryCount>(`/backoffice/inventory/counts/${countId}`)

  const setInventoryCountItem = (countId: number | string, payload: InventoryCountItemUpsert) =>
    api<InventoryCount>(`/backoffice/inventory/counts/${countId}/items`, {
      method: 'PUT',
      body: payload,
    })

  const postInventoryCount = (countId: number | string, idempotencyKey = createInventoryIdempotencyKey()) =>
    api<InventoryCount>(`/backoffice/inventory/counts/${countId}/post`, {
      method: 'POST',
      headers: idempotencyHeaders(idempotencyKey),
    })

  const getOrderFulfillment = (orderId: number | string) =>
    api<Pick<OrderResponse, 'id' | 'status' | 'items'>>(`/backoffice/orders/${orderId}/fulfillment`)

  const getCustomers = (
    page = 1,
    pageSize = 10,
    filters: {
      search?: string
      is_active?: string | null
      is_verified?: string | null
      telegram_connected?: string | null
      sort_by?: string
      sort_order?: string
    } = {},
  ) =>
    api<PaginatedResponse<CustomerSummary>>('/backoffice/customers', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active || undefined,
        is_verified: filters.is_verified || undefined,
        telegram_connected: filters.telegram_connected || undefined,
        sort_by: filters.sort_by || 'created_at',
        sort_order: filters.sort_order || 'desc',
      },
    })

  const getCustomer = (customerId: number | string) =>
    api<Customer>(`/backoffice/customers/${customerId}`)

  const updateCustomer = (customerId: number | string, payload: CustomerUpdatePayload) =>
    api<Customer>(`/backoffice/customers/${customerId}`, {
      method: 'PUT',
      body: payload,
    })

  const getCustomerOrders = (customerId: number | string, page = 1, pageSize = 10) =>
    api<PaginatedResponse<OrderSummary>>(`/backoffice/customers/${customerId}/orders`, {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getCustomerBookings = (customerId: number | string, page = 1, pageSize = 10) =>
    api<PaginatedResponse<Booking>>(`/backoffice/customers/${customerId}/bookings`, {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getCustomerStats = (customerId: number | string) =>
    api<CustomerBookingStats>(`/backoffice/customers/${customerId}/stats`)

  const getPublicMasters = () => api<Master[]>('/public/masters')

  const getServices = () => api<Service[]>('/public/services')

  const getAvailableSlots = (masterId: number | string, date: string, serviceId: number | string | Array<number | string>, durationMinutes?: number) => {
    const serviceIds = Array.isArray(serviceId) ? serviceId : [serviceId]
    return api<AvailableSlot[]>(`/public/masters/${masterId}/available-slots`, {
      query: {
        date,
        service_id: serviceIds[0],
        service_ids: serviceIds,
        duration_minutes: durationMinutes,
      },
    })
  }

  const createPublicBooking = (payload: PublicBookingPayload) =>
    api<Booking>('/public/bookings', {
      method: 'POST',
      body: payload,
    })

  const createMyManualBooking = (payload: ManualBookingPayload) =>
    api<Booking>('/backoffice/masters/me/bookings', {
      method: 'POST',
      body: payload,
    })

  const getMyCalendar = (filters: CalendarRangeFilters) =>
    api<Booking[]>('/backoffice/masters/me/calendar', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      },
    })

  const getMyCalendarCapacity = (filters: CalendarRangeFilters) =>
    api<CalendarCapacityBooking[]>('/backoffice/masters/me/calendar-capacity', {
      query: {
        date_from: filters.date_from,
        date_to: filters.date_to,
      },
    })

  const getMyBookings = (filters: BookingFilters = {}) =>
    api<Booking[] | PaginatedResponse<Booking>>('/backoffice/masters/me/bookings', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        status: filters.status || undefined,
      },
    })

  const getMyBooking = (bookingId: number | string) =>
    api<Booking>(`/backoffice/masters/me/bookings/${bookingId}`)

  const updateMyBookingStatus = (bookingId: number | string, status: BookingStatus) =>
    api<Booking>(`/backoffice/masters/me/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: { status },
    })

  const deleteMyBooking = (bookingId: number | string) =>
    api(`/backoffice/masters/me/bookings/${bookingId}`, {
      method: 'DELETE',
    })

  const getMyServices = () =>
    api<MasterService[]>('/backoffice/masters/me/services')

  const updateMyService = (serviceId: number | string, payload: Partial<MasterServicePayload>) =>
    api<MasterService>(`/backoffice/masters/me/services/${serviceId}`, {
      method: 'PATCH',
      body: payload,
    })

  const getMyTimeBlocks = (filters: { date_from?: string, date_to?: string } = {}) =>
    api<TimeBlock[] | PaginatedResponse<TimeBlock>>('/backoffice/masters/me/time-blocks', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      },
    })

  const getMyCalendarHolds = (filters: CalendarRangeFilters) =>
    api<CalendarHold[]>('/backoffice/masters/me/calendar-holds', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      },
    })

  const createMyTimeBlock = (payload: TimeBlockPayload) =>
    api<TimeBlock>('/backoffice/masters/me/time-blocks', {
      method: 'POST',
      body: payload,
    })

  const deleteMyTimeBlock = (blockId: number | string) =>
    api(`/backoffice/masters/me/time-blocks/${blockId}`, {
      method: 'DELETE',
    })

  const getMyAvailability = (filters: AvailabilityFilters) =>
    api<MasterAvailabilityWindow[]>('/backoffice/masters/me/availability', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      },
    })

  const createMyAvailabilityWindow = (payload: AvailabilityWindowPayload) =>
    api<MasterAvailabilityWindow>('/backoffice/masters/me/availability/windows', {
      method: 'POST',
      body: {
        start_at: payload.start_at,
        end_at: payload.end_at,
      },
    })

  const deleteMyAvailabilityWindow = (windowId: number | string) =>
    api(`/backoffice/masters/me/availability/${windowId}`, {
      method: 'DELETE',
    })

  const getMyMonthlyStatistics = (year: number, month: number) =>
    api<BarberMonthlyStatisticsResponse>('/backoffice/statistics/me/monthly', {
      query: { year, month },
    })

  const getBarberMonthlyStatistics = (barberId: number | string, year: number, month: number) =>
    api<BarberMonthlyStatisticsResponse>(`/backoffice/statistics/barbers/${barberId}/monthly`, {
      query: { year, month },
    })

  const adminGetMonthlyStatistics = (year: number, month: number, barberId?: number | string | null) =>
    api<AdminMonthlyStatisticsResponse>('/backoffice/statistics/admin/monthly', {
      query: {
        year,
        month,
        barber_id: barberId ?? undefined,
      },
    })

  const adminGetBarbersComparison = (year: number, month: number) =>
    api<BarbersComparisonResponse>('/backoffice/statistics/admin/barbers-comparison', {
      query: { year, month },
    })

  const adminGetDashboard = async (filters: {
    date_from: string
    date_to: string
    compare_to_previous: boolean
    master_id?: number | string | null
  }) => {
    const response = await api<unknown>('/backoffice/statistics/admin/dashboard', {
      query: {
        date_from: filters.date_from,
        date_to: filters.date_to,
        compare_to_previous: filters.compare_to_previous,
        master_id: filters.master_id ?? undefined,
      },
    })
    return parseAdminDashboardResponse(response)
  }

  const adminGetBookingRecoverySummary = async (filters: {
    date_from: string
    date_to: string
  }): Promise<BookingRecoverySummary> => {
    const response = await api<unknown>('/backoffice/booking-recovery/summary', {
      query: {
        date_from: filters.date_from,
        date_to: filters.date_to,
      },
    })
    return parseBookingRecoverySummary(response)
  }

  const adminGetMasters = (page = 1, pageSize = 100, filters: { search?: string, is_active?: boolean | null } = {}) =>
    api<Master[] | PaginatedResponse<Master>>('/backoffice/masters', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const masterPayloadBody = (payload: MasterFormPayload) => {
    const { photo: _photo, avatar: _avatar, passport_photo: _passportPhoto, ...body } = payload
    return body
  }

  const uploadMasterImage = (masterId: number | string, kind: 'photo' | 'avatar' | 'passport-photo', file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api<Master>(`/backoffice/masters/${masterId}/${kind}`, {
      method: 'POST',
      body: formData,
    })
  }

  const applyMasterImageUploads = async (master: Master, payload: MasterFormPayload) => {
    let result = master
    if (payload.photo) {
      result = await uploadMasterImage(result.id, 'photo', payload.photo)
    }
    if (payload.avatar) {
      result = await uploadMasterImage(result.id, 'avatar', payload.avatar)
    }
    if (payload.passport_photo) {
      result = await uploadMasterImage(result.id, 'passport-photo', payload.passport_photo)
    }
    return result
  }

  const adminCreateMaster = async (payload: MasterFormPayload) => {
    const master = await api<Master>('/backoffice/masters', {
      method: 'POST',
      body: masterPayloadBody(payload),
    })
    return applyMasterImageUploads(master, payload)
  }

  const adminUpdateMaster = async (masterId: number | string, payload: MasterFormPayload) => {
    const master = await api<Master>(`/backoffice/masters/${masterId}`, {
      method: 'PUT',
      body: masterPayloadBody(payload),
    })
    return applyMasterImageUploads(master, payload)
  }

  const adminGetServices = (page = 1, pageSize = 100, filters: { search?: string, is_active?: boolean | null } = {}) =>
    api<Service[] | PaginatedResponse<Service>>('/backoffice/booking-services', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const adminCreateService = (payload: ServicePayload) =>
    api<Service>('/backoffice/booking-services', {
      method: 'POST',
      body: payload,
    })

  const adminUpdateService = (serviceId: number | string, payload: Partial<ServicePayload>) =>
    api<Service>(`/backoffice/booking-services/${serviceId}`, {
      method: 'PUT',
      body: payload,
    })

  const adminGetBaseServices = (page = 1, pageSize = 100, filters: { search?: string, is_active?: boolean | null } = {}) =>
    api<BaseService[] | PaginatedResponse<BaseService>>('/backoffice/admin/services', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const adminCreateBaseService = (payload: BaseServicePayload) =>
    api<BaseService>('/backoffice/admin/services', {
      method: 'POST',
      body: payload,
    })

  const adminUpdateBaseService = (serviceId: number | string, payload: Partial<BaseServicePayload>) =>
    api<BaseService>(`/backoffice/admin/services/${serviceId}`, {
      method: 'PATCH',
      body: payload,
    })

  const adminDeleteBaseService = (serviceId: number | string) =>
    api(`/backoffice/admin/services/${serviceId}`, {
      method: 'DELETE',
    })

  const adminGetPromotions = (page = 1, pageSize = 100, filters: { search?: string, is_active?: boolean | null } = {}) =>
    api<PaginatedResponse<Promotion>>('/backoffice/promotions', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        is_active: filters.is_active ?? undefined,
      },
    })

  const adminCreatePromotion = (payload: PromotionPayload) =>
    api<Promotion>('/backoffice/promotions', {
      method: 'POST',
      body: payload,
    })

  const adminUpdatePromotion = (promotionId: number | string, payload: Partial<PromotionPayload>) =>
    api<Promotion>(`/backoffice/promotions/${promotionId}`, {
      method: 'PATCH',
      body: payload,
    })

  const adminDeletePromotion = (promotionId: number | string) =>
    api(`/backoffice/promotions/${promotionId}`, {
      method: 'DELETE',
    })

  const adminGetShopPromotions = (
    page = 1,
    pageSize = 100,
    filters: {
      is_active?: boolean | null
      trigger?: ShopPromotionTrigger | string | null
      search?: string
      product_id?: number | null
      category_id?: number | null
      brand_id?: number | null
      status?: ShopPromotionStatus | string | null
      period?: ShopPromotionStatus | string | null
    } = {},
  ) =>
    api<PaginatedResponse<ShopPromotionResponse>>('/backoffice/shop-promotions', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        is_active: filters.is_active ?? undefined,
        trigger: filters.trigger ?? undefined,
        search: filters.search || undefined,
        product_id: filters.product_id ?? undefined,
        category_id: filters.category_id ?? undefined,
        brand_id: filters.brand_id ?? undefined,
        status: filters.status ?? undefined,
        period: filters.period ?? undefined,
      },
    })

  const adminGetShopPromotion = (promotionId: number | string) =>
    api<ShopPromotionResponse>(`/backoffice/shop-promotions/${promotionId}`)

  const adminGetShopPromotionProducts = (promotionId: number | string) =>
    api<ShopPromotionProductsResponse>(`/backoffice/shop-promotions/${promotionId}/products`)

  const adminCreateShopPromotion = (payload: ShopPromotionPayload) =>
    api<ShopPromotionResponse>('/backoffice/shop-promotions', {
      method: 'POST',
      body: payload,
    })

  const adminUpdateShopPromotion = (promotionId: number | string, payload: Partial<ShopPromotionPayload>) =>
    api<ShopPromotionResponse>(`/backoffice/shop-promotions/${promotionId}`, {
      method: 'PATCH',
      body: payload,
    })

  const adminDeleteShopPromotion = (promotionId: number | string) =>
    api(`/backoffice/shop-promotions/${promotionId}`, {
      method: 'DELETE',
    })

  const adminPreviewShopPromotion = (payload: ShopPromotionPayload) =>
    api<ShopPromotionPreviewResponse>('/backoffice/shop-promotions/preview', {
      method: 'POST',
      body: payload,
    })

  const getMasterServices = (barberId: number | string) =>
    api<MasterService[] | PaginatedResponse<MasterService>>(`/backoffice/barbers/${barberId}/services`)

  const createMasterService = (barberId: number | string, payload: MasterServicePayload) =>
    api<MasterService>(`/backoffice/barbers/${barberId}/services`, {
      method: 'POST',
      body: payload,
    })

  const updateMasterService = (barberId: number | string, serviceId: number | string, payload: Partial<MasterServicePayload>) =>
    api<MasterService>(`/backoffice/barbers/${barberId}/services/${serviceId}`, {
      method: 'PATCH',
      body: payload,
    })

  const deleteMasterService = (barberId: number | string, serviceId: number | string) =>
    api(`/backoffice/barbers/${barberId}/services/${serviceId}`, {
      method: 'DELETE',
    })

  const syncDefaultMasterServices = (barberId: number | string) =>
    api<SyncDefaultServicesResponse>(`/backoffice/admin/barbers/${barberId}/services/sync-defaults`, {
      method: 'POST',
    })

  const adminGetBookings = (page = 1, pageSize = 100, filters: BookingFilters = {}) =>
    api<Booking[] | PaginatedResponse<Booking>>('/backoffice/bookings', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        master_id: filters.master_id ?? undefined,
        service_id: filters.service_id ?? undefined,
        status: filters.status || undefined,
      },
    })

  const adminGetCalendarBookings = (filters: CalendarBookingFilters) =>
    api<Booking[]>('/backoffice/calendar/bookings', {
      query: {
        date_from: filters.date_from,
        date_to: filters.date_to,
        master_id: filters.master_id ?? undefined,
        status: filters.status || undefined,
      },
    })

  const adminGetCalendarTimeBlocks = (filters: CalendarRangeFilters) =>
    api<TimeBlock[]>('/backoffice/calendar/time-blocks', {
      query: {
        date_from: filters.date_from,
        date_to: filters.date_to,
        master_id: filters.master_id ?? undefined,
      },
    })

  const adminCreateBooking = (payload: ManualBookingPayload) =>
    api<Booking>('/backoffice/bookings', {
      method: 'POST',
      body: payload,
    })

  const adminGetBooking = (bookingId: number | string) =>
    api<Booking>(`/backoffice/bookings/${bookingId}`)

  const adminUpdateBookingStatus = (bookingId: number | string, status: BookingStatus) =>
    api<Booking>(`/backoffice/bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: { status },
    })

  const adminUpdateBookingSchedule = (bookingId: number | string, payload: BookingSchedulePayload) =>
    api<Booking>(`/backoffice/bookings/${bookingId}`, {
      method: 'PATCH',
      body: payload,
    })

  const adminUpdateBookingPricing = (bookingId: number | string, payload: BookingPricingPayload) =>
    api<Booking>(`/backoffice/bookings/${bookingId}`, {
      method: 'PATCH',
      body: payload,
    })

  const adminDeleteBooking = (bookingId: number | string) =>
    api(`/backoffice/bookings/${bookingId}`, {
      method: 'DELETE',
    })

  const adminGetTimeBlocks = (page = 1, pageSize = 100, filters: { date_from?: string, date_to?: string, master_id?: number | null } = {}) =>
    api<TimeBlock[] | PaginatedResponse<TimeBlock>>('/backoffice/time-blocks', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        master_id: filters.master_id ?? undefined,
      },
    })

  const adminGetCalendarHolds = (filters: CalendarRangeFilters) =>
    api<CalendarHold[]>('/backoffice/calendar-holds', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        master_id: filters.master_id ?? undefined,
      },
    })

  const adminCreateTimeBlock = (payload: TimeBlockPayload) =>
    api<TimeBlock>('/backoffice/time-blocks', {
      method: 'POST',
      body: payload,
    })

  const adminDeleteTimeBlock = (blockId: number | string) =>
    api(`/backoffice/time-blocks/${blockId}`, {
      method: 'DELETE',
    })

  const adminGetAvailability = (filters: AvailabilityFilters) =>
    api<MasterAvailabilityWindow[]>('/backoffice/availability', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        master_id: filters.master_id ?? undefined,
      },
    })

  const adminCreateAvailabilityWindow = (payload: AvailabilityWindowPayload) =>
    api<MasterAvailabilityWindow>('/backoffice/availability/windows', {
      method: 'POST',
      body: payload,
    })

  const adminDeleteAvailabilityWindow = (windowId: number | string) =>
    api(`/backoffice/availability/${windowId}`, {
      method: 'DELETE',
    })

  const getBlogStatistics = (filters: { period_start?: string, period_end?: string } = {}) =>
    api<BlogSubscriptionAnalytics>('/backoffice/blog/statistics', {
      query: {
        period_start: filters.period_start || undefined,
        period_end: filters.period_end || undefined,
      },
    })

  const getBlogSubscriptions = (
    page = 1,
    pageSize = 20,
    filters: {
      status?: BlogSubscriptionStatus | '' | null
      q?: string
      source?: string
      language?: string
    } = {},
  ) =>
    api<PaginatedResponse<BlogSubscription>>('/backoffice/blog/subscriptions', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        status: filters.status || undefined,
        q: filters.q || undefined,
        source: filters.source || undefined,
        language: filters.language || undefined,
      },
    })

  const getBlogSubscriptionEvents = (
    page = 1,
    pageSize = 20,
    filters: {
      subscription_id?: number | null
      event_type?: BlogSubscriptionEventType | '' | null
    } = {},
  ) =>
    api<PaginatedResponse<BlogSubscriptionEvent>>('/backoffice/blog/events', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        subscription_id: filters.subscription_id ?? undefined,
        event_type: filters.event_type || undefined,
      },
    })

  const getMessagingDashboard = () =>
    api<MessagingDashboard>('/backoffice/messaging/dashboard').then(data => ({
      ...data,
      delivery_rate: normalizeDeliveryRate(data.delivery_rate),
    }))

  const getSegments = (query: { status?: 'active' | 'archived', limit?: number, offset?: number } = {}) =>
    api<SegmentList>('/backoffice/segments', { query })
  const getSegment = (id: number | string) => api<CustomerSegment>(`/backoffice/segments/${id}`)
  const createSegment = (body: SegmentCreate) =>
    api<CustomerSegment>('/backoffice/segments', { method: 'POST', body })
  const updateSegment = (id: number | string, body: SegmentUpdate) =>
    api<CustomerSegment>(`/backoffice/segments/${id}`, { method: 'PATCH', body })
  const archiveSegment = (id: number | string) =>
    api<CustomerSegment>(`/backoffice/segments/${id}/archive`, { method: 'POST' })
  const previewSegment = (body: SegmentPreviewRequest) =>
    api<SegmentPreviewResponse>('/backoffice/segments/preview', { method: 'POST', body })
  const getSegmentMembers = (id: number | string, query: SegmentMemberQuery = {}) =>
    api<SegmentPreviewResponse>(`/backoffice/segments/${id}/members`, { query })
  const previewCampaignAudience = (id: number | string, page = 1, pageSize = 50) =>
    api<CampaignAudiencePreview>(`/backoffice/messaging/campaigns/${id}/audience-preview`, {
      method: 'POST', query: { page, page_size: normalizePageSize(pageSize) },
    })
  const createCampaignRun = (id: number | string, body: CampaignRunCreate) =>
    api<CampaignRun>(`/backoffice/messaging/campaigns/${id}/runs`, { method: 'POST', body })
  const getCampaignRuns = (id: number | string, page = 1, pageSize = 50) =>
    api<PaginatedResponse<CampaignRun>>(`/backoffice/messaging/campaigns/${id}/runs`, {
      query: { page, page_size: normalizePageSize(pageSize) },
    })
  const getCampaignRun = (id: number | string, runId: number | string) =>
    api<CampaignRunDetail>(`/backoffice/messaging/campaigns/${id}/runs/${runId}`)
  const getCampaignRunMembers = (id: number | string, runId: number | string, page = 1, pageSize = 50) =>
    api<PaginatedResponse<CampaignRunMember>>(`/backoffice/messaging/campaigns/${id}/runs/${runId}/members`, {
      query: { page, page_size: normalizePageSize(pageSize) },
    })

  const getMessagingCampaigns = (
    page = 1,
    pageSize = 20,
    filters: {
      status?: string
      view?: 'campaigns' | 'notifications'
      type?: string
      channel?: string
      date_from?: string
      date_to?: string
      barber_id?: number | null
      recipient?: 'customer' | 'master'
    } = {},
  ) => {
    const backendStatus = ['draft', 'active', 'paused', 'completed', 'archived'].includes(filters.status || '') ? filters.status : undefined
    return api<PaginatedResponse<any>>('/backoffice/messaging/campaigns', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        status: backendStatus,
        view: filters.view,
        type: filters.type || undefined,
        channel: filters.channel || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        barber_id: filters.barber_id ?? undefined,
        recipient: filters.recipient || undefined,
      },
    }).then(normalizeCampaignPage)
  }

  const getMessagingCampaign = (campaignId: number | string) =>
    api<any>(`/backoffice/messaging/campaigns/${campaignId}`).then(normalizeCampaign)

  // Offer campaigns use the typed contract. The generic campaign adapter persists
  // legacy options in metadata, so it must not be used for this flow.
  const createNewMasterCampaign = (body: NewMasterCampaignInput) =>
    api<any>('/backoffice/messaging/campaigns', { method: 'POST', body }).then(normalizeCampaign)
  const updateNewMasterCampaign = (id: number | string, body: Partial<NewMasterCampaignInput>) =>
    api<any>(`/backoffice/messaging/campaigns/${id}`, { method: 'PATCH', body }).then(normalizeCampaign)
  const getCampaignReadiness = (id: number | string) =>
    api<CampaignReadiness>(`/backoffice/messaging/campaigns/${id}/readiness`)
  const getCampaignQueue = (id: number | string, runId: number | string) =>
    api<CampaignQueueProgress>(`/backoffice/messaging/campaigns/${id}/runs/${runId}/queue`)
  const cancelCampaignRunUnsent = (id: number | string, runId: number | string) =>
    api<{ cancelled_count: number }>(`/backoffice/messaging/campaigns/${id}/runs/${runId}/cancel-unsent`, { method: 'POST' })
  const pauseCampaign = (id: number | string) =>
    api<any>(`/backoffice/messaging/campaigns/${id}/pause`, { method: 'POST' }).then(normalizeCampaign)
  const resumeCampaign = (id: number | string) =>
    api<any>(`/backoffice/messaging/campaigns/${id}/resume`, { method: 'POST' }).then(normalizeCampaign)
  const getCampaignOfferAnalytics = (query: { campaign_id?: number; run_id?: number; master_id?: number; promotion_id?: number; date_from?: string; date_to?: string } = {}) =>
    api<CampaignOfferAnalytics>('/backoffice/messaging/campaign-offer-analytics', { query })

  const getSmsCampaigns = (
    page = 1,
    pageSize = 20,
    filters: { status?: string, recipient?: 'customer' | 'master' } = {},
  ) =>
    api<PaginatedResponse<any>>('/backoffice/messaging/sms-campaigns', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        status: filters.status || undefined,
        recipient: filters.recipient || undefined,
      },
    }).then(normalizeCampaignPage)

  const getSmsCampaign = (campaignId: number | string) =>
    api<any>(`/backoffice/messaging/sms-campaigns/${campaignId}`).then(normalizeCampaign)

  const ensureCampaignTemplate = async (payload: Partial<CampaignPayload>) => {
    if (payload.template_id) {
      // Inline campaign text is authoritative; selecting a shared template must
      // not rename or edit that template for other campaigns.
      return payload.template_id
    }
    if (!payload.message_body) return null
    const template = await createMessageTemplate({
      name: `${(payload.name || 'Campaign').trim().slice(0, 200)} template ${Date.now()}`,
      campaign_type: payload.type || 'manual',
      channel: payload.channel || 'telegram',
      language: 'uk',
      message_body: payload.message_body,
      variables: [],
      is_active: true,
      is_default: false,
    })
    return template.id
  }

  const createMessagingCampaign = async (payload: CampaignPayload) => {
    const body = campaignPayload(payload)
    const templateId = await ensureCampaignTemplate(payload)
    body.template_id = templateId
    return api<any>('/backoffice/messaging/campaigns', {
      method: 'POST',
      body,
    }).then(normalizeCampaign)
  }

  const updateMessagingCampaign = async (campaignId: number | string, payload: Partial<CampaignPayload>) => {
    const metadata = payload.metadata_json ?? (await getMessagingCampaign(campaignId)).metadata_json ?? {}
    return api<any>(`/backoffice/messaging/campaigns/${campaignId}`, {
      method: 'PUT',
      body: campaignUpdatePayload(payload, metadata),
    }).then(normalizeCampaign)
  }

  const createSmsCampaign = async (payload: CampaignPayload) => {
    const smsPayload = { ...payload, channel: 'sms' as const }
    const body = campaignPayload(smsPayload)
    const templateId = await ensureCampaignTemplate(smsPayload)
    body.template_id = templateId
    return api<any>('/backoffice/messaging/sms-campaigns', {
      method: 'POST',
      body,
    }).then(normalizeCampaign)
  }

  const updateSmsCampaign = (campaignId: number | string, payload: Partial<CampaignPayload>) =>
    api<any>(`/backoffice/messaging/sms-campaigns/${campaignId}`, {
      method: 'PUT',
      body: campaignPayload({ ...payload, channel: 'sms' }, payload.template_id),
    }).then(normalizeCampaign)

  const duplicateMessagingCampaign = (campaignId: number | string) =>
    api<any>(`/backoffice/messaging/campaigns/${campaignId}/duplicate`, {
      method: 'POST',
    }).then(normalizeCampaign)

  const updateMessagingCampaignStatus = (campaignId: number | string, status: string) =>
    api<any>(`/backoffice/messaging/campaigns/${campaignId}/status`, {
      method: 'PATCH',
      body: { status },
    }).then(normalizeCampaign)

  const deleteMessagingCampaign = (campaignId: number | string) =>
    api(`/backoffice/messaging/campaigns/${campaignId}`, {
      method: 'DELETE',
    })

  const sendMessagingCampaignTest = (campaignId: number | string, recipient?: string | null) =>
    api(`/backoffice/messaging/campaigns/${campaignId}/send-test`, {
      method: 'POST',
      body: { recipient },
    })

  const retryMessagingCampaignFailed = (campaignId: number | string) =>
    api(`/backoffice/messaging/campaigns/${campaignId}/retry-failed`, {
      method: 'POST',
    })

  const estimateMessagingAudience = (rules: AudienceRule[]) =>
    api<AudienceEstimate>('/backoffice/messaging/audience/estimate', {
      method: 'POST',
      body: { rules },
    })

  const previewMessagingRecipients = (rules: AudienceRule[], limit = 50) =>
    api<RecipientPreview[]>('/backoffice/messaging/audience/preview', {
      method: 'POST',
      body: { rules, limit },
    })

  const previewMessagingMessage = (payload: {
    template_id?: number | string | null
    campaign_id?: number | string | null
    body?: string | null
    customer_id: number | string
    appointment_id?: number | string | null
    extra_variables?: Record<string, string>
  }) =>
    api<{ rendered_message: string, variables: Record<string, string> }>('/backoffice/messaging/preview', {
      method: 'POST',
      body: payload,
    })

  const getMessageTemplates = (
    page = 1,
    pageSize = 20,
    filters: { search?: string, campaign_type?: string, channel?: string, language?: string, is_active?: boolean | null } = {},
  ) =>
    api<PaginatedResponse<any>>('/backoffice/messaging/templates', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        search: filters.search || undefined,
        campaign_type: filters.campaign_type || undefined,
        channel: filters.channel || undefined,
        language: filters.language || undefined,
        is_active: filters.is_active ?? undefined,
      },
    }).then(normalizeTemplatePage)

  const getMessageTemplate = (id: number | string) =>
    api<any>(`/backoffice/messaging/templates/${id}`).then(normalizeTemplate)

  const createMessageTemplate = (payload: MessageTemplatePayload) =>
    api<any>('/backoffice/messaging/templates', {
      method: 'POST',
      body: templatePayload(payload),
    }).then(normalizeTemplate)

  const updateMessageTemplate = (templateId: number | string, payload: Partial<MessageTemplatePayload>) =>
    api<any>(`/backoffice/messaging/templates/${templateId}`, {
      method: 'PUT',
      body: templatePayload(payload),
    }).then(normalizeTemplate)

  const duplicateMessageTemplate = (templateId: number | string) =>
    api<any>(`/backoffice/messaging/templates/${templateId}/duplicate`, {
      method: 'POST',
    }).then(normalizeTemplate)

  const deleteMessageTemplate = (templateId: number | string) =>
    api(`/backoffice/messaging/templates/${templateId}`, {
      method: 'DELETE',
    })

  const getMessagingCampaignLogs = (campaignId: number | string, page = 1, pageSize = 50) =>
    api<PaginatedResponse<any>>(`/backoffice/messaging/campaigns/${campaignId}/logs`, {
      query: { page, page_size: normalizePageSize(pageSize) },
    }).then(page => ({
      ...page,
      items: page.items.map(log => ({
        id: log.id,
        client_id: log.customer_id,
        client_name: log.customer_name || `Клієнт №${log.customer_id}`,
        phone: '',
        campaign_id: log.campaign_id,
        channel: log.channel,
        telegram_status: log.status,
        sent_at: log.created_at || null,
        failure_reason: log.error_reason,
      })),
    }))

  const getMessagingCampaignRecipients = (campaignId: number | string, page = 1, pageSize = 50, calculate = false) =>
    api<PaginatedResponse<MessageRecipient>>(`/backoffice/messaging/campaigns/${campaignId}/recipients`, {
      query: { page, page_size: normalizePageSize(pageSize), calculate: calculate || undefined },
    })

  const processPendingMessages = (limit?: number | null) =>
    api<{ processed: number }>('/backoffice/messaging/jobs/process-pending', {
      method: 'POST',
      query: { limit: limit ?? undefined },
    })

  const createReviewRequests = () =>
    api<{ created: number }>('/backoffice/messaging/jobs/create-review-requests', {
      method: 'POST',
    })

  const createAppointmentReminders = () =>
    api<{ created: number }>('/backoffice/messaging/jobs/create-appointment-reminders', {
      method: 'POST',
    })

  const sendBookingSmsReminders = () =>
    api<{ sent: number }>('/backoffice/messaging/jobs/send-booking-sms-reminders', {
      method: 'POST',
    })

  const getCustomerCommunication = (customerId: number | string) =>
    api<CustomerCommunicationProfile>(`/backoffice/messaging/customers/${customerId}/preferences`)

  const getCustomerTelegramConnectLink = (customerId: number | string) =>
    api<{ customer_id: number, bot_username: string, connect_link: string, expires_in_days: number }>(
      `/backoffice/messaging/customers/${customerId}/telegram-connect-link`,
    )

  const getMyMasterTelegramConnectLink = () =>
    api<{ master_id: number, bot_username: string, connect_link: string, expires_in_days: number, telegram_connected: boolean }>(
      '/backoffice/messaging/masters/me/telegram-connect-link',
    )

  const sendCustomerManualMessage = (customerId: number | string, body: string) =>
    api(`/backoffice/messaging/customers/${customerId}/messages`, {
      method: 'POST',
      body: { body, channel: 'telegram' },
    })

  const updateCustomerCommunication = (customerId: number | string, payload: Partial<CustomerCommunicationProfile>) =>
    api<CustomerCommunicationProfile>(`/backoffice/messaging/customers/${customerId}/preferences`, {
      method: 'PATCH',
      body: {
        telegram_chat_id: payload.telegram_chat_id,
        preferred_language: payload.preferred_language,
        marketing_consent: payload.marketing_consent === true ? 'opted_in'
          : payload.marketing_consent === false || payload.opt_out === true ? 'opted_out' : undefined,
        do_not_contact: payload.opt_out,
      },
    })

  const getMessagingSettings = () =>
    api<MessagingSettings>('/backoffice/messaging/settings')

  const updateMessagingSettings = (payload: Partial<MessagingSettings>) =>
    api<MessagingSettings>('/backoffice/messaging/settings', {
      method: 'PATCH',
      body: payload,
    })

  const adminGetReviews = (page = 1, pageSize = 20, filters: ReviewFilters = {}) =>
    api<PaginatedResponse<BookingReviewSummary>>('/backoffice/reviews', {
      query: {
        page,
        page_size: normalizePageSize(pageSize),
        moderation_status: filters.moderation_status || undefined,
        master_id: filters.master_id ?? undefined,
        rating: filters.rating ?? undefined,
        submitted_from: filters.submitted_from || undefined,
        submitted_to: filters.submitted_to || undefined,
        request_state: filters.request_state || undefined,
      },
    })

  const adminGetReview = (reviewId: number | string) =>
    api<BookingReviewDetail>(`/backoffice/reviews/${reviewId}`)

  const adminApproveReview = (reviewId: number | string) =>
    api<BookingReviewDetail>(`/backoffice/reviews/${reviewId}/approve`, {
      method: 'POST',
    })

  const adminRejectReview = (reviewId: number | string, reason?: string | null) =>
    api<BookingReviewDetail>(`/backoffice/reviews/${reviewId}/reject`, {
      method: 'POST',
      body: { reason: reason?.trim() || null },
    })

  const adminGetReviewMetrics = (
    filters: { date_from?: string, date_to?: string, master_id?: number | string | null } = {},
  ) =>
    api<unknown>('/backoffice/reviews/metrics', {
      query: {
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        master_id: filters.master_id ?? undefined,
      },
    }).then(parseReviewMetricsResponse)

  const adminGetMasterRatingStatistics = (masterId: number | string) =>
    api<MasterRatingStatistics>(`/backoffice/reviews/masters/${masterId}/statistics`)

  const adminGetMasterRatings = () =>
    api<MasterRatingStatistics[]>('/backoffice/reviews/masters/statistics')

  const getMyRatingStatistics = () =>
    api<MasterRatingStatistics>('/backoffice/reviews/masters/me/statistics')

  const getReviewRequestSettings = () =>
    api<ReviewRequestSettings>('/backoffice/reviews/request-settings')

  const updateReviewRequestSettings = (payload: ReviewRequestSettingsUpdate) =>
    api<ReviewRequestSettings>('/backoffice/reviews/request-settings', {
      method: 'PATCH',
      body: payload,
    })

  return {
    login,
    me,
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductImages,
    uploadProductImage,
    replaceProductImage,
    updateProductImage,
    reorderProductImages,
    deleteProductImage,
    getCategories,
    getCategoryTree,
    updateCategory,
    getBrands,
    updateBrand,
    getMockReconciliation,
    acknowledgeMockReconciliation,
    getMockFiscalReports,
    createMockFiscalReport,
    shareMockFiscalDocument,
    getMockReturns,
    createMockReturn,
    refundMockReturn,
    receiveMockReturn,
    createReturnFiscalMockPreview,
    getFiscalMockReadiness,
    runFiscalMockShift,
    createFiscalMockPreview,
    getFiscalMockPreview,
    submitFiscalMock,
    getFiscalMockDocuments,
    getFiscalMockDocument,
    runFiscalMockDocument,
    getFiscalMockPrint,
    getEttnMockProjects,
    createEttnMockPreview,
    getEttnMockPreview,
    armEttnMock,
    getEttnMockProject,
    runEttnMockProject,
    getProviderSandboxReadiness,
    createOrderSandboxQrAttempt,
    refreshSandboxQrAttempt,
    getMasterMonoState,
    startMasterMono,
    refreshMasterMono,
    getMasterMonoReceiptPdf,
    getQrMockReadiness,
    getOrderQrMockAttempts,
    createOrderQrMockAttempt,
    getQrMockAttempt,
    runQrMockAttempt,
    getQrMockReceipt,
    getPosCapabilities,
    createMockShipmentFixture,
    createOrderShipment,
    runShipmentCommand,
    getShipmentLabel,
    getShipmentSettlement,
    confirmShipmentCod,
    receiveShipmentReturn,
    createShipmentReturn,
    createPosOrder,
    recordOrderPayment,
    handoverOrder,
    getOrders,
    getOrder,
    updateOrderStatus,
    createOrderPreliminaryDocument,
    getOrderPreliminaryDocumentHtml,
    getInventoryStock,
    lookupInventoryProductByBarcode,
    bindInventoryBarcode,
    createInventoryProduct,
    getInventoryProduct,
    updateProductInventorySettings,
    getProcurementQueue,
    markProcurementOrdered,
    createInventoryReceipt,
    getInventoryReceipt,
    getInventoryReceipts,
    addInventoryReceiptItem,
    postInventoryReceipt,
    createInventoryOperation,
    getProductInventoryMovements,
    createInventoryCount,
    getInventoryCount,
    setInventoryCountItem,
    postInventoryCount,
    getOrderFulfillment,
    getCustomers,
    getCustomer,
    updateCustomer,
    getCustomerOrders,
    getCustomerBookings,
    getCustomerStats,
    getPublicMasters,
    getServices,
    getAvailableSlots,
    createPublicBooking,
    createMyManualBooking,
    getMyCalendar,
    getMyCalendarCapacity,
    getMyBookings,
    updateMyBookingStatus,
    getMyBooking,
    deleteMyBooking,
    getMyServices,
    updateMyService,
    getMyTimeBlocks,
    getMyCalendarHolds,
    createMyTimeBlock,
    deleteMyTimeBlock,
    getMyAvailability,
    createMyAvailabilityWindow,
    deleteMyAvailabilityWindow,
    getMyMonthlyStatistics,
    getBarberMonthlyStatistics,
    adminGetMonthlyStatistics,
    adminGetBarbersComparison,
    adminGetDashboard,
    adminGetBookingRecoverySummary,
    adminGetMasters,
    adminCreateMaster,
    adminUpdateMaster,
    adminGetServices,
    adminCreateService,
    adminUpdateService,
    adminGetBaseServices,
    adminCreateBaseService,
    adminUpdateBaseService,
    adminDeleteBaseService,
    adminGetPromotions,
    adminCreatePromotion,
    adminUpdatePromotion,
    adminDeletePromotion,
    adminGetShopPromotions,
    adminGetShopPromotion,
    adminGetShopPromotionProducts,
    adminCreateShopPromotion,
    adminUpdateShopPromotion,
    adminDeleteShopPromotion,
    adminPreviewShopPromotion,
    getMasterServices,
    createMasterService,
    updateMasterService,
    deleteMasterService,
    syncDefaultMasterServices,
    adminGetBookings,
    adminGetCalendarBookings,
    adminGetCalendarTimeBlocks,
    adminCreateBooking,
    adminUpdateBookingStatus,
    adminGetBooking,
    adminUpdateBookingSchedule,
    adminUpdateBookingPricing,
    adminDeleteBooking,
    adminGetTimeBlocks,
    adminGetCalendarHolds,
    adminCreateTimeBlock,
    adminDeleteTimeBlock,
    adminGetAvailability,
    adminCreateAvailabilityWindow,
    adminDeleteAvailabilityWindow,
    getBlogStatistics,
    getBlogSubscriptions,
    getBlogSubscriptionEvents,
    getMessagingDashboard,
    getSegments,
    getSegment,
    createSegment,
    updateSegment,
    archiveSegment,
    previewSegment,
    getSegmentMembers,
    previewCampaignAudience,
    createCampaignRun,
    getCampaignRuns,
    getCampaignRun,
    getCampaignRunMembers,
    getMessagingCampaigns,
    getMessagingCampaign,
    createNewMasterCampaign,
    updateNewMasterCampaign,
    getCampaignReadiness,
    getCampaignQueue,
    cancelCampaignRunUnsent,
    pauseCampaign,
    resumeCampaign,
    getCampaignOfferAnalytics,
    getSmsCampaigns,
    getSmsCampaign,
    createMessagingCampaign,
    updateMessagingCampaign,
    createSmsCampaign,
    updateSmsCampaign,
    duplicateMessagingCampaign,
    updateMessagingCampaignStatus,
    deleteMessagingCampaign,
    sendMessagingCampaignTest,
    retryMessagingCampaignFailed,
    estimateMessagingAudience,
    previewMessagingRecipients,
    previewMessagingMessage,
    getMessageTemplates,
    getMessageTemplate,
    createMessageTemplate,
    updateMessageTemplate,
    duplicateMessageTemplate,
    deleteMessageTemplate,
    getMessagingCampaignLogs,
    getMessagingCampaignRecipients,
    processPendingMessages,
    createReviewRequests,
    createAppointmentReminders,
    sendBookingSmsReminders,
    getCustomerCommunication,
    getCustomerTelegramConnectLink,
    getMyMasterTelegramConnectLink,
    sendCustomerManualMessage,
    updateCustomerCommunication,
    getMessagingSettings,
    updateMessagingSettings,
    adminGetReviews,
    adminGetReview,
    adminApproveReview,
    adminRejectReview,
    adminGetReviewMetrics,
    adminGetMasterRatingStatistics,
    adminGetMasterRatings,
    getMyRatingStatistics,
    getReviewRequestSettings,
    updateReviewRequestSettings,
  }
}
