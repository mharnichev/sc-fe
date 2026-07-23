export type ReviewModerationStatus = 'pending' | 'approved' | 'rejected'
export type ReviewRequestState = 'scheduled' | 'sent' | 'delivered' | 'submitted' | 'expired' | 'failed'

export interface ReviewMasterSummary {
  id: number
  full_name?: string | null
  full_name_uk?: string | null
  first_name_uk?: string | null
  last_name_uk?: string | null
}

export interface ReviewRequestEvent {
  id: number | string
  state: ReviewRequestState
  channel?: 'telegram' | 'sms' | string | null
  occurred_at: string
  failure_reason?: string | null
}

export interface ReviewModerationEvent {
  id: number | string
  action: 'submitted' | 'approved' | 'rejected' | string
  actor_display_name?: string | null
  reason?: string | null
  occurred_at: string
}

export interface BookingReviewSummary {
  id: number | string
  master_id: number
  master: ReviewMasterSummary
  booking_reference: string
  rating: number
  text?: string | null
  moderation_status: ReviewModerationStatus
  requested_at?: string | null
  submitted_at: string
  moderated_at?: string | null
  request_state?: ReviewRequestState | null
}

export interface BookingReviewDetail extends BookingReviewSummary {
  moderation_reason?: string | null
  moderation_history: ReviewModerationEvent[]
  request_history: ReviewRequestEvent[]
}

export interface ReviewFilters {
  moderation_status?: ReviewModerationStatus | ''
  master_id?: number | null
  rating?: number | null
  submitted_from?: string
  submitted_to?: string
  request_state?: ReviewRequestState | ''
}

export interface MasterRatingStatistics {
  master_id: number
  master?: ReviewMasterSummary | null
  approved_average_rating: number | null
  approved_review_count: number
  pending_review_count: number
  rating_distribution?: Partial<Record<1 | 2 | 3 | 4 | 5, number>> | null
}

export interface ReviewMetrics {
  eligible_completed_visits: number
  requests_scheduled: number
  requests_sent: number
  requests_delivered: number
  review_form_opens: number
  submitted_reviews: number
  approved_reviews: number
  review_conversion_rate: number
  average_moderation_time_minutes: number | null
  average_rating_by_master: MasterRatingStatistics[]
}

export interface ReviewRequestSettings {
  enabled: boolean
  delay_minutes: number
  primary_channel: 'sms'
  sms_fallback_enabled: false
  quiet_hours_enabled: boolean
  quiet_hours_from: string
  quiet_hours_to: string
  frequency_cap_count: 1
  frequency_cap_days: number
  submitted_frequency_cap_days: number
  exclusions: string[]
  template_preview: string
  updated_at?: string | null
}

export interface ReviewRequestSettingsUpdate {
  enabled: boolean
  delay_minutes: number
  primary_channel: 'sms'
  sms_fallback_enabled: false
  quiet_hours_enabled: boolean
  quiet_hours_from: string
  quiet_hours_to: string
  frequency_cap_count: 1
  frequency_cap_days: number
  submitted_frequency_cap_days: number
  exclusions: string[]
}
