import type { GeneralPreferences } from '../api/preferences.api'

export type GeneralPreferencesErrors = Partial<Record<keyof GeneralPreferences, string>>

const TIME_PATTERN = /^\d{2}:\d{2}$/
export const CURRENCY_OPTIONS = ['MXN', 'USD', 'CAD']
export const SYMBOL_OPTIONS: Record<string, string[]> = {
  MXN: ['$', 'Mex$', 'MXN'],
  USD: ['$', 'US$', 'USD'],
  CAD: ['$', 'C$', 'CAD'],
}

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Same rules as before (and as the backend validator), returned instead of read from stale state. */
export function validateGeneralPreferences(data: GeneralPreferences): GeneralPreferencesErrors {
  const errors: GeneralPreferencesErrors = {}
  if (!data.businessName?.trim()) errors.businessName = 'Ingresa el nombre del negocio.'
  if (!TIME_PATTERN.test(data.businessHoursOpen || '')) errors.businessHoursOpen = 'Usa el formato HH:MM.'
  if (!TIME_PATTERN.test(data.businessHoursClose || '')) errors.businessHoursClose = 'Usa el formato HH:MM.'
  if (!errors.businessHoursOpen && !errors.businessHoursClose && toMinutes(data.businessHoursClose) <= toMinutes(data.businessHoursOpen)) {
    errors.businessHoursClose = 'El cierre debe ser después de la apertura.'
  }
  if (data.phone) {
    if (data.phone.length > 20) errors.phone = 'El teléfono no puede exceder 20 caracteres.'
    else if (!/^[\d\s\-()+]*$/.test(data.phone)) errors.phone = 'Solo números, espacios, guiones, paréntesis y +.'
    else if (!/\d/.test(data.phone)) errors.phone = 'El teléfono debe contener al menos un dígito.'
  }
  if (data.address && data.address.length > 250) errors.address = 'La dirección no puede exceder 250 caracteres.'
  return errors
}
