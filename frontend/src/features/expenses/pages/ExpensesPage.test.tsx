import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Expense, ExpenseListFilters } from '../types/expense.types'

const useExpensesMock = vi.fn()
vi.mock('../hooks/useExpenses', () => ({ useExpenses: (filters: ExpenseListFilters) => useExpensesMock(filters) }))
const permissionsMock = vi.fn<() => string[]>()
vi.mock('../../auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ id: 'u1', name: 'Ana', email: 'ana@andys.mx', roleId: 'r1', roleName: 'ADMIN', isActive: true, permissions: permissionsMock() }),
}))

const { ExpensesPage } = await import('./ExpensesPage')

const expense: Expense = {
  id: 'e1',
  category: 'insumos',
  description: 'Leche para la semana',
  amount: '120.50',
  paymentMethod: 'cash',
  expenseDate: '2026-11-10T12:00:00.000Z',
  cashSessionId: null,
  cashSession: null,
  createdAt: '2026-11-10T12:00:00.000Z',
}

function hookResult(page = 1) {
  return {
    expenses: [expense],
    pagination: { page, limit: 20, total: 45, totalPages: 3 },
    loading: false,
    create: vi.fn((_input, options?: { onSuccess?: () => void }) => options?.onSuccess?.()),
    update: vi.fn(),
    deleteAsync: vi.fn(),
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
  }
}

describe('ExpensesPage', () => {
  beforeEach(() => {
    permissionsMock.mockReturnValue(['expenses.read', 'expenses.create', 'expenses.update', 'expenses.delete'])
    useExpensesMock.mockImplementation((filters: ExpenseListFilters) => hookResult(filters.page ?? 1))
  })

  it('opens "Editar" with the expense values and "Nuevo gasto" empty', async () => {
    render(<ExpensesPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect((screen.getByPlaceholderText('Describe el gasto') as HTMLInputElement).value).toBe('Leche para la semana')
    expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe('120.50')

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo gasto' }))
    expect((screen.getByPlaceholderText('Describe el gasto') as HTMLInputElement).value).toBe('')
  })

  it('requests the next page of expenses', async () => {
    render(<ExpensesPage />)
    expect(screen.getByText('Mostrando 1–20 de 45 gastos')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(useExpensesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('with only expenses.read shows the list without create, edit or delete', () => {
    permissionsMock.mockReturnValue(['expenses.read'])
    render(<ExpensesPage />)
    expect(screen.getByText('Leche para la semana')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nuevo gasto' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull()
  })
})
