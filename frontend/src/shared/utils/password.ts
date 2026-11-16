/**
 * Password rule shared by "Crear usuario" and "Cambiar contraseña" (same as the backend
 * validators). Passwords are used exactly as typed: login doesn't trim them either.
 */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72

export const PASSWORD_RULES = [
  { id: 'length', label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, test: (p: string) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'letter', label: 'Una letra', test: (p: string) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'Un número', test: (p: string) => /\d/.test(p) },
] as const

export function validatePassword(password: string): string | null {
  if (password.length === 0) return 'Ingresa una contraseña.'
  if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
  if (password.length > PASSWORD_MAX_LENGTH) return `La contraseña no puede exceder ${PASSWORD_MAX_LENGTH} caracteres.`
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe contener al menos una letra y un número.'
  return null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}
