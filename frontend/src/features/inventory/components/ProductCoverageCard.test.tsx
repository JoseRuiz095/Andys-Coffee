import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductCoverageCard } from './ProductCoverageCard'
import type { ProductCoverage } from '../api/inventory.api'

const latte: ProductCoverage = {
  id: 'p1',
  name: 'Latte',
  category: 'Bebidas',
  units: 0,
  variants: [
    {
      size: 'REGULAR', temperature: 'HOT', units: 0, limitingIngredientIds: ['vaso'],
      lines: [
        { ingredientId: 'vaso', name: 'Vaso café caliente', unit: 'pz', quantity: 1, currentStock: 0, units: 0 },
        { ingredientId: 'cafe', name: 'Café molido', unit: 'gr', quantity: 12, currentStock: 903, units: 75 },
      ],
    },
    {
      size: 'REGULAR', temperature: 'COLD', units: 47, limitingIngredientIds: ['frio'],
      lines: [{ ingredientId: 'frio', name: 'Vaso café frio', unit: 'pz', quantity: 1, currentStock: 47, units: 47 }],
    },
  ],
}

describe('ProductCoverageCard', () => {
  it('shows per variant how many units the stock covers and what limits it', async () => {
    const onClear = vi.fn()
    render(<ProductCoverageCard product={latte} onClear={onClear} />)
    expect(screen.getByText('Regular · caliente')).toBeTruthy()
    expect(screen.getByText('No alcanza para ninguna')).toBeTruthy()
    expect(screen.getByText('Alcanza para 47')).toBeTruthy()
    expect(screen.getAllByText('limita')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos los insumos' }))
    expect(onClear).toHaveBeenCalled()
  })
})
