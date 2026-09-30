export type InventoryDocumentStatus = 'draft' | 'posted' | string
export type InventoryMovementType =
  | 'opening_balance'
  | 'receipt'
  | 'customer_return'
  | 'write_off'
  | 'order_reservation'
  | 'order_release'
  | 'order_fulfillment'
  | 'inventory_adjustment'
  | string
export type ProcurementStatus = 'not_required' | 'to_order' | 'ordered' | 'received' | string
export type ManualInventoryOperationType = 'opening-balance' | 'receipt' | 'customer-return' | 'write-off'

export interface InventoryProduct {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  on_hand: number
  reserved: number
  available: number
  allow_backorder: boolean
}

export interface ProductInventorySettingsUpdate {
  barcode: string | null
  allow_backorder: boolean
}

export interface ProcurementQueueItem {
  product_id: number
  product_name: string
  sku: string | null
  barcode: string | null
  total_quantity_required: number
  requirements: ProcurementRequirement[]
}

export interface ProcurementRequirement {
  order_id: number
  order_item_id: number
  quantity_required: number
  quantity_ordered: number
  quantity_received: number
  procurement_status: ProcurementStatus
}

export interface ReceiptAllocation {
  order_item_id: number
  quantity: number
}

export interface InventoryReceiptCreate {
  reason: string
  comment?: string | null
}

export type InventoryProductIdentifier =
  | { product_id: number, barcode?: never }
  | { barcode: string, product_id?: never }

export type InventoryReceiptItemCreate = InventoryProductIdentifier & {
  quantity: number
  purchase_unit_cost: string | number
  batch_number?: string | null
  expiration_date?: string | null
  allocations?: ReceiptAllocation[]
}

export interface InventoryReceiptItem {
  id: number
  product_id: number
  barcode: string | null
  quantity: number
  purchase_unit_cost: string
  batch_number: string | null
  expiration_date: string | null
  allocations: ReceiptAllocation[]
}

export interface InventoryReceipt {
  id: number
  reason: string
  comment: string | null
  status: InventoryDocumentStatus
  posted_at: string | null
  created_at: string
  updated_at: string
  items: InventoryReceiptItem[]
}

export type InventoryManualOperationCreate = InventoryProductIdentifier & {
  quantity: number
  reason: string
  order_id?: number | null
  order_item_id?: number | null
}

export interface InventoryMovement {
  id: number
  product_id: number
  movement_type: InventoryMovementType
  quantity: number
  on_hand_delta: number
  reserved_delta: number
  reason: string | null
  order_id: number | null
  order_item_id: number | null
  admin_user_id: number | null
  receipt_id: number | null
  count_id: number | null
  created_at: string
}

export interface InventoryCountCreate {
  reason: string
}

export type InventoryCountItemUpsert = InventoryProductIdentifier & {
  counted_quantity: number
}

export interface InventoryCountItem {
  id: number
  product_id: number
  barcode: string | null
  expected_quantity: number | null
  counted_quantity: number
  difference: number | null
}

export interface InventoryCount {
  id: number
  reason: string
  status: InventoryDocumentStatus
  posted_at: string | null
  created_at: string
  updated_at: string
  items: InventoryCountItem[]
}
