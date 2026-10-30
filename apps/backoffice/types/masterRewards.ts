export interface RewardPolicy { revision: number, rate_bps: number | null, currency: 'UAH' }
export interface RewardMaster { id: number, name: string }
export interface RewardCandidate { order_id: number, order_item_id: number, order_revision: number, product_id: number, product_name: string, quantity: number, base_minor: number, sold_at: string }
export interface RewardEntry { id: number, revision: number, order_id: number, order_item_id: number, master_id: number, master_name: string, product_id: number, product_name: string, quantity: number, base_minor: number, rate_bps: number, reward_minor: number, currency: 'UAH', sold_at: string, created_at: string, needs_review: boolean, settlement_id: number | null, status: 'pending' | 'needs_review' | 'transferred' }
export interface RewardSummary { master_id: number, master_name: string, sales_count: number, units: number, sales_net_minor: number, accrued_minor: number, transferred_minor: number, pending_minor: number, held_minor: number, balance_minor: number }
export interface RewardSettlement { id: number, master_id: number, master_name: string, total_minor: number, currency: 'UAH', paid_at: string, created_at: string, entry_ids: number[], status: 'transferred' }
export interface RewardPage<T> { items: T[], total: number, page: number, page_size: number }
export interface RewardSelection { master_id: number, entries: { id: number, expected_revision: number }[], expected_total_minor: number }
export interface RewardPreview { master_id: number, entry_ids: number[], total_minor: number, currency: 'UAH' }
export type RewardCommand = { kind: 'policy', method: 'PUT', path: '/policy', body: { expected_revision: number, rate_bps: number | null, reason: string } }
  | { kind: 'entry', method: 'POST', path: '/entries', body: { order_id: number, order_item_id: number, master_id: number, expected_order_revision: number, expected_policy_revision: number, reason: string } }
  | { kind: 'review', method: 'POST', path: string, body: { expected_revision: number, needs_review: boolean, reason: string } }
  | { kind: 'settlement', method: 'POST', path: '/settlements', body: RewardSelection & { paid_at: string, reason: string, manual_payment_confirmed: true } }
