import { useEffect, useState } from 'react'

interface OrdersFiltersProps {
  onSearchChange: (search: string) => void
  onStatusChange: (status: string | null) => void
  search?: string
  status?: string | null
}

export function OrdersFilters({
  onSearchChange,
  onStatusChange,
  search = '',
  status = null,
}: OrdersFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search)

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      onSearchChange(localSearch)
    }, 300)
    return () => clearTimeout(debounceTimer)
  }, [localSearch, onSearchChange])

  return (
    <div className="flex gap-3 flex-wrap items-center">
      <input
        type="text"
        placeholder="Buscar por número o cliente..."
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        className="px-4 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
        }}
      />

      <select
        value={status || ''}
        onChange={(e) => onStatusChange(e.target.value || null)}
        className="px-4 py-2 border rounded-lg text-sm"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-primary)',
        }}
      >
        <option value="">Todos los estados</option>
        <option value="pending">Pendiente</option>
        <option value="preparing">En preparación</option>
        <option value="ready">Lista</option>
        <option value="completed">Completada</option>
        <option value="cancelled">Cancelada</option>
      </select>

      {(localSearch || status) && (
        <button
          onClick={() => {
            setLocalSearch('')
            onSearchChange('')
            onStatusChange(null)
          }}
          className="px-4 py-2 border rounded-lg text-sm font-semibold"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          Limpiar
        </button>
      )}
    </div>
  )
}
