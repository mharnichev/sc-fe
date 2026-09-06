# Backoffice segments and communications implementation

## Plan

- [x] Read repository instructions, graph context, existing messaging code and backend segment/run schemas.
- [x] Add typed API integration, preserving existing campaign payloads and historical references.
- [x] Implement segment lifecycle screens, rule builder, paginated audience explanations and previews.
- [x] Integrate segment selection, explicit campaign launch, frozen run results and notifications navigation.
- [x] Independently review UX, accessibility, contract alignment and regressions; fix findings.
- [x] Run relevant tests, type checks, production build and browser smoke tests.
- [x] Update graphify and record verification evidence and remaining infrastructure gaps.

## Contract and scope

Source of truth: sibling backend `docs/customer-segments-api.md`, `app/schemas/segment.py`, `app/schemas/campaign_run.py`, and messaging routes/schemas. Reuse backoffice bearer authentication and Ukrainian interface conventions. All implementation stays within the backoffice app. Browser membership is never authoritative. Segment previews are explicit and paginated; launch is a separate confirmed campaign action.

Existing edits in barbershop reviews, shop product tiles, and untracked output/tmp files predate this task and must be preserved. No deployment or real customer messaging is authorized. Browser testing must use an isolated backend and fake providers or explicitly labelled fixtures.

## Integration limits to verify

- Segment list responses have no evaluated member counts or referencing campaigns; fetch evaluations explicitly and inspect existing paginated campaign references.
- Campaign audience preview supplies total membership and per-page eligibility/channel reasons, but no aggregate channel/contactable counts or SMS pricing. Do not mislabel page counts as audience totals or invent cost estimates.
- Run detail exposes frozen configuration and delivery counts; provider cost and attributed bookings/visits/promotion usage are absent from this contract.
- Scheduled audiences freeze at worker execution, not when the schedule is saved; explain this in confirmation.
- Run preview pages do not accept a pinned evaluation timestamp; expose evaluation times honestly.

## Review and verification

- Actual API adapter tests exercise lifecycle methods, optimistic revision, pinned segment pages, segment-only campaign payloads, legacy audience compatibility, view filters, idempotency and journal source/channel mapping.
- Independent review found and resolved an inert journal retry action, journal anchor mismatch, excess segment-selection limit, repeated selected-segment fetching, sample interpolation in frozen results, and unnecessary legacy recipient calculations for segment campaigns.
- Preserved existing inline audience filters and campaign configuration when editing message/channel settings; notification details exclude audience-based marketing controls.
- Authenticated real FastAPI/PostgreSQL smoke passed: three audience members, two contactable, fake-provider results two sent/one skipped, stale revision rejection, retained snapshot after archive. All six unique browser cases passed, including full lifecycle and campaign integration.
- Final automated suite: 116 tests passed, typecheck and production build passed. Graphify AST update completed. Detailed results, fixes, screenshots, reproduction and rollout boundaries are recorded in `docs/customer-segments-verification.md`.
