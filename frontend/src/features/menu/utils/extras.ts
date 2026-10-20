import type { SelectedExtra } from '../types/menu.types'

/** Price of the extras of one unit. */
export const extrasUnitPrice = (extras: SelectedExtra[] | undefined) =>
  (extras ?? []).reduce((total, extra) => total + extra.price * extra.quantity, 0)

/** Stable identity of a set of extras, to merge cart lines that carry exactly the same ones. */
export const extrasKey = (extras: SelectedExtra[] | undefined) =>
  (extras ?? [])
    .filter((extra) => extra.quantity > 0)
    .map((extra) => `${extra.extraId}:${extra.quantity}`)
    .sort()
    .join('|')
