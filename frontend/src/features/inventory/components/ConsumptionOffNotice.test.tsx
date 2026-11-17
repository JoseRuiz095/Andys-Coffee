import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConsumptionOffNotice } from './ConsumptionOffNotice'

const settings = vi.hoisted(() => ({ consumeOnSale: false, lowStockNotify: true }))
const withoutRecipe = vi.hoisted(() => ({ list: [] as { id: string; name: string }[] }))
vi.mock('../hooks/useInventory', () => ({
  useInventorySettings: () => ({ data: settings }),
  useProductsWithoutRecipe: () => ({ data: withoutRecipe.list }),
}))

describe('ConsumptionOffNotice', () => {
  it('warns that sales do not discount while the switch is off, naming what blocks it', () => {
    settings.consumeOnSale = false
    withoutRecipe.list = [{ id: 'p1', name: 'Croissant' }]
    render(<ConsumptionOffNotice onShowProducts={() => {}} />)
    expect(screen.getByText(/las ventas no descuentan insumos/)).toBeTruthy()
    expect(screen.getByText(/Croissant/)).toBeTruthy()
  })

  it('is hidden while consumption is on', () => {
    settings.consumeOnSale = true
    const { container } = render(<ConsumptionOffNotice onShowProducts={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
