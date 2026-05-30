import type { CampaignStatus, CampaignType, MessagingChannel } from '~/types/messaging'

export const useMessagingUi = () => {
  const variables = [
    '{{client_name}}',
    '{{barber_name}}',
    '{{appointment_date}}',
    '{{appointment_time}}',
    '{{service_name}}',
    '{{barbershop_name}}',
    '{{review_link}}',
    '{{discount_code}}',
  ]

  const campaignTypes: Array<{ value: CampaignType, label: string, helper: string }> = [
    { value: 'manual', label: 'Ручна кампанія', helper: 'Разова розсилка вибраній аудиторії.' },
    { value: 'post_visit_review_request', label: 'Запит відгуку після візиту', helper: 'Автоматично після завершення бронювання.' },
    { value: 'appointment_reminder', label: 'Нагадування про запис', helper: 'Перед майбутнім візитом клієнта.' },
    { value: 'birthday_greeting', label: 'Привітання з днем народження', helper: 'Для клієнтів з днем народження цього місяця.' },
    { value: 're_engagement', label: 'Повернення неактивних клієнтів', helper: 'Для клієнтів без візитів певний час.' },
    { value: 'first_visit_follow_up', label: 'Після першого візиту', helper: 'Підтримати контакт з новим клієнтом.' },
    { value: 'loyalty_vip', label: 'VIP повідомлення', helper: 'Персональні пропозиції для найцінніших клієнтів.' },
  ]

  const channels: Array<{ value: MessagingChannel, label: string, enabled: boolean }> = [
    { value: 'telegram', label: 'Telegram', enabled: true },
    { value: 'sms', label: 'SMS', enabled: false },
    { value: 'whatsapp', label: 'WhatsApp', enabled: false },
    { value: 'email', label: 'Email', enabled: false },
  ]

  const campaignTypeLabel = (type?: string | null) =>
    campaignTypes.find(item => item.value === type)?.label || 'Кампанія'

  const channelLabel = (channel?: string | null) =>
    channels.find(item => item.value === channel)?.label || channel || 'Канал'

  const statusLabel = (status?: string | null) => ({
    draft: 'Чернетка',
    active: 'Активна',
    scheduled: 'Запланована',
    paused: 'На паузі',
    completed: 'Завершена',
    archived: 'Архів',
    failed: 'Помилка',
    sent: 'Надіслано',
    retrying: 'Повтор',
  }[status || ''] || 'Невідомо')

  const statusClass = (status?: CampaignStatus | string | null) => ({
    draft: 'bg-slate-100 text-slate-600',
    active: 'bg-emerald-50 text-emerald-700',
    scheduled: 'bg-cyan-50 text-cyan-700',
    paused: 'bg-amber-50 text-amber-700',
    completed: 'bg-indigo-50 text-indigo-700',
    archived: 'bg-slate-100 text-slate-500',
    failed: 'bg-rose-50 text-rose-700',
    sent: 'bg-emerald-50 text-emerald-700',
    retrying: 'bg-amber-50 text-amber-700',
  }[status || ''] || 'bg-slate-100 text-slate-600')

  const interpolateMessage = (body: string, sample: Record<string, string>) =>
    variables.reduce((value, variable) => {
      const key = variable.replace(/[{}]/g, '')
      return value.replaceAll(variable, sample[key] || variable)
    }, body)

  const sampleClient = {
    client_name: 'Олена',
    barber_name: 'Андрій',
    appointment_date: '31.05.2026',
    appointment_time: '15:30',
    service_name: 'Стрижка та борода',
    barbershop_name: 'Soul Cuts',
    review_link: 'https://g.page/r/example',
    discount_code: 'SOUL10',
  }

  return {
    variables,
    campaignTypes,
    channels,
    campaignTypeLabel,
    channelLabel,
    statusLabel,
    statusClass,
    interpolateMessage,
    sampleClient,
  }
}
