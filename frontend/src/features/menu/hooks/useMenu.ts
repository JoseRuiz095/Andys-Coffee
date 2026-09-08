import { useQuery } from '@tanstack/react-query'
import { getMenu } from '../services/menu.service'

export const menuQueryKey = ['menu'] as const

/**
 * Hook personalizado para obtener los datos del menú.
 * Encapsula la lógica de fetching, cacheo, y estados de carga/error.
 * El menú se considera fresco durante cinco minutos; una invalidación
 * explícita desde una mutación de catálogo lo actualiza inmediatamente.
 */
export const useMenu = () => {
  const query = useQuery({
    queryKey: menuQueryKey,
    queryFn: getMenu, // La función que hace la llamada a la API.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })

  return query
}