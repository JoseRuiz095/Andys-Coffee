import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedTabs } from './SegmentedTabs'

const items = [
  { id: 'entries', label: 'Por recibir' },
  { id: 'add-entry', label: 'Nueva compra' },
  { id: 'replenishment', label: 'Sugerencias' },
] as const

function Harness({ onChange }: { onChange?: (id: string) => void }) {
  const [value, setValue] = useState<(typeof items)[number]['id']>('entries')
  return (
    <SegmentedTabs
      items={items}
      value={value}
      ariaLabel="Compras"
      onChange={(id) => {
        setValue(id)
        onChange?.(id)
      }}
    />
  )
}

describe('SegmentedTabs', () => {
  it('marks the active tab and changes on click', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    expect(screen.getByRole('tab', { name: 'Por recibir' }).getAttribute('aria-selected')).toBe('true')
    await userEvent.click(screen.getByRole('tab', { name: 'Sugerencias' }))
    expect(onChange).toHaveBeenLastCalledWith('replenishment')
    expect(screen.getByRole('tab', { name: 'Sugerencias' }).getAttribute('aria-selected')).toBe('true')
  })

  it('moves with the arrow keys and keeps only the active tab in the Tab order', async () => {
    render(<Harness />)
    const first = screen.getByRole('tab', { name: 'Por recibir' })
    expect(screen.getByRole('tab', { name: 'Nueva compra' }).getAttribute('tabindex')).toBe('-1')
    first.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Nueva compra' }))
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Sugerencias' }))
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Por recibir' }).getAttribute('aria-selected')).toBe('true')
  })
})
