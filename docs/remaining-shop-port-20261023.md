# Scoped FE Port: 2026-10-23

Target: `/private/tmp/sc-fe-remaining-shop-20261023`, baseline `2795515a` after
`45a120d5` and checkout receipt/callback UI `07bf3e9c`.
Source: read-only dirty `/Users/markgarnicev/sc/sc-fe`; original backend reminder
contract read from `sc-be/docs/implementation/checkout-service-reminder.md`.
Original AGENTS and graph query were read before source investigation.

## Readiness Groups

- Reminder FE: implemented, unit/type/build/mock-browser checked. Authenticated,
  fresh backend capabilities are authoritative for pilot eligibility. GET uses
  current bearer through existing useApi, no-store; session changes immediately
  disable eligibility and fence stale replies. Guests cannot checkpoint.
- Checkpoint: trusted email blur/Enter only, approximately 800 ms debounce,
  immutable email/items/locale/session snapshot, stable key and revision headers.
  Orders retain the reminder key in their existing durable idempotent intent.
- Recovery: exact root/baseURL matching, early SSR head stripping and pre-plugin
  SPA guard; no automatic recovery POST, explicit preview and cart replacement,
  session/cart conflict guards. Ordinary route queries are untouched.
- Scope limitation: logout is local-only, not server reminder revocation. An old
  owner's cancellation is queued locally, never sent under the next account or
  guest, and replays only when that same owner returns. Until then, the service
  event can remain valid subject to backend dispatch fences. No stale bearer or
  authority transfer is used. This is NOT a claim of immediate logout revocation.
- Pricing: separate optional backoffice shop_price input/payload/types and public
  DTO retention. Public price remains canonical for rendering and totals; FE does
  not derive it from RRP or shop_price. Approved RRP-to-shop_price initialization
  belongs to the backend migration, not this patch.
- UI: BaseRange/BaseInput price-filter reuse and bounds, self-contained outlined
  discount artwork for UK/EN, payment/delivery terms drawer using existing localized
  closed-pilot copy. Existing callback/receipt/payment UI remains intact.
- Email asset: unchanged original PNG at
  `apps/shop/public/soulcuts/sc-logo-email.png`, 360x102 RGBA, 36936 bytes,
  SHA256 `99846c0a06a609ca76c2f2d986b9e76ca58c466634315881224d4e5726c8fa04`.
  Local HTTP verified image/png at `/shop/soulcuts/sc-logo-email.png`.

## Scope Manifest

Initial frozen implementation/test diff before the recovery-intent follow-up,
excluding this manifest and generated graph/output:
29 files, +1004/-147 text lines, including one new 36936-byte PNG.

- Backoffice: `components/ProductForm.vue`, `composables/useBackofficeApi.ts`.
- Shared DTO only: `packages/shared-types/src/index.ts`; no shared implementation extraction.
- Shop integration: `domain/catalog.ts`, `nuxt.config.ts`,
  `pages/checkout/purchase.vue`, `plugins/persist.client.ts`.
- New reminder files: `components/checkout/CheckoutServiceReminder.vue`,
  `pages/checkout/recover.vue`, `plugins/00.checkout-recovery.client.ts`,
  `plugins/checkout-reminder-invalidation.client.ts`, `utils/checkoutReminder.ts`.
- UI: `components/catalog/CatalogPriceFilter.vue`,
  `components/catalog/ProductDiscountSticker.vue`, `components/ui/BaseRange.vue`,
  `components/checkout/CheckoutPaymentTerms.vue`, `utils/product-discount-artwork.ts`,
  `public/discount-sticker-{uk,en}.svg`, `public/soulcuts/sc-logo-email.png`.
- Tests: `tests/checkout-reminder.test.mjs`,
  `tests/catalog-dynamic-localization.test.mjs`,
  `tests/auth-persistence-startup.test.mjs`, `tests/customer-session-isolation.test.mjs`,
  `tests/legacy-product-presentation.test.mjs`, `tests/order-intent{,-lifecycle}.test.mjs`,
  `e2e/remaining-shop.mock.spec.ts`, `playwright.remaining-mock.config.ts`.

## Verification And Dependencies

All commands run from target root unless noted. Package scripts unchanged.

- `pnpm install --offline --frozen-lockfile`: exit 0, existing 743-package lock;
  no downloads, dependency changes or lockfile edits.
- `node --test apps/shop/tests/*.test.mjs`: exit 0, 230/230.
- `node --test apps/backoffice/tests/*.test.mjs`: exit 0, 595/595.
- `pnpm --filter @apps/shop lint`: exit 0 (`nuxi typecheck`).
- `pnpm --filter @apps/backoffice lint`: exit 0 (`nuxi typecheck`).
- `pnpm --filter @apps/shop build`: exit 0 (`nuxt build`), node-server output.
- `pnpm --filter @apps/shop exec playwright test --config playwright.remaining-mock.config.ts`:
  3/3 against built production bundle: 390px/1440px pilot checkpoint/cancel,
  terms drawer and no horizontal overflow, deployed recovery privacy and PNG MIME.
- `git diff --check`: exit 0.
- `graphify update .`: AST-only successful; generated untracked graphify-out is
  not release source. HTML skipped by graphify because graph exceeds 5000 nodes.

Build needs existing workspace pnpm 9.12.3, Node, frozen Nuxt/Vue/TypeScript deps;
no new packages. Mock browser suite additionally needs installed Playwright Chromium
and a permitted loopback listener. Build shop BEFORE running that config; it starts
`.output/server/index.mjs` on 6087 and stops it afterward. Dev SSR startup timed out,
so final browser evidence deliberately uses the production bundle. Its server API
points to a deliberately unusable local port; expected header category GET failures
are logged. All browser API requests are mocked and external HTTPS is aborted.
Backoffice production build was not run; its types and full unit suite passed.
Runtime UI independent review belongs to primary; no independent agent was spawned.

## Preserved And Deferred

No backend/infra, production, flags, SMTP, real POST/notifications, commits or release
actions. Public shop checkout remains closed. Existing SEO, native EN/localization,
Dobrodesk sandbox, Sentry and source crypto code were not replaced.

Broad compact-product-admin styling depends on other WIP BaseField/control changes;
only its isolated shop_price hunk was ported. Full checkout layout rewrite,
telemetry, unrelated catalog/order/auth refactors and pricing assumptions were not
ported. Backend pilot/live configuration and production integration are primary-owned.
Screenshots: `output/remaining-shop/terms-390.png` and `terms-1440.png`.

## Recovery Intent Review Fix

Independent P2 fixed in `pages/checkout/recover.vue`: application refuses ANY
persisted `shop-checkout-intent-v1` entry, regardless of scope or JSON validity.
Unavailable/unreadable browser storage fails closed; an absent intent key permits
application. The check occurs synchronously at apply,
before writing the recovery key or changing the cart; it never deletes, rewrites
or parses the unresolved intent. A localized generic alert discloses no owner data.
After checkout resolves the intent, a fresh explicit confirmation is required.

Follow-up ownership: shop only; admin/shared DTO/dependencies unchanged.
Added `tests/checkout-recovery-intent.test.mjs` (9 behavioral tests), and three
mock-browser cases in `e2e/remaining-shop.mock.spec.ts`.

Final follow-up verification, all exit 0:

- `node --test apps/shop/tests/*.test.mjs`: 239/239.
- `pnpm --filter @apps/shop lint`: typecheck passed.
- `pnpm --filter @apps/shop build`: production build passed, shop only rebuilt.
- `pnpm --filter @apps/shop exec playwright test --config playwright.remaining-mock.config.ts`: 6/6 against the rebuilt bundle.
- `git diff --check` and AST-only `graphify update .` passed.

FE frozen again after this fix. Infra evidence-helper review was paused for it.
