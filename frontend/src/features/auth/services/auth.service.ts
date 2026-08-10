import { api } from '../../../app/api'
import type { LoginCredentials, LoginResult } from '../types/auth.types'

const DEFAULT_LOGIN_ERROR_MESSAGE = 'No se pudo iniciar sesión. Inténtalo de nuevo.'
const NETWORK_LOGIN_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Verifica que la API esté activa e inténtalo otra vez.'

function getLoginErrorMessage(status: number, data: { message?: string } | null): string {
  if (status === 400) {
    return data?.message ?? 'Revisa los datos enviados e inténtalo otra vez.'
  }

  if (status === 401) {
    return data?.message ?? 'Correo o contraseña incorrectos.'
  }

  if (status >= 500) {
    return 'El servidor tuvo un problema. Intenta nuevamente en unos minutos.'
  }

  return data?.message ?? DEFAULT_LOGIN_ERROR_MESSAGE
}

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  try {
    const response = await fetch(`${api.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    })

    const data = (await response.json().catch(() => null)) as {
      token?: string
      user?: {
        id?: string
        email?: string
        name?: string
        roleId?: string
        roleName?: string
        isActive?: boolean
      }
      message?: string
    } | null

    if (!response.ok) {
      throw new Error(getLoginErrorMessage(response.status, data))
    }

    if (!data?.token || !data.user) {
      throw new Error('La respuesta del servidor no es válida.')
    }

    return {
      token: data.token,
      user: {
        id: data.user.id ?? '',
        email: data.user.email ?? credentials.email,
        name: data.user.name ?? "Andy's Coffee",
        roleId: data.user.roleId ?? '',
        roleName: data.user.roleName ?? undefined,
        isActive: data.user.isActive ?? true,
      },
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(NETWORK_LOGIN_ERROR_MESSAGE)
    }

    throw error instanceof Error ? error : new Error(DEFAULT_LOGIN_ERROR_MESSAGE)
  }
}
