import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CashClosingDialog } from './CashClosingDialog'

function renderDialog(overrides: Partial<React.ComponentProps<typeof CashClosingDialog>> = {}) {
  const props = { open: true, expectedAmount: 300, onClose: vi.fn(), onConfirm: vi.fn(), ...overrides }
  render(<CashClosingDialog {...props} />)
  return props
}

describe('CashClosingDialog', () => {
  it('does not continue while the counted amount is empty', async () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveProperty('disabled', true)
    await userEvent.type(screen.getByRole('spinbutton'), '0')
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveProperty('disabled', false)
  })

  it('goes back from the review keeping the typed amount, so a typo can be fixed', async () => {
    const { onConfirm } = renderDialog()
    await userEvent.type(screen.getByRole('spinbutton'), '280')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Resumen del corte')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Regresar' }))
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    expect(input.value).toBe('280')

    await userEvent.clear(input)
    await userEvent.type(input, '300')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
    expect(onConfirm).toHaveBeenCalledWith({ closingAmount: 300, reason: undefined, comment: undefined })
  })

  it('can be dismissed with Escape from the review step, but not while closing', async () => {
    const { onClose } = renderDialog()
    await userEvent.type(screen.getByRole('spinbutton'), '300')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape while the close request is in flight', async () => {
    const { onClose } = renderDialog({ isLoading: true })
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('requires a reason when the count differs from the expected amount', async () => {
    renderDialog()
    await userEvent.type(screen.getByRole('spinbutton'), '290')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('button', { name: 'Confirmar cierre' })).toHaveProperty('disabled', true)
    await userEvent.selectOptions(screen.getByRole('combobox'), screen.getAllByRole('option')[1])
    expect(screen.getByRole('button', { name: 'Confirmar cierre' })).toHaveProperty('disabled', false)
  })
})
