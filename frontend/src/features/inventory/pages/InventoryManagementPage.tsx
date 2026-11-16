import { IngredientIcon } from '../../../components/ui/IngredientIcon'
import { SupplierIcon } from '../../../components/ui/SupplierIcon'
import { CoffeeIcon } from '../../../components/ui/coffee'
import { PlusIcon } from '../../../components/ui/PlusIcon'
import { useUrlParam } from '../../../shared/hooks/useUrlParam'
import { SegmentedTabs } from '../../../shared/components/SegmentedTabs'
import { IngredientsTab } from '../components/tabs/IngredientsTab'
import { SuppliersTab } from '../components/tabs/SuppliersTab'
import { ProductsTab } from '../components/tabs/ProductsTab'
import { ExtrasTab } from '../../extras/components/ExtrasTab'

type TabType = 'ingredients' | 'suppliers' | 'products' | 'extras'

const tabs = [
  { id: 'products' as const, label: 'Productos', icon: CoffeeIcon },
  { id: 'extras' as const, label: 'Extras', icon: PlusIcon },
  { id: 'ingredients' as const, label: 'Ingredientes', icon: IngredientIcon },
  { id: 'suppliers' as const, label: 'Proveedores', icon: SupplierIcon },
]
const TAB_IDS: TabType[] = tabs.map((tab) => tab.id)

/** Catálogo: what is sold (products, extras) and what is bought (ingredients, suppliers). */
export function InventoryManagementPage() {
  // Kept in the URL (?gestion=…) like the other tabs.
  const [activeTab, setActiveTab] = useUrlParam<TabType>('gestion', TAB_IDS, 'products')

  return (
    <div>
      <SegmentedTabs className="mb-5" ariaLabel="Catálogo de inventario" items={tabs} value={activeTab} onChange={setActiveTab} />
      <div key={activeTab}>
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'extras' && <ExtrasTab />}
        {activeTab === 'ingredients' && <IngredientsTab />}
        {activeTab === 'suppliers' && <SuppliersTab />}
      </div>
    </div>
  )
}
