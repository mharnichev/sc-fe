# Barbershop analytics

## Sources of truth

- The backoffice booking funnel is authoritative for booking conversion. It uses
  persisted, HMAC-hashed attempt IDs and a server-side `booking_success`.
- The backoffice review funnel is authoritative for request, open, and
  submission conversion. Opens are persisted once per review request.
- GA4 is used for acquisition, UI behavior, and attribution. Consent or browser
  blocking can make its totals lower than the server-side funnels.
- Hotjar is qualitative only and must not be used as a conversion denominator.

## GA4 property checklist

The app sends router pageviews manually and initializes gtag with
`send_page_view: false`.

1. In the web data stream's Enhanced Measurement settings, disable
   **Page changes based on browser history events**. Google documents that
   history-based pageviews are otherwise sent independently of
   `send_page_view: false`:
   <https://developers.google.com/analytics/devguides/collection/ga4/views>
2. Mark `booking_success` and `review_submitted` as key events when they are
   required for acquisition reporting.
3. Create only the event-scoped custom dimensions that are actually used in
   reports. Useful low-cardinality parameters are `master_id`, `rating`,
   `has_text`, `reason`, and `status_code`. Do not register anonymous attempt or
   event IDs as dimensions.

## Event semantics

- `booking_cta_click`: a CTA was clicked; it is not a booking start.
- `booking_start`: the first meaningful service/master action in one persisted
  booking attempt. Multiple form instances and page reloads share the same
  attempt marker.
- `select_service`, `select_master`, `select_time`: behavioral interaction
  events; they may occur more than once when a visitor changes a choice.
- `booking_submit`: a valid form reached the API submission step.
- `booking_success`: the public booking API returned success.
- `booking_submit_failed`: an expected validation or slot-conflict response.
- `booking_error`: a missing response or a 5xx technical failure.
- `review_form_opened`: the available review form resolved in the browser.
- `rating_selected`, `review_submit_started`, `review_submitted`, and
  `review_submit_failed`: review interaction milestones.

Review events contain only non-sensitive metadata. Review tokens, comments,
names, phone numbers, email addresses, and raw error messages must never be
sent to GA4 or Hotjar.

## Release order

1. Apply the backend migrations and deploy the backend.
2. Deploy the barbershop and backoffice frontend.
3. Verify GA4 Realtime/DebugView with one booking and one review test flow.
4. Compare GA4 key events with the server funnels as separate systems; do not
   force their totals to match when analytics consent is absent.
