import { useState } from 'react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
import { useCreateSupplier, useSearchSuppliers } from '../hooks/usePurchases'

interface SupplierFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (supplier: any) => void
  initialName?: string
}

export function SupplierFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
}: SupplierFormModalProps) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [similarSearch, setSimilarSearch] = useState('')

  const { data: similarResults, isLoading: isSearching } = useSearchSuppliers(
    similarSearch.length >= 2 ? similarSearch : ''
  )
  const { mutate: createSupplier, isPending: isCreating } = useCreateSupplier()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      sileo.error({ title: 'Nombre requerido', description: 'Ingresa un nombre para el proveedor.' })
      return
    }

    const data = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
    }

    createSupplier(data, {
      onSuccess: (response) => {
        sileo.success({ title: 'Proveedor creado', duration: 2000 })
        onSuccess?.(response.supplier)
        handleClose()
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.message || error?.message || 'Error creando proveedor'
        sileo.error({ title: 'Error', description: message })
      },
    })
  }

  const handleClose = () => {
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setSimilarSearch('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        className="w-full max-w-md rounded-lg bg-white shadow-lg"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Crear Proveedor</h2>

          {/* Búsqueda de similares */}
          {name.length >= 2 && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="mb-2 text-xs font-medium text-blue-900">Proveedores similares encontrados:</p>
              {isSearching ? (
                <p className="text-xs text-blue-700">Buscando...</p>
              ) : similarResults && similarResults.length > 0 ? (
                <ul className="space-y-1">
                  {similarResults.map((supplier) => (
                    <li key={supplier.id} className="flex items-center justify-between text-xs text-blue-700">
                      <span>{supplier.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          handleClose()
                          onSuccess?.(supplier)
                        }}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        Usar este
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-blue-700">No hay similares</p>
              )}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSimilarSearch(e.target.value)
              }}
              placeholder="Ej: Café Importado S.A."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono (opcional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 912 345 678"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contacto@proveedor.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Dirección (opcional)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle Principal 123, Ciudad"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 rounded-lg bg-[#5A804F] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a6a3f] disabled:opacity-50"
            >
              {isCreating ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
