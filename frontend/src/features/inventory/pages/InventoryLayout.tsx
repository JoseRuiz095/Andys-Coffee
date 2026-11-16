import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { InventoryCurrent } from './InventoryCurrent'
import { InventoryAddEntry } from './InventoryAddEntry'
import { InventoryEntries } from './InventoryEntries'
import { InventoryMovements } from './InventoryMovements'
import { InventoryPhysical } from './InventoryPhysical'
import { InventoryExits } from './InventoryExits'
import { InventoryManagementPage } from './InventoryManagementPage'
import { InventoryReplenishment } from './InventoryReplenishment'
import { useUrlParam } from '../../../shared/hooks/useUrlParam'
import { usePrevious } from '../../../shared/hooks/usePrevious'
import { SegmentedTabs } from '../../../shared/components/SegmentedTabs'
import { SectionTabs } from '../../../shared/components/SectionTabs'

/** The views (their ids are the ?inv= values used by links, kept as they were). */
type InventoryView = 'current' | 'add-entry' | 'entries' | 'movements' | 'physical' | 'exits' | 'management' | 'replenishment'

interface InventorySection {
  id: string
  label: string
  /** First one opens when the section is chosen. */
  views: { id: InventoryView; label: string; render: () => ReactNode }[]
}

/**
 * Views grouped by task (5 sections instead of 8 tabs): the purchase flow, the stock adjustments
 * and the catalog each live under one tab, with a segmented control for their views.
 */
const SECTIONS: InventorySection[] = [
  { id: 'stock', label: 'Existencias', views: [{ id: 'current', label: 'Existencias', render: () => <InventoryCurrent /> }] },
  {
    id: 'purchases',
    label: 'Compras',
    views: [
      { id: 'entries', label: 'Por recibir', render: () => <InventoryEntries /> },
      { id: 'add-entry', label: 'Nueva compra', render: () => <InventoryAddEntry /> },
      { id: 'replenishment', label: 'Sugerencias', render: () => <InventoryReplenishment /> },
    ],
  },
  {
    id: 'adjustments',
    label: 'Ajustes',
    views: [
      { id: 'exits', label: 'Salidas', render: () => <InventoryExits /> },
      { id: 'physical', label: 'Conteos', render: () => <InventoryPhysical /> },
    ],
  },
  { id: 'movements', label: 'Movimientos', views: [{ id: 'movements', label: 'Movimientos', render: () => <InventoryMovements /> }] },
  { id: 'catalog', label: 'Catálogo', views: [{ id: 'management', label: 'Catálogo', render: () => <InventoryManagementPage /> }] },
]

const VIEW_IDS: InventoryView[] = SECTIONS.flatMap((section) => section.views.map((view) => view.id))
const sectionOf = (view: InventoryView) => SECTIONS.find((section) => section.views.some((item) => item.id === view)) ?? SECTIONS[0]

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 100 : -100, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 100 : -100, opacity: 0 }),
}

export function InventoryLayout() {
  // Kept in the URL (?inv=<view>): a reload stays on the view and Back returns to the previous one.
  const [activeView, setActiveView] = useUrlParam<InventoryView>('inv', VIEW_IDS, 'current')
  const activeSection = sectionOf(activeView)
  const previousSection = usePrevious(activeSection.id)
  const sectionIds = SECTIONS.map((section) => section.id)
  // Slide between sections; views of the same section just swap.
  const direction = previousSection && sectionIds.indexOf(activeSection.id) < sectionIds.indexOf(previousSection) ? -1 : 1
  const active = activeSection.views.find((view) => view.id === activeView) ?? activeSection.views[0]

  // Leaving the catalog drops its own tab from the URL.
  const selectView = (view: InventoryView) => setActiveView(view, { clear: view === 'management' ? [] : ['gestion'] })

  return (
    <div>
      <SectionTabs
        ariaLabel="Secciones de inventario"
        items={SECTIONS}
        value={activeSection.id}
        onChange={(id) => selectView((SECTIONS.find((section) => section.id === id) ?? SECTIONS[0]).views[0].id)}
      />

      <div className="mx-auto max-w-7xl pt-5">
        {activeSection.views.length > 1 && (
          <SegmentedTabs
            className="mb-5"
            ariaLabel={`Vistas de ${activeSection.label}`}
            items={activeSection.views}
            value={active.id}
            onChange={selectView}
          />
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${activeSection.id}-section`}
            role="tabpanel"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <div key={active.id}>{active.render()}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
