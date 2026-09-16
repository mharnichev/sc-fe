# First-visit promotion frontend contract

Implemented locally in `apps/barbershop` and `apps/backoffice`, against the sibling backend's `docs/first-visit-promotions-api.md` and current schemas. No shared package extraction or SMS integration.

## Required backend rollout

Before releasing this frontend, deploy the backend first-visit promotion implementation and apply migration `0071_first_visit_promotions` using the backend's normal process. The migration creates the initial 20% record; the frontend never seeds or assumes a first-visit percentage.

- `GET /api/v1/public/booking-promotions`: currently available public terms, including mode, eligibility, percentage, dates, and master/base-service scope. Discovery is not eligibility. Removed offers disappear on refresh/focus and periodic visible-tab refresh; errors clear public messaging.
- `POST /api/v1/public/bookings/quote`: selected master, service IDs, scheduled start, normalized customer phone, and optional explicit promotion code. All subtotal, discount, percentage and total displays in the review come from this response. Quotes are private and not cached.
- Existing promotion administration: `application_mode: code | automatic`, `eligibility_type: first_visit`, editable integer `discount_percent: 1..100`, scope, dates, `is_public`, and `is_active`. `code` remains a required internal identifier for automatic records and is never auto-submitted as a customer code.
- Existing booking creation: applies promotions server-side, returns saved `total_amount`. Explicit valid codes take precedence; promotions do not stack. No frontend visit-history lookup or eligibility rule exists.

The public `not_available` response deliberately does not identify returning customers. Copy explains that first-visit offers are for new customers across all masters without asserting private visit history. Regular-price booking is permitted after the returned total is reviewed. Master/service changes invalidate price review; they never reset customer eligibility.

## Atomic price approval

Implemented with the sibling backend's optional `expected_total_amount` contract. The frontend re-quotes immediately before submission, checks that the inputs and approved pricing are unchanged, then captures that exact approved quote's integer total (including zero) for booking creation. The backend must be deployed with this field/check before this frontend is released.

The backend independently calculates pricing and entitlement in the booking transaction. A mismatched total returns structured `409 detail.code=price_changed` before booking commit or notification scheduling and rolls back customer creation/enrichment. The frontend clears approval, fetches a new quote, and returns to price review without clearing the selected time or automatically resubmitting. Even an identical replacement quote requires fresh approval. The error's `total_amount` is informational and is never treated as an approved quote.

This guarantees equality of the approved and newly saved total for participating callers, not unchanged promotion metadata or a reserved quote. Legacy callers omitting the optional field (or passing null) retain prior server-authoritative behavior. There are no secure tokens, expiry, replay protection or new idempotency semantics. Zero is supported; negative/non-integer values are invalid. The actual booking response is still shown on success. No deployment was performed as part of this task.

## Verification

Behavior tests exercise backend quote acceptance, returning/unavailable responses, percentage changes, scoped discount amounts, explicit code precedence, stale responses after selection/customer changes, missing-customer responses and failure recovery. Price tests cover captured totals, zero, pending revalidation, and conflict approval revocation. Backend `tests/test_booking_price_approval.py` uses isolated local PostgreSQL schemas and mocked notifications to cover concurrent reservations, promotion/service price edits, rollback, matching totals, and legacy omission. Backoffice tests execute form validation and payload generation. Browser checks use intercepted API fixtures and never create real bookings. Production guarantees require the backend rollout above.
