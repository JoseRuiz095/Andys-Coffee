import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CashPaymentDialog } from './CashPaymentDialog'

describe('CashPaymentDialog', () => {
  it('computes the change and confirms with the received amount', async () => {
    const onConfirm = vi.fn()
    render(<CashPaymentDialog open saleAmount={90} onClose={vi.fn()} onConfirm={onConfirm} />)
    await userEvent.type(screen.getByLabelText('Monto recibido'), '100')
    expect(screen.getByText('$10.00')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }))
    expect(onConfirm).toHaveBeenCalledWith(100)
  })

  it('fills the received amount with one tap (exact or a bill) without changing the change math', async () => {
    const onConfirm = vi.fn()
    render(<CashPaymentDialog open saleAmount={90} deliveryAmount={20} onClose={vi.fn()} onConfirm={onConfirm} />)
    const quick = screen.getByRole('group', { name: 'Montos rápidos' })
    expect(Array.from(quick.querySelectorAll('button')).map((button) => button.textContent)).toEqual(['Exacto', '$200.00', '$500.00', '$1,000.00'])
    await userEvent.click(screen.getByRole('button', { name: '$200.00' }))
    expect((screen.getByLabelText('Monto recibido') as HTMLInputElement).value).toBe('200')
    // Sale $90 + mandadito $20 = $110: the change of $200 is $90 (shown next to the sale amount).
    expect(screen.getAllByText('$90.00')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Exacto' }))
    expect((screen.getByLabelText('Monto recibido') as HTMLInputElement).value).toBe('110')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }))
    expect(onConfirm).toHaveBeenCalledWith(110)
  })

  it('offers no quick amounts while the total is being priced', () => {
    render(<CashPaymentDialog open saleAmount={null} onClose={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Exacto' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('group', { name: 'Montos rápidos' }).querySelectorAll('button')).toHaveLength(1)
  })

  it('offers a retry instead of waiting forever when the quote failed, and never charges without it', async () => {
    const onRetryPricing = vi.fn()
    render(
      <CashPaymentDialog
        open
        saleAmount={null}
        pricingError="Servicio no disponible."
        onRetryPricing={onRetryPricing}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('Servicio no disponible.')
    expect(screen.queryByText('Esperando el total del servidor…')).toBeNull()
    await userEvent.type(screen.getByLabelText('Monto recibido'), '500')
    expect(screen.getByRole('button', { name: 'Confirmar pago' })).toHaveProperty('disabled', true)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetryPricing).toHaveBeenCalledTimes(1)
  })
})
