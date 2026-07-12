# CSS style guidelines

## Direction

Shop, barbershop, blog and backoffice should use product-owned, semantic CSS classes as the default styling approach. Prefer a small reusable class with a clear design role over repeating Tailwind utility combinations in templates or copying the same declarations between components.

The goal is one visual language, predictable class names and one place to change each recurring decision. New work should gradually reduce classic utility-heavy Tailwind markup without requiring risky rewrites of stable screens.

## Typography

Each product owns an `assets/css/typography.css` file. The files remain separate because products may diverge, but their variables, role names and structure should stay as similar as the designs allow. Load `typography.css` after `main.css` in the Nuxt configuration so semantic roles consistently win over Tailwind utilities during gradual migration.

Shop, barbershop and blog use Cy Grotesk with the shared public fallback stack. Backoffice keeps its denser system UI stack because it does not ship the Cy Grotesk assets. This family difference is intentional; the token names and semantic role API stay identical.

- Declare the primary font stack and shared typography tokens in `typography.css`.
- Name reusable classes by visual role, not by a particular page or raw CSS value.
- Reuse the same role class in page headings, cards and components when the intended typography is the same.
- Keep responsive size and layout rules close to the component when they are unique; keep shared weight, casing and font-family decisions in typography roles.
- Before adding a new typography class, check whether an existing role already expresses the design intent.

### Shared role contract

| Role | Purpose | Owned typography |
| --- | --- | --- |
| `.type-display` | Large expressive navigation and editorial display text | weight `900`, uppercase |
| `.type-title-strong` | Strong product and section titles; alias of display emphasis | weight `900`, uppercase |
| `.type-page-title` | Page and modal titles | weight `600` |
| `.type-section-title` | Editorial and high-emphasis section titles | weight `800` |
| `.type-card-title` | Product, master and content card titles | weight `700` |
| `.type-eyebrow` | Section labels, form labels and overlines | weight `600`, uppercase, `0.2em` tracking |
| `.type-eyebrow--wide` | Wider marketing overline modifier | `0.3em` tracking |
| `.type-meta` | Dates, categories and compact editorial actions | weight `700`, uppercase, `0.16em` tracking |

Roles deliberately do not own color, responsive font size or component spacing. Those remain local so the same role can work across light/dark products and different layouts.

## Cross-product consistency

When adding or changing a reusable role in one product, compare the corresponding files in shop, barbershop, blog and backoffice. Keep the API identical where possible and document intentional differences. Avoid global cross-product CSS that couples releases; consistency should come from matching product-owned contracts.

## Component CSS

- Prefer semantic component classes and CSS custom properties for variants.
- Extract repeated visual decisions into the app-level role file or a shared component.
- Do not duplicate typography declarations in scoped component styles when a role class already owns them.
- Use Tailwind utilities for short-lived layout work only when no established product class exists; convert repeated combinations into semantic CSS during nearby changes.
- Preserve accessibility states such as focus, disabled and reduced motion when consolidating styles.
- Keep `@font-face` descriptors literal: do not use CSS custom properties for `font-weight`, and map every declared weight to the font file's internal OS/2 `usWeightClass`.

## Audit workflow

When touching a screen:

1. Identify whether the text is display, page title, section title, card title, eyebrow, meta or ordinary body text.
2. Apply an existing semantic role to headings, labels or metadata and remove duplicated `font-*`, `uppercase` and `tracking-*` utilities owned by that role. Ordinary paragraph text should keep the inherited normal weight unless the design explicitly requires otherwise.
3. Keep local `text-*`, responsive sizes, color and layout utilities unless they repeat across components too.
4. Treat very small controls, calendars and data-dense tables as deliberate exceptions when their optical tracking differs from content typography.
5. If no role fits at least two real usages, keep the declaration local rather than creating a one-off global class.
