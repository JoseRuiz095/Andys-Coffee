import { useState } from 'react'
import { sileo } from 'sileo'
import { useUpdateProfile } from '../hooks/useProfile'
import type { AuthUser } from '../../auth/types/auth.types'

interface ProfileFormProps {
  currentUser: AuthUser | null
}

export function ProfileForm({ currentUser }: ProfileFormProps) {
  const [name, setName] = useState(currentUser?.name || '')
  const { mutate: updateProfile, isPending } = useUpdateProfile()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      sileo.error({ title: 'Nombre requerido', description: 'Ingresa tu nombre.' })
      return
    }

    updateProfile(name.trim(), {
      onSuccess: () => {
        sileo.success({ title: 'Perfil actualizado', duration: 2000 })
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Error al actualizar perfil'
        sileo.error({ title: 'Error', description: message })
      },
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-6"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Mi Perfil</h3>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Email</label>
          <input
            type="email"
            value={currentUser?.email || ''}
            disabled
            className="w-full rounded-lg border px-4 py-3 text-sm cursor-not-allowed"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>El email no puede ser modificado.</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isPending || name.trim() === currentUser?.name}
          className="rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
        >
          {isPending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}
