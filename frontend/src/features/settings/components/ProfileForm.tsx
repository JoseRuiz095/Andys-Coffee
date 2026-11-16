import { useState } from 'react'
import { sileo } from 'sileo'
import { useUpdateProfile } from '../hooks/useProfile'
import type { AuthUser } from '../../auth/types/auth.types'
import { getErrorMessage } from '../../../shared/utils/errors'
import { Input } from '../../../shared/components/Input'
import { Button } from '../../../shared/components/Button'
import { FormField } from '../../../shared/components/FormField'
import { fieldDescriptionId } from '../../../shared/utils/formField'

interface ProfileFormProps {
  currentUser: AuthUser | null
}

export function ProfileForm({ currentUser }: ProfileFormProps) {
  const [name, setName] = useState(currentUser?.name || '')
  const [error, setError] = useState<string | null>(null)
  const { mutate: updateProfile, isPending } = useUpdateProfile()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Ingresa tu nombre.')
      return
    }
    setError(null)
    updateProfile(name.trim(), {
      onSuccess: () => sileo.success({ title: 'Perfil actualizado', duration: 2000 }),
      onError: (err: unknown) => sileo.error({ title: 'No se pudo actualizar el perfil', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Perfil</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField htmlFor="profile-name" label="Nombre" required error={error}>
          <Input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={fieldDescriptionId('profile-name')}
          />
        </FormField>
        <FormField htmlFor="profile-email" label="Correo" required hint="El correo no se puede cambiar desde aquí.">
          <Input id="profile-email" type="email" value={currentUser?.email || ''} disabled aria-describedby={fieldDescriptionId('profile-email')} />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={isPending || name.trim() === currentUser?.name}>
          {isPending ? 'Guardando...' : 'Guardar nombre'}
        </Button>
      </div>
    </form>
  )
}
