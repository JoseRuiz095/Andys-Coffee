export function formatCurrency(
  value: number,
  options?: {
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    currency?: string
    symbol?: string
  }
) {
  const currency = options?.currency || 'MXN'
  const locale = currency === 'MXN' ? 'es-MX' : currency === 'USD' ? 'en-US' : 'en-CA'

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? options?.minimumFractionDigits ?? 0,
  }).format(value)
}

export function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}
