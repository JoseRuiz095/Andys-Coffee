/**
 * Buttons of the management screens (inventory, purchases): rectangular like their cards, 40 px
 * high (44 px on touch screens). Font utilities don't reach a <button> (index.css sets
 * `font: inherit`), so the text size comes from the parent.
 */
const BASE =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11'

/** The screen's main action. */
export const ACTION_PRIMARY_CLASS = `${BASE} bg-[var(--color-primary)] text-[var(--color-button-text)] hover:bg-[var(--color-primary-hover)]`

/** An action that commits stock (receive a purchase, apply a count). */
export const ACTION_SUCCESS_CLASS = `${BASE} bg-[var(--color-success)] text-[var(--color-button-text)] hover:bg-[var(--color-success-hover)]`

/** Secondary action next to a primary one. */
export const ACTION_SECONDARY_CLASS = `${BASE} border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]`

/** Destructive action: outlined in danger so it never looks like the normal one. */
export const ACTION_DANGER_CLASS = `${BASE} border border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))]`

/** Text-only action ("+ Agregar notas", "← Volver"). */
export const ACTION_LINK_CLASS =
  'inline-flex min-h-9 items-center font-medium text-[var(--color-primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] rounded'
