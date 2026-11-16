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
