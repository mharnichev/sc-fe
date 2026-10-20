# Shop category cartoons and 404 — 2026-10-20

Scoped implementation based on `origin/main` (`0b7f05e5`). No backend changes or dependency changes.

## Implementation

- 44 category images, keyed by unique category slug (IDs and parent IDs retained for audit), in `apps/shop/public/category-cartoons/`.
- Source: `/Users/markgarnicev/sc/output/retro-cartoons-transparent/manifest.json`. All PNGs come from the transparent set, reduced proportionally to 512px for delivery; the original source SHA-256 is recorded in `apps/shop/data/category-artwork.json`. Alpha and white/light character interiors are preserved.
- Root category cards in the unfiltered general catalog; nested cards on category landing pages; small illustrations in desktop header dropdowns. Mobile catalog modal remains an unchanged text list.
- Figma inspected in Chrome: card 292.31×367.96px, image 245.66px square, padding about 20–22px. Implemented desktop cards 292×368px with approximately 248px square image area; mobile two-column grid. No card border, no invented product counts.
- New transparent 404 image in `public/illustrations/retro-cartoon-404.png` (768px). Error page reuses FeedbackState with optional illustration slot and heading tag; defaults for other consumers remain unchanged. 404 number, heading and recovery buttons remain HTML. Existing UK/EN copy retained.
- Invalid category routes now produce fatal Nuxt errors on the client as well, so recovery uses the full error page. Both recovery buttons clear the Nuxt error.

## Verification

- `pnpm --filter @apps/shop lint`: passed.
- `pnpm --filter @apps/shop build`: passed.
- `node --test apps/shop/tests/category-artwork.test.mjs apps/shop/tests/category-localization.test.mjs`: 6 passed.
- `node apps/shop/tests/category-artwork.http.smoke.mjs`: passed against the production build at `http://localhost:6070`, using a temporary Node reverse proxy to the public production API. The proxy is test infrastructure in `/tmp`, not shipped code.
  - 45 PNG responses: HTTP 200, correct dimensions.
  - All 28 categories currently returned by the public API have artwork.
  - All seven public parent category pages render their expected children.
  - Four unknown-route checks (landing/goods × UK/EN): HTTP 404, correct localized HTML h1, HTML 404 and illustration URL.
  - Home, catalog, brands, contacts, cabinet and checkout routes: successful HTTP responses; no orders/payments submitted.
- Pixel inspection: all category PNGs retain alpha range 0..255 and near/full-opaque white/light character pixels (some source illustrations use alpha 254 for white interiors, retained rather than replaced). No background flattening.
- Chrome extension visual smoke at desktop 1680×787, mobile 390×844 and narrow mobile 320×740:
  - Correct beard balm/oil/brush illustrations and destinations; all visible illustrations load.
  - Desktop cards measured 292×368px, zero border. Mobile two columns and no horizontal overflow.
  - Desktop dropdown opens via keyboard focus and shows illustrated child links.
  - Mobile catalog and nested beard list contain zero images; selecting balm opens its goods page.
  - 404 illustration loads, no overflow, UK and EN headings verified. Home and catalog recovery buttons work.
- Independent read-only review: no actionable findings.
- `git diff --check`: passed.

Screenshots are saved outside the commit at `/tmp/category-cartoons-smoke/`:
`desktop-beard.png`, `mobile-beard.png`, `mobile-menu.png`, `mobile-404-uk.png`, `mobile-404-320.png`, `desktop-404-en.png`.

## Publication notes

The manifest contains 44 assets, while the public API currently returns 28 categories. The other 16 remain mapped and will use their image if published; this change does not expose hidden categories. IDs not in the public tree: 4, 16, 17, 20, 21, 22, 23, 26, 32, 44, 45, 55, 64, 65, 82, 89.

Deploy only this scoped commit through sc-spellbook. Other work in the original checkout is not included. No backend deployment or migration is required.
