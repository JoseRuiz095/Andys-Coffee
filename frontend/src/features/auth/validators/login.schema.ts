import type { LoginCredentials } from '../types/auth.types'

export const loginSchema = {
  validate(credentials: LoginCredentials) {
    if (!credentials.email.trim()) {
      return 'Email es requerido'
    }

    if (!credentials.password.trim()) {
      return 'Password es requerido'
    }

    return null
  },
}
