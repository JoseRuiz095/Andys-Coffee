import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RoleData } from '../../roles/api/role.api'
import type { AuthUser } from '../../auth/types/auth.types'

const createUser = vi.fn()
vi.mock('../hooks/useUsers', () => ({
  useCreateUser: () => ({ mutate: createUser, isPending: false }),
  useUpdateUser: () => ({ mutate: vi.fn(), isPending: false }),
}))

const { UserFormModal } = await import('./UserFormModal')

const role = (id: string, names: string[]): RoleData => ({
  id,
  name: id.toUpperCase(),
  isSystem: false,
  createdAt: '',
  updatedAt: '',
  _count: { users: 0 },
  permissions: names.map((name) => ({ permission: { id: name, name } })),
})
const actor: AuthUser = { id: 'a', name: 'A', email: 'a@x.mx', roleId: 'r', isActive: true, permissions: ['users.create', 'sales.read'] }

describe('UserFormModal', () => {
  it('shows each error next to its field instead of only a toast', async () => {
    render(<UserFormModal roles={[role('cajero', ['sales.read'])]} currentUser={actor} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(screen.getByText('Ingresa el nombre completo.')).toBeTruthy()
    expect(screen.getByText('Ingresa el correo.')).toBeTruthy()
    expect(screen.getByText(/Selecciona el rol/)).toBeTruthy()
    expect(screen.getByText('Ingresa una contraseña.')).toBeTruthy()
    expect(createUser).not.toHaveBeenCalled()
  })

  it('sends the password exactly as typed and disables roles with permissions the actor lacks', async () => {
    render(<UserFormModal roles={[role('cajero', ['sales.read']), role('admin', ['users.delete'])]} currentUser={actor} onClose={vi.fn()} />)
    expect((screen.getByRole('option', { name: /ADMIN \(incluye permisos que no tienes\)/ }) as HTMLOptionElement).disabled).toBe(true)

    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana López')
    await userEvent.type(screen.getByLabelText(/Correo/), 'ana@andys.mx')
    await userEvent.selectOptions(screen.getByLabelText(/^Rol/), 'cajero')
    await userEvent.type(screen.getByLabelText(/Contraseña inicial/), 'Clave1234 ')
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(createUser).toHaveBeenCalledWith(
      { name: 'Ana López', email: 'ana@andys.mx', password: 'Clave1234 ', roleId: 'cajero' },
      expect.anything(),
    )
  })
})
