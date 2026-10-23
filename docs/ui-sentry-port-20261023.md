# UI And Shop Sentry Port

## Scope

Port compact product administration, product galleries, catalog/recently-viewed
layout and checkout contact/summary layout onto current main `bc702276`.
Add Shop Sentry 10.76.2 with manual commerce events only, no automatic
integrations, replay, tracing or default PII collection. Reconstruct events
from safe fields, bound incident frequency and clear isolation breadcrumbs
on session changes. No production test event is permitted.

Preserve the current backend, schema, public/blog images, session revisions,
durable checkout intent identity, private recovery fragments, base-aware
assets and closed Shop pilot. No secrets or customer data belong in evidence.

## Exclusions

Do not port disputed ingredient parsing or stock hiding for masters.
Do not port payment-method switching: the current backend has no corresponding
public API. Preserve the existing payment start/read and verified online-origin
order presentation. Do not copy older auth, backend or infrastructure variants.

## Gates

Run all Shop/backoffice unit tests, all four app typechecks, affected production
builds, independent reviews, mounted BaseMultiSelect/product-form checks and
mock browser scenarios for catalog widths, permissions and checkout recovery.
The real installed Sentry SDK must serialize scrubbed events through an in-memory
transport without networking. Use immutable Linux application digests and a
normal green infrastructure PR/deployment. No migrations or backend/env changes.

Acceptance is read-only: inspect deployed assets, product edit initial values
without saving, service health, image IDs, owner schedulers, unchanged service
identities/env hashes, and unchanged public-checkout/pilot flags. No real orders,
payments, receipts, shipments, emails, SMS, OTP or Sentry events may be generated.
