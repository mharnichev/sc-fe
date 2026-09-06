import type { SegmentRules, SegmentCondition, SegmentPeriod, SegmentMember } from '../types/segments'
export const ruleTypes: { value: SegmentCondition['type']; label: string }[]
export const periodUnits: { value: string; label: string }[]
export function defaultPeriod(): SegmentPeriod
export function defaultCondition(type?: string): SegmentCondition
export function defaultSegmentRules(): SegmentRules
export function formatSegmentTime(value?: string | null): string
export function summarizePeriod(period?: SegmentPeriod | null): string
export type SegmentSummaryLabels = { masters?: Record<number, string>; services?: Record<number, string>; campaigns?: Record<number, string> }
export function summarizeCondition(rule: SegmentCondition, labels?: SegmentSummaryLabels): string
export function summarizeRules(rules?: SegmentRules | null, labels?: SegmentSummaryLabels): string
export function validateRules(rules: SegmentRules): string[]
export function describeMember(member: SegmentMember): string
export function segmentApiError(error: unknown): string
export function createPreviewGate(): { begin(): number; invalidate(): void; isCurrent(token: number): boolean }

export function loadSegmentServiceOptions<T extends { id: number | string; is_active?: boolean }>(masters: {value: number;label: string}[], fetchMasterServices: (id: number) => Promise<T[] | {items: T[];total: number}>, serviceLabel: (service: T) => string): Promise<{value: number;label: string}[]>
