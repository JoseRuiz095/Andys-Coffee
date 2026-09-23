import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { InventoryCurrent } from './InventoryCurrent'
import { InventoryAddEntry } from './InventoryAddEntry'
import { InventoryEntries } from './InventoryEntries'
import { InventoryMovements } from './InventoryMovements'
import { InventoryPhysical } from './InventoryPhysical'
import { InventoryExits } from './InventoryExits'
import { InventoryManagementPage } from './InventoryManagementPage'

type InventoryView = 'current' | 'add-entry' | 'entries' | 'movements' | 'physical' | 'exits' | 'management'

export function InventoryLayout() {
  const [activeView, setActiveView] = useState<InventoryView>('current')
  // Slide direction of the view transition, decided when the user switches views.
  const [direction, setDirection] = useState<1 | -1>(1)

  const views: InventoryView[] = ['current', 'management', 'add-entry', 'entries', 'movements', 'physical', 'exits']

  const handleViewChange = (view: InventoryView) => {
    setDirection(views.indexOf(view) > views.indexOf(activeView) ? 1 : -1)
    setActiveView(view)
  }

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 100 : -100,
      opacity: 0,
    }),
  }

  return (
    <div>
      {/* Sub-navigation */}
      <div className="sticky top-0 z-10 border-b overflow-x-auto" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-1 min-w-max md:min-w-0">
            <button
              onClick={() => handleViewChange('current')}
              className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderColor: activeView === 'current' ? 'var(--color-primary)' : 'transparent',
                color: activeView === 'current' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Inventario Actual
            </button>
            <button
              onClick={() => handleViewChange('management')}
              className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderColor: activeView === 'management' ? 'var(--color-primary)' : 'transparent',
                color: activeView === 'management' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Gestión de Inventario
            </button>
            <button
              onClick={() => handleViewChange('add-entry')}
              className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderColor: activeView === 'add-entry' ? 'var(--color-primary)' : 'transparent',
                color: activeView === 'add-entry' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Agregar Entrada
            </button>
            <button
              onClick={() => handleViewChange('entries')}
              className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderColor: activeView === 'entries' ? 'var(--color-primary)' : 'transparent',
                color: activeView === 'entries' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Entradas
            </button>
            <button
              onClick={() => handleViewChange('movements')}
              className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderColor: activeView === 'movements' ? 'var(--color-primary)' : 'transparent',
                color: activeView === 'movements' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Movimientos
            </button>
            <button
              onClick={() => handleViewChange('physical')}
              className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderColor: activeView === 'physical' ? 'var(--color-primary)' : 'transparent',
                color: activeView === 'physical' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Conteos Físicos
            </button>
            <button
              onClick={() => handleViewChange('exits')}
              className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderColor: activeView === 'exits' ? 'var(--color-primary)' : 'transparent',
                color: activeView === 'exits' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              }}
            >
              Salidas Manuales
            </button>
          </nav>
        </div>
      </div>

      {/* Content with animations */}
      <AnimatePresence mode="wait" custom={direction}>
        {activeView === 'current' && (
          <motion.div
            key="current-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <InventoryCurrent />
          </motion.div>
        )}
        {activeView === 'management' && (
          <motion.div
            key="management-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <InventoryManagementPage />
          </motion.div>
        )}
        {activeView === 'add-entry' && (
          <motion.div
            key="add-entry-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <InventoryAddEntry />
          </motion.div>
        )}
        {activeView === 'entries' && (
          <motion.div
            key="entries-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <InventoryEntries />
          </motion.div>
        )}
        {activeView === 'movements' && (
          <motion.div
            key="movements-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <InventoryMovements />
          </motion.div>
        )}
        {activeView === 'physical' && (
          <motion.div
            key="physical-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <InventoryPhysical />
          </motion.div>
        )}
        {activeView === 'exits' && (
          <motion.div
            key="exits-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <InventoryExits />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
