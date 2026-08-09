import { api } from '../../../app/api'
import type { LoginCredentials, LoginResult } from '../types/auth.types'

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  void api.baseUrl

  return {
    token: 'front-only-token',
    user: {
      email: credentials.email,
      name: "Andy's Coffee",
    },
  }
}
