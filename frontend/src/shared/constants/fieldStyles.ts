/** Class of the inputs and selects inside a FilterBar (theme colors, focus ring). */
export const FILTER_FIELD_CLASS =
  'min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 text-sm text-[var(--color-input-text)] outline-none transition focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]'

/**
 * Look of a form control without a width: same height as the filters (40 px; 44 px on touch
 * screens) and the theme's input colors in light and dark mode. Use it when the control sits next
 * to another one in a row and sets its own width (`w-24`, `flex-1`): adding a width to
 * FORM_FIELD_CLASS would clash with its `w-full`, which wins.
 */
export const FORM_CONTROL_CLASS =
  'min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-input-text)] outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)] pointer-coarse:min-h-11'

/** Class of the inputs, selects and textareas of a form that take the full width of their field. */
export const FORM_FIELD_CLASS = `${FORM_CONTROL_CLASS} w-full`

/** Label above a form field. */
export const FORM_LABEL_CLASS = 'mb-1 block text-sm font-medium text-[var(--color-text-primary)]'
