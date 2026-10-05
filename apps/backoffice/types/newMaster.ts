export interface NewMasterCampaignInput {
  name: string
  type: 're_engagement'
  status: 'draft'
  channel: 'sms'
  channel_strategy: 'single' | 'telegram_then_sms'
  purpose: 'marketing'
  recipient: 'customer'
  timezone: 'Europe/Kyiv'
  template_id: number
  segment_ids: number[]
  offer_master_id: number
  offer_promotion_id: number
  offer_service_ids: number[]
  master_name_for_message: string
  offer_starts_at?: string | null
  offer_expires_at?: string | null
  sending_window: { start: string; end: string; days: number[] }
  sms_recipients_per_minute: number
  marketing_frequency_days: number
  marketing_max_contacts: number
  marketing_cap_days: number
  exclude_upcoming_booking: true
  exclude_returned_since_snapshot: true
}

export interface CampaignReadiness {
  ready: boolean
  checks: { code: string; status: string; detail: string }[]
  runtime_verification: string
  balance: { status: string; amount: number | null; currency?: string | null }
}

export interface CampaignOfferAnalytics {
  period_basis?: 'run_cohort'
  audience_size: number
  communication_eligible_recipients: number
  provider_accepted: number
  delivered: number
  raw_link_requests: number
  confirmed_page_opens: number
  unique_confirmed_openers: number
  bookings_created: number
  cancelled_bookings: number
  no_show: number
  completed_visits: number
  unique_customers_redeemed: number
  total_discount_amount: number
  observed_completed_revenue: number
  booking_conversion_percent: number | null
  redemption_conversion_percent: number | null
}

export interface CampaignQueueProgress {
  total: number
  counts: Record<string, number>
  dispatching: number
  paused: boolean
  cancelled: boolean
  sms_recipients_per_minute: number
  estimated_remaining_seconds: number | null
  estimated_completion_at: string | null
  next_window_at: string | null
  estimate_kind: 'dispatch' | 'delivery'
  estimate_note: string
}
