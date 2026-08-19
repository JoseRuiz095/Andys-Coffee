import { apiClient } from '../../../app/api'
// Importamos los tipos que definen la estructura de la respuesta del menú.
import type { MenuCategory } from '../types/menu.types'

// La línea 6, donde ocurre el error, estaría dentro de esta función.
export const getMenu = async (): Promise<MenuCategory[]> => {
  // Esta llamada a apiClient.get('/menu') se convierte en GET /api/menu
  // Al pasar el tipo <MenuCategory[]>, Axios automáticamente tipa la variable `data`.
  const { data } = await apiClient.get<MenuCategory[]>('/menu')
  return data
}


