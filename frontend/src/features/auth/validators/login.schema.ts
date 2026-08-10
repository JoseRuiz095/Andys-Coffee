import type { LoginCredentials } from '../types/auth.types'

export const loginSchema = {
  validate(credentials: LoginCredentials) {
    if (!credentials.email.trim()) {
      return 'El correo electrónico es obligatorio.'
    }

    if (!credentials.password.trim()) {
      return 'La contraseña es obligatoria.'
    }

    return null
  },
}
