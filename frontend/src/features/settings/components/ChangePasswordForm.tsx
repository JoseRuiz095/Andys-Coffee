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
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-6"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cambiar Contraseña</h3>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Contraseña Actual *</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Ingresa tu contraseña actual"
            className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nueva Contraseña *</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mín. 8 caracteres, 1 letra, 1 número"
            className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Confirmar Nueva Contraseña *</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite la nueva contraseña"
            className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
        >
          {isPending ? 'Actualizando...' : 'Cambiar Contraseña'}
        </button>
      </div>
    </form>
  )
}
