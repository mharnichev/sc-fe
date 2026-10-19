export interface NpSettlement { ref: string; city_ref: string | null; name: string; label: string; area: string; region: string; delivery_available: boolean }
export interface NpBranch { ref: string; settlement_ref: string; city_ref: string | null; number: string; name: string; label: string; address: string; type: 'warehouse' | 'postomat'; status: string }
export interface NpStreet { ref: string; name: string; label: string }
export interface NpDirectory<T> { items: T[]; cached: boolean; updated_at: string | null; stale: boolean }
