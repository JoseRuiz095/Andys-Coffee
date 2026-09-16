import { useState } from 'react'
import { motion } from 'framer-motion'
import { IngredientIcon } from '../../../components/ui/IngredientIcon'
import { SupplierIcon } from '../../../components/ui/SupplierIcon'
import { IngredientsTab } from '../components/tabs/IngredientsTab'
import { SuppliersTab } from '../components/tabs/SuppliersTab'

type TabType = 'ingredients' | 'suppliers'

export function InventoryManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('ingredients')

  const tabs = [
    { id: 'ingredients' as const, label: 'Ingredientes', icon: IngredientIcon },
    { id: 'suppliers' as const, label: 'Proveedores', icon: SupplierIcon },
  ]

  return (
    <motion.div
      className="min-h-screen p-4 md:p-6"
      style={{ backgroundColor: 'var(--color-background)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="mb-1 text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Gestión de Inventario</h1>
          <p className="text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>Administra ingredientes y proveedores</p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          className="mb-6 border-b overflow-x-auto"
          style={{ borderColor: 'var(--color-border)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex gap-2 min-w-max md:min-w-0">
            {tabs.map((tab) => {
              const IconComponent = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 md:px-6 py-3 font-medium transition-colors relative whitespace-nowrap text-sm md:text-base flex items-center gap-2"
                  style={{ color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                >
                  <IconComponent size={20} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                      layoutId="activeTab"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'ingredients' && <IngredientsTab />}
          {activeTab === 'suppliers' && <SuppliersTab />}
        </motion.div>
      </div>
    </motion.div>
  )
}
