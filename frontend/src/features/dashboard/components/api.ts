import axios from 'axios'

/**
 * URL base para todas las llamadas a la API.
 * Se toma de las variables de entorno de Vite, con un fallback para desarrollo.
 */
export const api = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
}

/**
 * Instancia centralizada de Axios.
 * Todas las llamadas a la API deben usar este cliente.
 * - Configura la baseURL.
 * - Habilita `withCredentials` para el manejo automático de cookies (sesiones, etc.).
 */
export const apiClient = axios.create({
  baseURL: api.baseUrl,
  withCredentials: true, // Importante para que las cookies de sesión funcionen
})
