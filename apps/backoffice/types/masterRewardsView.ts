// App-local presentation models. API responses are mapped at the page boundary.
export interface RewardEntryView {
  id: number
  orderId: number
  product: string
  soldAt: string
  quantity: number
  basisMinor: number
  rateBps: number
  rewardMinor: number
  state: string
  needsReview: boolean
  canSettle: boolean
  reason?: string | null
}
export interface RewardSettlementView {
  id: number
  master: string
  amountMinor: number
  handedAt: string
  recordedAt: string
  entryIds: number[]
}
