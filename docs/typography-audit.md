# Typography audit

## Scope

Audit covers shop, barbershop, blog and backoffice. It reviews font loading, family stacks, semantic hierarchy, repeated Tailwind typography combinations and reusable CSS ownership.

## Findings

### Font families

- Shop, barbershop and blog ship the same Cy Grotesk files and now expose the same `--font-family-primary` contract.
- Backoffice does not ship Cy Grotesk. It intentionally keeps the Inter/system UI stack while exposing the same token and role names.
- Component-level font-family declarations have been removed. The only remaining direct family declarations are `@font-face`, each app's `typography.css`, and one intentional `inherit` override in the backoffice toast.

### Repetition

The most common repeated patterns were:

- semibold page and section headings;
- black uppercase display titles;
- uppercase section labels with `0.2em` to `0.3em` tracking;
- bold uppercase metadata with `0.16em` tracking;
- locally repeated body line-height declarations, which remain local after visual review.

These patterns are now represented by the shared role contract documented in `css-style-guidelines.md`.

### Migration coverage

Semantic typography roles are used across 55 app files:

- shop: 9 files;
- barbershop: 24 files;
- blog: 13 files;
- backoffice: 9 files.

The migrated surface includes app-level font stacks, common section labels, page headings, product/content cards, navigation display text, editorial metadata, forms and representative backoffice screens.

### Intentional exceptions

Some local typography remains in calendars, booking step controls, promotion badges and other dense UI. Their tracking values are optical adjustments for very small text, not reusable content hierarchy. They should only become new global roles after a second matching use case appears.

Responsive font sizes and colors remain local by design. Semantic roles own hierarchy—weight, casing and shared tracking—without coupling layouts or light/dark themes.

## Follow-up rule

No mass replacement is required. When a screen is changed, migrate nearby repeated typography to the existing role contract. Add a role only when it represents a stable visual purpose and has at least two real consumers.
