export const notificationTypes: string[]
export function isNotificationType(type: string): boolean
export function channelStrategyLabel(strategy?: string | null, channel?: string | null): string
export function deliveryReasonLabel(value?: string | null): string
export function previewPageSummary(preview?: { total: number; items: { eligible: boolean; channel?: string | null }[] } | null): { audience: number | null; shown: number; eligible: number; excluded: number; sms: number; telegram: number }
