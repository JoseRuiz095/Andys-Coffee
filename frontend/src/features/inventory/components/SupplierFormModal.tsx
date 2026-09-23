import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
import { useCreateSupplier, useSearchSuppliers, useUpdateSupplier, useSupplierById } from '../hooks/usePurchases'
import { getErrorMessage, getErrorStatus } from '../../../shared/utils/errors'
import type { Supplier } from '../api/purchases.api'

interface SupplierFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (supplier: Supplier) => void
  initialName?: string
  editingSupplierId?: string | null
  showSimilarMatches?: boolean
}

export function SupplierFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
  editingSupplierId = null,
  showSimilarMatches = true,
}: SupplierFormModalProps) {
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [similarSearch, setSimilarSearch] = useState('')

  const { data: editingSupplier } = useSupplierById(editingSupplierId || '')
  const { data: similarResults, isLoading: isSearching } = useSearchSuppliers(
    showSimilarMatches && similarSearch.length >= 2 && !editingSupplierId ? similarSearch : ''
  )
  const { mutate: createSupplier, isPending: isCreating } = useCreateSupplier()
  const { mutate: updateSupplier, isPending: isUpdating } = useUpdateSupplier()

  useEffect(() => {
    if (editingSupplier && isOpen) {
      const timer = setTimeout(() => {
        setName(editingSupplier.name)
        setPhone(editingSupplier.phone || '')
        setEmail(editingSupplier.email || '')
        setAddress(editingSupplier.address || '')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [editingSupplier, isOpen])

  useEffect(() => {
    if (isOpen) {
      firstInputRef.current?.focus()
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      sileo.error({ title: 'Nombre requerido', description: 'Ingresa un nombre para el proveedor.' })
      return
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      sileo.error({ title: 'Email inválido', description: 'Ingresa un email válido.' })
      return
    }

    if (phone.trim() && !/^[+\d\s\-()]+$/.test(phone.trim())) {
      sileo.error({ title: 'Teléfono inválido', description: 'Ingresa un teléfono válido.' })
      return
    }

    const data = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
    }

    if (editingSupplierId) {
      updateSupplier(
        { id: editingSupplierId, data },
        {
          onSuccess: (response) => {
            sileo.success({ title: 'Proveedor actualizado', duration: 2000 })
            onSuccess?.(response.supplier)
            handleClose()
          },
          onError: (error: unknown) => {
            const message =
              getErrorMessage(error, 'Error actualizando proveedor')
            sileo.error({ title: 'Error', description: message })
          },
        }
      )
    } else {
      createSupplier(data, {
        onSuccess: (response) => {
          sileo.success({ title: 'Proveedor creado', duration: 2000 })
          onSuccess?.(response.supplier)
          handleClose()
        },
        onError: (error: unknown) => {
          const status = getErrorStatus(error)
          let message = getErrorMessage(error, 'Error creando proveedor')

          if (status === 409) {
            message = 'Este nombre de proveedor ya existe. Usa un nombre diferente.'
          }

          sileo.error({ title: 'Error', description: message })
        },
      })
    }
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        className="w-full max-w-md rounded-lg shadow-lg"
        style={{ backgroundColor: 'var(--color-surface)' }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-modal-title"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <h2 id="supplier-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {editingSupplierId ? 'Editar Proveedor' : 'Crear Proveedor'}
          </h2>

          {/* Búsqueda de similares */}
          {showSimilarMatches && !editingSupplierId && name.length >= 2 && (
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
            <label htmlFor="supplier-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nombre *</label>
            <input
              id="supplier-name"
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSimilarSearch(e.target.value)
              }}
              placeholder="Ej: Café Importado S.A."
              aria-label="Nombre del proveedor"
              aria-required="true"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Teléfono */}
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Teléfono (opcional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 912 345 678"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contacto@proveedor.com"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Dirección (opcional)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle Principal 123, Ciudad"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {isCreating || isUpdating ? (editingSupplierId ? 'Actualizando...' : 'Creando...') : (editingSupplierId ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
