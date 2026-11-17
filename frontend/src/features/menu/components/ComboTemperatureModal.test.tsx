import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComboTemperatureModal } from './ComboTemperatureModal'
import type { MenuItem } from '../types/menu.types'

const combo: MenuItem = {
  id: 'combo-1',
  name: 'Combo de la casa',
  description: null,
  price: 150,
  imageUrl: null,
  type: 'combo',
  temperatureChoices: [{ productId: 'latte-1', name: "Latte Andy's" }],
}

describe('ComboTemperatureModal', () => {
  it('asks hot or cold for each drink and sends the choice with the combo', async () => {
    const onAddToOrder = vi.fn()
    render(<ComboTemperatureModal combo={combo} onClose={() => {}} onAddToOrder={onAddToOrder} />)
    const add = screen.getByRole('button', { name: 'Agregar al pedido' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Frío' }))
    expect(add.disabled).toBe(false)
    await userEvent.click(add)
    expect(onAddToOrder).toHaveBeenCalledWith(combo, 1, [], [{ productId: 'latte-1', temperature: 'COLD' }])
  })
})
