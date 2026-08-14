import { z } from 'zod'
import axios from 'axios'
import { apiClient } from '../../../app/api'
import type { LoginCredentials, LoginResult } from '../types/auth.types'

const DEFAULT_LOGIN_ERROR_MESSAGE = 'No se pudo iniciar sesión. Inténtalo de nuevo.'
const NETWORK_LOGIN_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Verifica que la API esté activa e inténtalo otra vez.'

// Esquema Zod para validar la respuesta del login. Fuente de verdad de la API.
const loginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    roleId: z.string().uuid(),
    roleName: z.string(),
    isActive: z.boolean(),
    // Se asume que los permisos vendrán en el login. Se marca como opcional para evitar errores si el backend aún no los envía.
    permissions: z.array(z.string()).optional(),
  }),
})

function getLoginErrorMessage(error: unknown): string {
  // Axios envuelve los errores de red o de respuesta en un objeto `error`
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      const status = error.response.status
      const message = error.response.data?.message

      if (status === 401) {
        return message ?? 'Correo o contraseña incorrectos.'
      }
      if (status >= 500) {
        return 'El servidor tuvo un problema. Intenta nuevamente en unos minutos.'
      }
      return message ?? DEFAULT_LOGIN_ERROR_MESSAGE
    } else if (error.request) {
      // La solicitud fue hecha pero no se recibió respuesta
      return NETWORK_LOGIN_ERROR_MESSAGE
    }
  }
  // Error genérico
  return error instanceof Error ? error.message : DEFAULT_LOGIN_ERROR_MESSAGE
}

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  try {
    const response = await apiClient.post('/auth/login', credentials)

    // Validamos la respuesta de la API. Si falla, lanza un error.
    const validatedData = loginResponseSchema.parse(response.data)
    return validatedData
  } catch (error) {
    // Centralizamos el manejo de errores para devolver un mensaje claro.
    throw new Error(getLoginErrorMessage(error), { cause: error })
  }
}
