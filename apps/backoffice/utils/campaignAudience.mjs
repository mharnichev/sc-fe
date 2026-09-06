export const notificationTypes = ['booking_confirmation', 'appointment_reminder', 'post_visit_review_request', 'master_schedule_reminder', 'master_booking_created', 'master_booking_cancelled']
export const isNotificationType = type => notificationTypes.includes(type)
export const channelStrategyLabel = (strategy, channel) => ({
  telegram_then_sms: 'Telegram, інакше SMS',
  sms_then_telegram: 'SMS, інакше Telegram',
  single: `Один канал: ${channel || '—'}`,
}[strategy || 'single'] || strategy)
export function previewPageSummary(preview) {
  const items = preview?.items || []
  return {
    audience: preview?.total ?? null,
    shown: items.length,
    eligible: items.filter(item => item.eligible).length,
    excluded: items.filter(item => !item.eligible).length,
    sms: items.filter(item => item.eligible && item.channel === 'sms').length,
    telegram: items.filter(item => item.eligible && item.channel === 'telegram').length,
  }
}
export const deliveryReasonLabel = value => ({
  'Client is marked do-not-contact': 'Клієнт заборонив контакт',
  'Client is blacklisted': 'Контакт із клієнтом заблоковано',
  'Client has no marketing consent': 'Немає згоди на маркетингові повідомлення',
  'Client opted out of marketing messages': 'Клієнт відмовився від маркетингових повідомлень',
  'Client opted out of transactional messages': 'Клієнт відмовився від сервісних повідомлень',
  'Client has no Telegram chat_id': 'Telegram не підключено',
  'Client has no phone': 'Немає номера телефону',
  customer_inactive: 'Клієнт неактивний',
  channel_unreachable: 'Немає доступної адреси каналу',
  marketing_opted_out: 'Відмова від маркетингових повідомлень',
  upcoming_booking: 'Є майбутнє бронювання',
  returned_since_snapshot: 'Клієнт повернувся після фіксації аудиторії',
  marketing_frequency_cap: 'Обмеження частоти маркетингових повідомлень',
  missing_chat_id: 'Telegram не підключено',
  opted_out: 'Відмова від повідомлень',
  marketing_consent: 'Немає маркетингової згоди',
  channel_unavailable: 'Канал недоступний',
  inactive_customer: 'Клієнт неактивний',
}[value] || value || '—')
