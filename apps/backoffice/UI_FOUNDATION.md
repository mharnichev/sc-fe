# Backoffice UI foundation

This app uses one token-driven UI system for both light and dark themes. New feature UI must use the semantic tokens and `Base*` components described here.

## Themes

The active theme is stored in `localStorage` under `soulcuts-backoffice-theme` and applied to `<html data-backoffice-theme="light|dark">`. `plugins/theme.client.ts` restores it before the app mounts; `useBackofficeTheme()` exposes `theme`, `setTheme()` and `toggleTheme()` to the sidebar and login page.

Theme values live only in `assets/css/main.css`. Feature components must not add hex, RGB/HSL values, or Tailwind palette classes such as `text-slate-700`, `bg-white`, `border-cyan-200`, or `dark:*`.

The application accent is green in both themes. Legacy `cyan-*` utility names are retained only as migration aliases and resolve to the green accent; informational UI uses the separate blue `--bo-info-*` palette.

Use these core tokens in component CSS:

| Purpose | Token |
| --- | --- |
| Page background | `--bo-page` |
| Surface / card | `--bo-surface` |
| Elevated surface | `--bo-surface-elevated` |
| Hover / active surface | `--bo-surface-hover`, `--bo-surface-active` |
| Primary / secondary / muted text | `--bo-text-primary`, `--bo-text-secondary`, `--bo-text-muted` |
| Border / strong border | `--bo-border`, `--bo-border-strong` |
| Accent and accent interaction | `--bo-accent`, `--bo-accent-hover`, `--bo-accent-active`, `--bo-on-accent` |
| Primary actions and active toggles | `--bo-action`, `--bo-action-hover`, `--bo-action-active`, `--bo-on-action` |
| Status colors | `--bo-success-*`, `--bo-warning-*`, `--bo-danger-*`, `--bo-info-*` |
| Controls | `--bo-control`, `--bo-control-hover`, `--bo-control-active` |
| Disabled state | `--bo-disabled-bg`, `--bo-disabled-text`, `--bo-disabled-border` |
| Focus | `--bo-focus-border`, `--bo-focus-ring` |
| Modal overlay | `--bo-overlay` |

For template-only styling, use semantic utilities such as `text-ui-primary`, `text-ui-secondary`, `text-ui-muted`, `text-ui-accent`, `bg-ui-surface`, `bg-ui-subtle`, `border-ui`, `divide-ui`, and `ui-status-{success|warning|danger|info|neutral}`.

## Base components

Nuxt auto-imports components from `components/`.

```vue
<BaseButton variant="primary" :loading="saving">Зберегти</BaseButton>
<BaseInput v-model="form.name" label="Назва" :error="errors.name" required />
<BaseSelect v-model="form.status" label="Статус" :options="statusOptions" />
<BaseTextarea v-model="form.notes" label="Нотатки" hint="Видно лише команді" />
<BaseCheckbox v-model="form.active" label="Активний" />
<BaseToggle v-model="form.visible" label="Показувати на сайті" :loading="savingVisibility" />
<BaseTabs v-model="activeTab" :tabs="tabs" aria-label="Розділи сторінки" />
```

- `BaseButton`: use `primary`, `secondary`, `neutral`, `outline`, `ghost`, `icon`, `success`, `danger`, or `danger-outline`. Prefer `loading` over replacing the label manually.
- `BaseInput`, `BaseSelect`, `BaseTextarea`: pass `label`, `hint`, and `error` where applicable. They wire labels, description IDs, invalid state, disabled state, and visible focus automatically.
- `BaseCheckbox`: use its label prop or default slot so the full label remains clickable.
- `BaseToggle`: use for immediate binary on/off state such as visibility; pass `loading` while persisting the value so the fixed-size loader overlay blocks repeated changes without shifting surrounding UI. It exposes native checkbox semantics with `role="switch"`.
- `BaseTabs`: use to switch between peer page views. It provides `tablist`/`tab` semantics, arrow-key navigation, and IDs for the active `tabpanel` through its default slot.
- `BaseModal`: use `v-model`, the `head`/`body` slots, and `ModalCloseButton`. It locks scroll, restores focus, traps Tab navigation, closes on Escape/backdrop, and exposes `close` to slots.
- `BaseBadge`: use semantic `tone` values; do not construct status color classes in the feature.
- `BaseCard`: use `surface`, `elevated`, or `subtle`; keep grid and spacing concerns in the caller.
- `BaseTable`: provide the `head` slot and body rows. Always set a meaningful `caption`; use `loading`, `empty`, and their labels instead of custom placeholders. Tables stay tables on narrow screens and scroll horizontally. Choose `min-width` from the number and content of columns, for example `min-width="64rem"` (do not add a separate mobile card view); `BaseTable` exposes the scroll region to keyboard and screen-reader users.
- `BaseEmptyState`: use for zero-data/search results. Put recovery actions in the `actions` slot.
- `BaseLoader`: use for page, section, and table loading. Always supply a specific Ukrainian label when context helps.

Existing specialized controls such as `BaseCalendar`, `BaseDateRange`, `BaseMultiSelect`, `BasePhoneInput`, and `BaseSegmentedControl` remain the correct primitives for their domains; do not duplicate them.

## Rules for new UI

1. Use a suitable `Base*` component before writing a native button, form control, dialog, badge, card, table, empty state, or loader.
2. Keep business logic, API payloads, permissions, and navigation in feature components; keep visual and accessibility behavior in Base components.
3. Use semantic tokens/utilities only. Direct colors and duplicate primitives are not allowed.
4. A documented exception must explain why a semantic token or existing Base component cannot represent the UI. Put the exception next to the code and add it to the audit below.
5. Test both themes, keyboard focus, disabled/loading state, and narrow/mobile layout before merging.

## Audit and migration status

The initial audit found repeated table shells, status pills, statistic cards, empty/loading paragraphs, icon buttons, form-control color strings, and custom dropdown/modal behavior. Existing `BaseButton`, `BaseInput`, `BaseSelect`, `BaseTextarea`, `BaseCheckbox`, and `BaseModal` were retained and standardized; no parallel form system was introduced.

Migrated entry screens:

- master dashboard and bookings;
- clients, masters, and base services;
- messaging campaigns and Telegram overview;
- review moderation;
- shop products and orders.

The migrated files contain no raw palette utilities or direct color values. Remaining legacy migration is intentionally limited to secondary/detail surfaces (statistics charts and tables, product/order detail, categories/promotions, messaging child editors/tables, and older specialized booking/modal internals). These remain theme-compatible through the legacy aliases in `main.css`, but should move to Base components and `--bo-*` tokens when next edited.

Documented exceptions:

- Calendar timeline/event colors may encode distinct booking-domain states. They must still resolve through named semantic/domain tokens in `main.css`, never feature-local hex values.
- Brand artwork and uploaded media are content, not UI chrome, and are not recolored by theme tokens.
