/** Mirrors the strict customer-segments backend contract; membership is server evaluated. */
export type SegmentPeriod = {
  last?: number | null
  unit?: 'days' | 'calendar_months'
  start?: string | null
  end?: string | null
}

export type SegmentCondition =
  | { type: 'last_visit_age', min?: number | null, max?: number | null, unit: 'days' | 'calendar_months', min_inclusive?: boolean, max_inclusive?: boolean }
  | { type: 'completed_visit_count', min?: number | null, max?: number | null, period?: SegmentPeriod | null }
  | { type: 'upcoming_booking', present: boolean }
  | { type: 'visited_master', master_ids: number[], mode: 'last' | 'within_period', period?: SegmentPeriod | null }
  | { type: 'received_service', service_ids: number[], period: SegmentPeriod }
  | { type: 'first_visit', period: SegmentPeriod }
  | { type: 'received_campaign', campaign_id: number, period?: SegmentPeriod | null }
  | { type: 'marketing_contact', period: SegmentPeriod, present: boolean }

export interface SegmentRules {
  combine: 'all' | 'any'
  conditions: SegmentCondition[]
  exclusions: SegmentCondition[]
}

export interface CustomerSegment {
  id: number
  name: string
  description: string | null
  status: 'active' | 'archived'
  rules: SegmentRules
  revision: number
  created_at: string
  updated_at: string
  archived_at: string | null
}
export type Segment = CustomerSegment
export interface SegmentCreate { name: string, description?: string | null, rules: SegmentRules }
export interface SegmentUpdate extends Partial<SegmentCreate> { expected_revision: number }
export interface SegmentList { items: CustomerSegment[], total: number, limit: number, offset: number }
export interface SegmentExplanation {
  rule: SegmentCondition
  matched: boolean
  value: unknown
  [key: string]: unknown
}
export interface SegmentMember {
  customer_id: number
  name: string | null
  phone: string
  history_state: 'known' | 'no_visits' | 'unknown'
  last_visit_at: string | null
  completed_visit_count: number
  first_completed_visit_at: string | null
  has_upcoming_booking: boolean
  conditions: SegmentExplanation[]
  exclusions: SegmentExplanation[]
}
export interface SegmentMemberQuery { evaluated_at?: string, limit?: number, offset?: number }
export interface SegmentPreviewRequest extends SegmentMemberQuery { rules: SegmentRules }
export interface SegmentPreviewResponse {
  evaluated_at: string
  timezone: 'Europe/Kyiv'
  total: number
  items: SegmentMember[]
  limit: number
  offset: number
}

export type CampaignChannelStrategy = 'single' | 'telegram_then_sms' | 'sms_then_telegram'
export interface CampaignSegmentOptions {
  segment_ids?: number[]
  channel_strategy?: CampaignChannelStrategy
  exclude_returned_since_snapshot?: boolean
  exclude_upcoming_booking?: boolean
  marketing_frequency_days?: number
}
export interface CampaignAudiencePreviewMember {
  customer_id: number
  name: string | null
  eligible: boolean
  exclusion_reason: string | null
  channel: string | null
  reachability: Record<string, boolean>
  facts: Record<string, unknown>
}
export interface CampaignAudiencePreview {
  evaluated_at: string
  total: number
  page: number
  page_size: number
  items: CampaignAudiencePreviewMember[]
}
export interface CampaignRunCreate { idempotency_key: string, scheduled_at?: string | null }
export interface CampaignRun {
  id: number
  campaign_id: number
  idempotency_key: string
  status: string
  scheduled_at: string | null
  evaluated_at: string | null
  segment_snapshots: Array<{ id?: number, segment_id?: number, name?: string, revision?: number, rules?: SegmentRules, [key: string]: unknown }>
  campaign_snapshot: Record<string, unknown>
  audience_count: number
  created_at: string
  updated_at: string
}
export interface CampaignRunDetail extends CampaignRun { delivery_counts: Record<string, number> }
export interface CampaignRunMember {
  id: number
  campaign_id: number
  customer_id: number
  run_id: number
  channel: string
  status: string
  snapshot_facts: Record<string, unknown> | null
  send_started_at: string | null
  attempts: number
  sent_at: string | null
  delivered_at?: string | null
  scheduled_at: string | null
  rendered_message?: string | null
  provider_message_id: string | null
  last_error: string | null
}
