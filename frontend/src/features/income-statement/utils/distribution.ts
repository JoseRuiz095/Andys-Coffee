/** An empty field is an error (it used to count as 0 and let a wrong split be saved). */
export function parsePercent(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
