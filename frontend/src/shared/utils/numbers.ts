/**
 * Amount typed in a form field: a finite number >= 0, or null when the field is empty, not a
 * number or negative. An empty field is "not typed", never 0 (`Number('')` would be 0).
 */
export function parseNonNegativeAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}
