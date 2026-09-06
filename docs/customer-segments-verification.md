# Backoffice segments and communications verification

## Implemented flows

- Customers → Segments: paginated active/archived listing, on-demand evaluated counts, create, edit with expected revision, duplicate, archive with confirmation, detail and related campaign links.
- Visual rule builder: all eight documented conditions, ALL/ANY, explicit exclusions and upcoming-booking exclusion, calendar-month/day periods, bounded ranges, calendar controls, readable criteria and authoritative member explanations. Imported/unknown history is distinguished from a known zero.
- Campaigns: segment preselection from segment detail, selection inside existing campaign preparation, deduplicated server audience previews, page-level eligibility/channel/exclusion breakdown, campaign-local message editing, schedule and existing promotion code reference, explicit launch confirmation and stable retry keys.
- Results: immutable segment revision/rules/message snapshots, backend delivery counts, paginated run members and provider/error details, links to customers and the existing paginated journal.
- Communications → Notifications: existing event configuration and delivery history remain separate from audience-based marketing. Legacy campaign routes and inline audiences remain supported.

## Contract evidence

Inspected sibling backend documentation and Pydantic schemas before implementation. The running isolated backend's generated OpenAPI was also checked: eight rule variants and eleven matching segment/run/preview routes. The frontend uses the existing authenticated API client; successful browser test responses come from actual FastAPI routes and PostgreSQL evaluation, never fabricated success fixtures.

Segment rules and member pages retain backend evaluation timestamps. Campaign preview cannot pin a timestamp across pages with the current contract. Run membership is read from frozen snapshots. A future scheduled run freezes its audience on worker execution, which the confirmation and result screens explain.

Service conditions require `barber_services.id`, not base-service IDs. Their catalog loads lazily through `/backoffice/barbers/{id}/services`, including inactive historical services, with at most four concurrent requests. Other editor catalogs use existing paginated APIs.

## Independent review findings resolved

- Campaign updates could erase omitted schedule/review/metadata settings or mutate a shared template. Sparse update serialization preserves omitted fields; campaign-local message text overrides the template without modifying it.
- Normalizing and reconstructing an unchanged legacy audience dropped backend-only criteria such as `limit`. Ordinary edits now omit audience fields entirely. Switching off segments explicitly acknowledges the changed audience and preserves the stored backend filter.
- Vue's absent Boolean `checked` prop shadowed checkbox model values. An explicit undefined default restores checked state; actual compiled Vue rendering tests cover Boolean/array models and legacy checked overrides.
- The old booking-services catalog endpoint returned 404 and base-service IDs would have been incorrect. Lazy per-master service lookup fixes integration and avoids unnecessary starter-template requests.
- Stale previews, excessive selected-segment requests, archived-reference calculation errors, a 50-vs-20 selection limit, inert row retry controls, and incorrect journal anchors were corrected.
- Historical results now show literal frozen templates and actual rendered recipient messages. Sample substitutions and unsupported aggregate queue/cost/attribution claims were removed.
- Notifications and historical master messages do not receive unsupported customer-segment run controls. Mobile wizard steps have descriptive accessible names.

## Automated checks

- `pnpm --filter @apps/backoffice test`: **116 passed**, covering existing backoffice regressions plus API adapters, rule validation/summaries, stale-response handling, campaign previews/launch retries, catalog concurrency and checkbox rendering.
- `pnpm --filter @apps/backoffice lint`: passed; final confirmation recorded in the saved typecheck log.
- `pnpm --filter @apps/backoffice build`: **passed after all browser-driven fixes**, Nitro node-server output 1.93 MB (431 kB gzip).
- `git diff --check`: passed.

## Real browser verification

Harness: `apps/backoffice/e2e/support/segments-sandbox.py`. It requires an explicitly configured localhost test database, creates a unique test schema, uses real admin JWT authentication and backend routes, disables normal application schedulers, and replaces SMS/Telegram providers with in-memory recorders. It never falls back to the ordinary application database or provider configuration.

Playwright suite: `apps/backoffice/e2e/customer-segments.smoke.spec.ts`. Without `SEGMENTS_SANDBOX_URL` it skips rather than connecting to another backend. Tests cover actual membership and inclusion reasons; save/edit/duplicate/archive; segment-to-campaign draft creation; exact legacy audience/settings preservation; campaign/notification separation; keyboard validation; loading; delayed genuine preview responses; empty audiences; and an explicitly injected HTTP 503 error. The delivery case uses only sandbox providers and checks two sent / one skipped plus immutable archived history.

All **six unique browser cases passed**: the fresh-backend five-test suite passed in 12.3 seconds, followed by the additional historical-service catalog case and a settled screenshot/full-flow rerun (two passing tests in 5.8 seconds). The full flow verifies checked state, inclusion reasons, real save/edit/duplicate/archive, selected segments, fallback strategy and draft recipient preview. The sandbox run is inspected through the actual Results UI, including delivery counts and frozen segment name/revision.

Evidence under `output/customer-segments/`:

- `browser-smoke-results.txt` and `browser-catalog-and-screenshots-results.txt`.
- `segment-preview-desktop-light.png` and `segment-detail-mobile-dark.png`.
- `campaign-audience-desktop-dark.png` and `sandbox-run-snapshot-desktop-light.png`.
- Final unit-test, typecheck, build and graphify logs.

Reproduction commands are in `apps/backoffice/e2e/support/README.md`. The dedicated frontend/backend servers were stopped and the newly created disposable database container was removed after verification; existing user services were untouched.

## Rollout and limitations

- Local real-backend/fake-provider verification is not staging or live-provider verification. No real customer messages, deployment, production migrations or scheduler enablement were performed.
- Coordinate backend migrations `0068_customer_segments` and `0069_sms_queue_throttling` and the worker rollout described in backend `docs/customer-segments-api.md` and `docs/sms-queue-api.md`. Enable `CAMPAIGN_RUN_SCHEDULER_ENABLED` only through the normal rollout process.
- Current APIs do not supply aggregate contactable/channel totals across audience pages, provider-backed SMS estimates/cost, aggregate run channel counts, or attributed booking/completed-visit/promotion-usage metrics. UI labels page-level counts and unavailable metrics explicitly.
- Segment list counts are evaluated on demand. Referencing campaigns are discovered through paginated existing campaign listings; a server-side segment-reference filter would reduce work for very large histories.
- Graphify AST update succeeded after assigning writable cache directories: **5,423 nodes, 6,936 edges, 413 communities**. HTML export is skipped by graphify's 5,000-node guard. Opening the Obsidian directory was unavailable because no local application was associated with it.
