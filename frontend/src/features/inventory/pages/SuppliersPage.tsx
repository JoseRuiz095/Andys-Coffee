import { useState } from 'react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
import { useCreateSupplier, usePurchasesList } from '../hooks/usePurchases'
import type { Supplier } from '../api/purchases.api'

const TAILWIND_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20'

export function SuppliersPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')

  const { mutate: createSupplier, isPending: isCreating } = useCreateSupplier()
  const { data: purchasesData } = usePurchasesList({ limit: 1000 })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      sileo.error({ title: 'Nombre requerido', description: 'Ingresa el nombre del proveedor.' })
      return
    }

    createSupplier(
      {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      },
      {
        onSuccess: () => {
          sileo.success({ title: 'Proveedor creado', duration: 2000 })
          setName('')
          setPhone('')
          setEmail('')
          setAddress('')
        },
        onError: (error: any) => {
          const message = error?.response?.data?.error || error?.message || 'Error al crear proveedor'
          sileo.error({ title: 'Error', description: message })
        },
      }
    )
  }

  // Get unique suppliers from purchases
  const suppliers: Supplier[] = purchasesData?.data?.reduce((acc: Supplier[], purchase) => {
    if (purchase.supplier && !acc.find(s => s.id === purchase.supplier?.id)) {
      acc.push(purchase.supplier)
    }
    return acc
  }, []) || []

  return (
    <motion.div
      className="min-h-screen bg-gray-50 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-600">Gestiona tus proveedores de ingredientes</p>
        </motion.div>

        {/* Formulario */}
        <motion.div
          className="mb-6 rounded-lg border border-gray-200 bg-white p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Agregar Proveedor</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Nombre */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Café del Campo"
                  className={TAILWIND_INPUT_CLASS}
                  disabled={isCreating}
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Teléfono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: +56 9 1234 5678"
                  className={TAILWIND_INPUT_CLASS}
                  disabled={isCreating}
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej: contacto@proveedor.com"
                  className={TAILWIND_INPUT_CLASS}
                  disabled={isCreating}
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Dirección</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Calle Principal 123"
                  className={TAILWIND_INPUT_CLASS}
                  disabled={isCreating}
                />
              </div>
            </div>

            {/* Botón */}
            <motion.button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="rounded-lg bg-[#5A804F] px-6 py-2 text-white font-medium transition-colors hover:bg-[#4a6a3f] disabled:cursor-not-allowed disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isCreating ? 'Creando...' : 'Crear Proveedor'}
            </motion.button>
          </form>
        </motion.div>

        {/* Proveedores */}
        <motion.div
          className="rounded-lg border border-gray-200 bg-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Proveedores ({suppliers.length})
            </h2>
          </div>

          {!suppliers.length ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No hay proveedores aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Nombre</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Teléfono</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Dirección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{supplier.name}</td>
                      <td className="px-6 py-4 text-gray-600">{supplier.phone || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{supplier.email || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{supplier.address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
