## Mandatory base-component reuse

- Before implementing or changing any UI in `apps/shop`, first inspect the existing reusable components in `apps/shop/components/base/`, `apps/shop/components/ui/`, and the relevant shared feature components.
- Always use the existing `Base*` components for controls and common UI patterns. Do not add page-local or feature-local handcrafted replacements for inputs, selects, checkboxes, radios, buttons, modals, and similar primitives.
- If an existing base component is close but insufficient, extend it with a reusable API instead of duplicating its markup or styles.
- If no suitable base component exists, create the reusable `Base*` component first and consume it from the feature. Do not implement the primitive only inside the page or feature component.
- For `pages/catalog.vue` and `components/catalog/`, verify base-component reuse before making changes and again during review. Product filters must be composed from base components; custom filter controls are not allowed.
