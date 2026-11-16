import { useState } from 'react'
import { sileo } from 'sileo'
import { useChangePassword } from '../hooks/useProfile'
import { getErrorMessage } from '../../../shared/utils/errors'
import { validatePassword } from '../../../shared/utils/password'
import { Input } from '../../../shared/components/Input'
import { Button } from '../../../shared/components/Button'
import { FormField } from '../../../shared/components/FormField'
import { fieldDescriptionId } from '../../../shared/utils/formField'

type FieldErrors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const { mutate: changePassword, isPending } = useChangePassword()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isPending) return
    // Passwords are used exactly as typed (login doesn't trim either): a leading or trailing
    // space is part of the password.
    const next: FieldErrors = {}
    if (!currentPassword) next.currentPassword = 'Ingresa tu contraseña actual.'
    const passwordError = validatePassword(newPassword)
    if (passwordError) next.newPassword = passwordError
    if (!next.newPassword && newPassword !== confirmPassword) next.confirmPassword = 'Las contraseñas nuevas no coinciden.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    changePassword(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          sileo.success({ title: 'Contraseña actualizada', description: 'Úsala la próxima vez que inicies sesión.', duration: 2500 })
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        },
        onError: (err: unknown) => sileo.error({ title: 'No se pudo cambiar la contraseña', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
      }
    )
  }

  const field = (key: keyof FieldErrors, id: string) => ({
    id,
    type: 'password' as const,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': fieldDescriptionId(id),
  })

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Contraseña</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField htmlFor="password-current" label="Contraseña actual" required error={errors.currentPassword}>
          <Input {...field('currentPassword', 'password-current')} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </FormField>
        <FormField htmlFor="password-new" label="Nueva contraseña" required error={errors.newPassword} hint="Mín. 8 caracteres, con una letra y un número.">
          <Input {...field('newPassword', 'password-new')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        </FormField>
        <FormField htmlFor="password-confirm" label="Confirmar nueva contraseña" required error={errors.confirmPassword}>
          <Input {...field('confirmPassword', 'password-confirm')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? 'Actualizando...' : 'Cambiar contraseña'}
        </Button>
      </div>
    </form>
  )
}
