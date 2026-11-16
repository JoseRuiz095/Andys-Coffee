import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from './Pagination'
import { getPageWindow, getRowRange } from '../utils/pagination'

describe('getPageWindow', () => {
  it('keeps five numbers on the last pages', () => {
    expect(getPageWindow(10, 10)).toEqual([6, 7, 8, 9, 10])
    expect(getPageWindow(9, 10)).toEqual([6, 7, 8, 9, 10])
  })

  it('centres the current page and clamps at the start', () => {
    expect(getPageWindow(5, 10)).toEqual([3, 4, 5, 6, 7])
    expect(getPageWindow(1, 10)).toEqual([1, 2, 3, 4, 5])
  })

  it('shows every page when there are few', () => {
    expect(getPageWindow(2, 3)).toEqual([1, 2, 3])
    expect(getPageWindow(1, 0)).toEqual([])
  })
})

describe('getRowRange', () => {
  it('reports the real rows of the last page', () => {
    expect(getRowRange(3, 20, 45)).toEqual({ from: 41, to: 45 })
    expect(getRowRange(1, 20, 0)).toEqual({ from: 0, to: 0 })
  })
})

describe('Pagination', () => {
  it('moves between pages and marks the current one', async () => {
    const onPageChange = vi.fn()
    render(<Pagination page={2} totalPages={3} total={45} pageSize={20} itemLabel="gastos" onPageChange={onPageChange} />)
    expect(screen.getByText('Mostrando 21–40 de 45 gastos')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Página 2' }).getAttribute('aria-current')).toBe('page')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('disables the edges', () => {
    render(<Pagination page={1} totalPages={2} total={30} pageSize={20} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Anterior' })).toHaveProperty('disabled', true)
  })
})
