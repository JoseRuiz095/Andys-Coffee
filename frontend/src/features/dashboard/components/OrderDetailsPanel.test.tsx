import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderDetailsPanel } from './OrderDetailsPanel'
import type { OrderItem } from '../types/order.types'

const latte: OrderItem = {
  id: 'line-1',
  productId: 'p1',
  productName: 'Latte',
  quantity: 2,
  unitPrice: 45,
  image: null,
  type: 'product',
  temperature: 'COLD',
}

describe('OrderDetailsPanel', () => {
  it('shows the payment methods as buttons and reports the chosen one', async () => {
    const onPaymentMethodChange = vi.fn()
    render(<OrderDetailsPanel items={[latte]} paymentMethod="cash" onPaymentMethodChange={onPaymentMethodChange} />)
    const group = screen.getByRole('group', { name: 'Método de pago' })
    expect(within(group).getByRole('button', { name: 'Efectivo' }).getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(within(group).getByRole('button', { name: 'Transf.' }))
    await userEvent.click(within(group).getByRole('button', { name: 'Tarjeta' }))
    await userEvent.click(within(group).getByRole('button', { name: 'Pendiente' }))
    expect(onPaymentMethodChange.mock.calls.map(([method]) => method)).toEqual(['transfer', 'card', 'pending'])
  })

  it('keeps the line controls with their labels and the total with the server amount', async () => {
    const onRemoveItem = vi.fn()
    const onIncrementItem = vi.fn()
    const onDeleteItem = vi.fn()
    render(
      <OrderDetailsPanel
        items={[latte]}
        subtotal={90}
        discount={45}
        total={45}
        lineTotals={[{ gross: 90, net: 45 }]}
        onRemoveItem={onRemoveItem}
        onIncrementItem={onIncrementItem}
        onDeleteItem={onDeleteItem}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Quitar una unidad de Latte' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar una unidad de Latte' }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Latte de la orden' }))
    expect([onRemoveItem, onIncrementItem, onDeleteItem].map((fn) => fn.mock.calls[0]?.[0])).toEqual(['line-1', 'line-1', 'line-1'])
    expect(screen.getByTestId('pos-total').textContent).toBe('$45.00')
    expect(screen.getByText('Promociones')).toBeTruthy()
    expect(screen.getByText('2 productos')).toBeTruthy()
  })

  it('opens the order note on demand and keeps it open while it has text', async () => {
    const onNotesChange = vi.fn()
    const { rerender } = render(<OrderDetailsPanel items={[latte]} onNotesChange={onNotesChange} />)
    expect(screen.queryByLabelText('Notas de la orden')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Nota de la orden' }))
    await userEvent.type(screen.getByLabelText('Notas de la orden'), 'x')
    expect(onNotesChange).toHaveBeenCalledWith('x')
    rerender(<OrderDetailsPanel items={[latte]} orderNotes="Para llevar" onNotesChange={onNotesChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Nota de la orden' }))
    expect(screen.getByLabelText('Notas de la orden')).toBeTruthy()
  })

  it('cannot process or schedule an empty order', () => {
    render(<OrderDetailsPanel items={[]} />)
    expect(screen.getByRole('button', { name: 'Procesar orden' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Programar pedido' })).toHaveProperty('disabled', true)
    expect(screen.getByText('Aún no hay productos agregados')).toBeTruthy()
  })

  it('asks for the customer name when the payment is pending', () => {
    render(<OrderDetailsPanel items={[latte]} paymentMethod="pending" />)
    const name = screen.getByLabelText('Nombre del cliente')
    expect(name.getAttribute('aria-required')).toBe('true')
    expect(name.getAttribute('placeholder')).toContain('obligatorio')
  })
})
