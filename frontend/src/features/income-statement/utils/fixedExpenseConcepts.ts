import type { FixedExpenseConcept } from '../api/income-statement.api'

/**
 * Slug the API accepts (/^[a-z0-9][a-z0-9_-]{0,49}$/). Accents are dropped instead of the whole
 * letter ("Ñoño" → "nono", not an empty slug).
 */
export function slugifyConceptLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

/**
 * Why a new concept can't be added, or null. Adding is an upsert by slug with amount 0, so a label
 * that maps to an existing slug would silently reset that concept's amount.
 */
export function getNewConceptError(label: string, concepts: FixedExpenseConcept[]): string | null {
  const slug = slugifyConceptLabel(label)
  if (!slug) return 'El nombre debe tener al menos una letra o número.'
  const normalizedLabel = label.trim().toLowerCase()
  const existing = concepts.find((concept) => concept.slug === slug || concept.label.trim().toLowerCase() === normalizedLabel)
  if (existing) return `Ya existe el concepto "${existing.label}". Edítalo para cambiar su monto.`
  return null
}
