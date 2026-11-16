import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} ariaLabelledBy="t">
        <h2 id="t">Título</h2>
        <input aria-label="Nombre" />
        <button type="button" onClick={() => setOpen(false)}>Cerrar</button>
      </Modal>
    </>
  )
}

describe('Modal focus management', () => {
  it('moves focus in, keeps Tab inside and returns focus to the opener', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    await userEvent.click(opener)

    expect(document.activeElement).toBe(screen.getByLabelText('Nombre'))
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }))
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre'))

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('is labelled by its title', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByRole('dialog', { name: 'Título' })).toBeTruthy()
  })
})
