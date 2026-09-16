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
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#E7E3DC] bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-[#2C211D]">Mi Perfil</h3>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#4B5563]">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[#E7E3DC] bg-white px-4 py-3 text-sm text-[#2C211D] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#4B5563]">Email</label>
          <input
            type="email"
            value={currentUser?.email || ''}
            disabled
            className="w-full rounded-lg border border-[#E7E3DC] bg-[#FDFBF7] px-4 py-3 text-sm text-[#6B7280] cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-[#6B7280]">El email no puede ser modificado.</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isPending || name.trim() === currentUser?.name}
          className="rounded-lg bg-[#5A804F] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a6a3f] disabled:opacity-50"
        >
          {isPending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  )
}
