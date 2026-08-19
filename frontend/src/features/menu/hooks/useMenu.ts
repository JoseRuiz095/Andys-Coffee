import { useQuery } from '@tanstack/react-query'
import { getMenu } from '../services/menu.service'

// Definimos una clave única para esta query.
// TanStack Query la usa para cachear y gestionar los datos.
const menuQueryKey = ['menu']

/**
 * Hook personalizado para obtener los datos del menú.
 * Encapsula la lógica de fetching, cacheo, y estados de carga/error.
 */
export const useMenu = () => {
  const query = useQuery({
    queryKey: menuQueryKey,
    queryFn: getMenu, // La función que hace la llamada a la API.
    staleTime: 1000 * 60 * 5, // Los datos se consideran "frescos" por 5 minutos.
  })

  return query
}