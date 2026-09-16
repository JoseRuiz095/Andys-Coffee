import { useState } from 'react'
import { sileo } from 'sileo'
import { useChangePassword } from '../hooks/useProfile'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (!PASSWORD_PATTERN.test(password)) {
    return 'La contraseña debe contener al menos una letra y un número.'
  }
  return null
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { mutate: changePassword, isPending } = useChangePassword()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword.trim()) {
      sileo.error({
        title: 'Contraseña actual requerida',
        description: 'Ingresa tu contraseña actual.',
      })
      return
    }

    if (!newPassword.trim()) {
      sileo.error({
        title: 'Nueva contraseña requerida',
        description: 'Ingresa una nueva contraseña.',
      })
      return
    }

    const passwordError = validatePassword(newPassword.trim())
    if (passwordError) {
      sileo.error({ title: 'Contraseña inválida', description: passwordError })
      return
    }

    if (newPassword !== confirmPassword) {
      sileo.error({
        title: 'Contraseñas no coinciden',
        description: 'Las contraseñas nuevas no coinciden.',
      })
      return
    }

    changePassword(
      { currentPassword: currentPassword.trim(), newPassword: newPassword.trim() },
      {
        onSuccess: () => {
          sileo.success({
            title: 'Contraseña actualizada',
            description: 'Tu contraseña ha sido cambiada exitosamente.',
            duration: 2000,
          })
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        },
        onError: (error: any) => {
          const message = error?.response?.data?.message || 'Error al cambiar contraseña'
          sileo.error({ title: 'Error', description: message })
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#E7E3DC] bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-[#2C211D]">Cambiar Contraseña</h3>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#4B5563]">Contraseña Actual *</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Ingresa tu contraseña actual"
            className="w-full rounded-lg border border-[#E7E3DC] bg-white px-4 py-3 text-sm text-[#2C211D] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#4B5563]">Nueva Contraseña *</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mín. 8 caracteres, 1 letra, 1 número"
            className="w-full rounded-lg border border-[#E7E3DC] bg-white px-4 py-3 text-sm text-[#2C211D] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#4B5563]">Confirmar Nueva Contraseña *</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite la nueva contraseña"
            className="w-full rounded-lg border border-[#E7E3DC] bg-white px-4 py-3 text-sm text-[#2C211D] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/20"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#5A804F] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a6a3f] disabled:opacity-50"
        >
          {isPending ? 'Actualizando...' : 'Cambiar Contraseña'}
        </button>
      </div>
    </form>
  )
}
