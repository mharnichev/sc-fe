import type { InventoryReceiptItem, InventoryReceiptItemChange, ReceiptAllocation } from '~/types/inventory'

export interface PendingReceiptEdit {
  userId: number
  receiptId: number
  itemId: number
  kind: 'update' | 'remove' | 'correct'
  key: string
  payload: Pick<InventoryReceiptItemChange, 'expected_revision' | 'reason'> & Partial<Pick<InventoryReceiptItemChange, 'quantity' | 'purchase_unit_cost'>> & { allocations?: ReceiptAllocation[] }
  item: InventoryReceiptItem
}
export const receiptEditStorageKey = (userId: number, receiptId: number) => `backoffice:inventory:receipt-edit:${userId}:${receiptId}`

export const restoreReceiptEdit = (raw: string | null, userId: number, receiptId: number): PendingReceiptEdit | null => {
  if (!raw) return null
  const value = JSON.parse(raw)
  const p = value?.payload
  if (value?.userId !== userId || value?.receiptId !== receiptId || !Number.isInteger(value?.itemId) || value.itemId < 1
    || !['update', 'remove', 'correct'].includes(value.kind) || typeof value.key !== 'string' || !value.key.trim() || value.key.length > 128
    || !Number.isInteger(p?.expected_revision) || p.expected_revision < 1 || typeof p?.reason !== 'string' || !p.reason.trim() || p.reason.length > 255
    || value.item?.id !== value.itemId || !Number.isInteger(value.item?.product_id)
    || !Array.isArray(value.item?.allocations)) throw new Error('Invalid pending receipt edit')
  if (value.kind !== 'remove' && (!Number.isInteger(p.quantity) || p.quantity < (value.kind === 'correct' ? 0 : 1) || p.quantity > 1000000
    || typeof p.purchase_unit_cost !== 'string' || !/^\d{1,8}\.\d{2}$/.test(p.purchase_unit_cost))) throw new Error('Invalid pending receipt edit values')
  if (value.kind === 'update' && (!Array.isArray(p.allocations) || p.allocations.length > 100 || p.allocations.some((a: ReceiptAllocation) => !Number.isInteger(a?.order_item_id) || a.order_item_id < 1 || !Number.isInteger(a.quantity) || a.quantity < 1))) throw new Error('Invalid pending allocations')
  const allowed = value.kind === 'remove' ? ['expected_revision', 'reason'] : value.kind === 'correct' ? ['expected_revision', 'reason', 'quantity', 'purchase_unit_cost'] : ['expected_revision', 'reason', 'quantity', 'purchase_unit_cost', 'allocations']
  if (Object.keys(p).some(key => !allowed.includes(key))) throw new Error('Invalid pending receipt edit fields')
  return value
}
