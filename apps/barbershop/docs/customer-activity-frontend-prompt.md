# Customer activity frontend implementation prompt

Implement the public customer-activity flow only inside `apps/barbershop`; do not move code to shared packages.

Build `/booking/manage#<opaque-capability>` and `/booking/cancel#<opaque-capability>` as noindex, no-referrer routes. On client mount, read and validate the token only from `window.location.hash`, retain it only in component memory, then immediately use `history.replaceState` to clear the fragment. Never use query parameters, local/session storage, SSR payload/state, analytics, Hotjar, or `console` for the token. The cancel route is an alias which shows the same modal and never cancels automatically.

Use local `BaseModal`, `BaseButton`, `useApi`, and `useBarbershopDomain`. Auto-open a right-side “Мої записи” / “My appointments” modal, and return home after it closes. Include an accessible header link to `/booking/manage`; direct visits without an SMS fragment must ask for the secure link, not phone/OTP.

Centralize this backend contract in `domain/barbershop.ts` so future transport changes remain local:

* `GET /public/customer-activity` with `X-Customer-Activity-Token` returns `{ bookings, waitlist }`.
* `POST /public/customer-activity/bookings/{public_id}/cancel` with the same header.
* `POST /public/customer-activity/waitlist/{public_id}/cancel` with the same header.

Production uses the existing same-origin `/api/v1` Nitro proxy. Forward
`X-Customer-Activity-Token` only for the exact `public/customer-activity` route
family; do not add it to a generic public proxy allowlist or expose it to an
unrelated upstream.

Render confirmed bookings and active/offered waitlist entries with master, service names, Europe/Kyiv date/time, empty/loading/expired/network states, retry, and success feedback. Each cancellation needs an explicit in-modal confirmation. Move keyboard focus into that confirmation region. After confirmation, reload activity and show success; prevent dismissal and duplicate actions while the cancellation is in flight.

Prevent Google Analytics, Hotjar, and app event tracking on both routes. Add focused tests for fragment-only parsing, URL cleanup/privacy, endpoint/header shapes, and then run tests plus typecheck/build.
