export type MessagingChannel = 'telegram' | 'sms' | 'whatsapp' | 'email'

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'

export type CampaignType =
  | 'manual'
  | 'post_visit_review_request'
  | 'appointment_reminder'
  | 'birthday_greeting'
  | 're_engagement'
  | 'first_visit_follow_up'
  | 'loyalty_vip'

export type AudienceRuleType =
  | 'all_clients'
  | 'selected_barber'
  | 'visited_date_range'
  | 'inactive_clients'
  | 'first_time_clients'
  | 'vip_clients'
  | 'birthday_this_month'
  | 'selected_service'
  | 'specific_clients'

export interface AudienceRule {
  type: AudienceRuleType
  barber_id?: number | null
  service_id?: number | null
  date_from?: string | null
  date_to?: string | null
  inactive_days?: number | null
  client_ids?: number[]
}

export interface AudienceEstimate {
  total: number
  eligible: number
  missing_chat_id: number
  opted_out: number
  excluded: number
}

export interface CampaignMetrics {
  total_recipients: number
  sent: number
  failed: number
  skipped: number
  delivery_rate: number
  clicks?: number | null
  reviews_received?: number | null
}

export interface MessagingDashboard {
  active_campaigns: number
  scheduled_campaigns: number
  messages_sent: number
  failed_messages: number
  delivery_rate: number
  review_requests_sent: number
  recent_activity: CampaignActivity[]
}

export interface CampaignActivity {
  id: number | string
  campaign_id?: number | string | null
  title: string
  description: string
  status: CampaignStatus | 'sent' | 'retrying'
  created_at: string
}

export interface MessagingCampaign {
  id: number | string
  name: string
  type: CampaignType
  channel: MessagingChannel
  status: CampaignStatus
  audience_size: number
  sent_count: number
  failed_count: number
  scheduled_at: string | null
  created_by: string
  created_at: string
  updated_at?: string | null
  message_body?: string | null
  audience_rules?: AudienceRule[]
  audience_estimate?: AudienceEstimate | null
  metrics?: CampaignMetrics | null
  review_link?: string | null
  timezone?: string | null
}

export interface CampaignPayload {
  name: string
  type: CampaignType
  channel: MessagingChannel
  status: 'draft' | 'active'
  template_id?: number | string | null
  message_body: string
  language_versions?: Record<string, string>
  audience_rules: AudienceRule[]
  review_platform?: string | null
  review_link?: string | null
  promo_code?: string | null
  inline_button_text?: string | null
  follow_up_after_days?: number | null
  schedule_mode: 'now' | 'later' | 'automated'
  scheduled_at?: string | null
  timezone: string
  automation_delay?: string | null
  max_messages_per_minute: number
  quiet_hours_enabled: boolean
  quiet_hours_from?: string | null
  quiet_hours_to?: string | null
  duplicate_protection_days: number
}

export interface MessageTemplate {
  id: number | string
  name: string
  campaign_type: CampaignType
  channel: MessagingChannel
  language: string
  message_body: string
  variables: string[]
  is_active: boolean
  is_default: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type MessageTemplatePayload = Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at'>

export interface RecipientPreview {
  id: number
  name: string
  phone: string
  barber_name?: string | null
  telegram_chat_id?: string | null
  marketing_consent: boolean
  opt_out: boolean
  preferred_language?: string | null
  eligible: boolean
  exclusion_reason?: string | null
}

export interface SendLog {
  id: number | string
  client_id: number | string
  client_name: string
  phone: string
  telegram_status: 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped'
  sent_at: string | null
  failure_reason?: string | null
}

export interface CustomerCommunicationProfile {
  telegram_chat_id?: string | null
  telegram_status: 'connected' | 'missing' | 'blocked'
  marketing_consent: boolean
  opt_out: boolean
  preferred_language: string
  message_history: SendLog[]
  review_requests: SendLog[]
}

export interface MessagingSettings {
  telegram_bot_status: 'connected' | 'degraded' | 'offline'
  default_review_links: Record<string, string>
  default_template_ids: Record<CampaignType, number | string | null>
  quiet_hours_from: string
  quiet_hours_to: string
  default_rate_limit: number
  default_timezone: string
  opt_out_text: string
  test_recipient_chat_id?: string | null
  multi_location_enabled: boolean
}
