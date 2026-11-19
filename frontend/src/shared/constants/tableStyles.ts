/**
 * Shared look of the operational tables (inventory, purchases, movements): one cell padding, one
 * header weight and tabular figures so quantities and amounts line up by their decimals.
 */

/** Outer card of a table. */
export const TABLE_CARD_CLASS = 'overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]'

/** The <table> itself. */
export const TABLE_CLASS = 'w-full text-sm'

/** <thead>. */
export const TABLE_HEAD_CLASS = 'border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'

/** Header cell. */
export const TH_CLASS = 'px-4 py-2.5 font-semibold whitespace-nowrap'

/** Body cell. */
export const TD_CLASS = 'px-4 py-2.5'

/** Quantities and amounts: right aligned, digits of the same width. */
export const NUMERIC_CLASS = 'text-right tabular-nums whitespace-nowrap'

/** Body rows. */
export const TR_CLASS = 'transition-colors hover:bg-[var(--color-surface-hover)]'

/** Secondary line under a cell's main value (SKU, unit, address): 13 px, readable. */
export const CELL_SECONDARY_CLASS = 'text-[0.8125rem] text-[var(--color-text-secondary)]'
