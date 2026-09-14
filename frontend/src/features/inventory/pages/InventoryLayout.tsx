import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { InventoryCurrent } from './InventoryCurrent'
import { InventoryAddEntry } from './InventoryAddEntry'
import { InventoryEntries } from './InventoryEntries'
import { InventoryMovements } from './InventoryMovements'
import { InventoryPhysical } from './InventoryPhysical'
import { InventoryExits } from './InventoryExits'

type InventoryView = 'current' | 'add-entry' | 'entries' | 'movements' | 'physical' | 'exits'

export function InventoryLayout() {
  const [activeView, setActiveView] = useState<InventoryView>('current')
  const prevViewRef = useRef<InventoryView>(activeView)

  const views: InventoryView[] = ['current', 'add-entry', 'entries', 'movements', 'physical', 'exits']
  const currentIndex = views.indexOf(activeView)
  const prevIndex = views.indexOf(prevViewRef.current)
  const direction = currentIndex > prevIndex ? 1 : -1

  const handleViewChange = (view: InventoryView) => {
    prevViewRef.current = activeView
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
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-1">
            <button
              onClick={() => handleViewChange('current')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'current'
                  ? 'border-[#5A804F] text-[#5A804F]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Inventario Actual
            </button>
            <button
              onClick={() => handleViewChange('add-entry')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'add-entry'
                  ? 'border-[#5A804F] text-[#5A804F]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Agregar Entrada
            </button>
            <button
              onClick={() => handleViewChange('entries')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'entries'
                  ? 'border-[#5A804F] text-[#5A804F]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Entradas
            </button>
            <button
              onClick={() => handleViewChange('movements')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'movements'
                  ? 'border-[#5A804F] text-[#5A804F]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Movimientos
            </button>
            <button
              onClick={() => handleViewChange('physical')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'physical'
                  ? 'border-[#5A804F] text-[#5A804F]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Conteos Físicos
            </button>
            <button
              onClick={() => handleViewChange('exits')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeView === 'exits'
                  ? 'border-[#5A804F] text-[#5A804F]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
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
