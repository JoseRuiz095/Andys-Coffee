// Pages
export { InventoryLayout } from './pages/InventoryLayout';
export { InventoryCurrent } from './pages/InventoryCurrent';
export { InventoryAddEntry } from './pages/InventoryAddEntry';
export { InventoryEntries } from './pages/InventoryEntries';
export { InventoryMovements } from './pages/InventoryMovements';
export { InventoryExits } from './pages/InventoryExits';

// Components
export { InventoryStats } from './components/InventoryStats';
export { InventoryAlerts } from './components/InventoryAlerts';
export { InventoryTable } from './components/InventoryTable';
export { IngredientFormModal } from './components/IngredientFormModal';
export { SupplierFormModal } from './components/SupplierFormModal';

// Hooks - Inventory
export {
  useInventorySummary,
  useInventoryValue,
  useLowStock,
  useInventoryList,
  useInventoryById,
  useInventoryBySku,
  useInventoryMovements,
  useSearchIngredients,
  useCreateIngredient,
  useUpdateIngredient,
  useSetIngredientActive,
} from './hooks/useInventory';

// Hooks - Purchases
export {
  usePurchasesList,
  usePurchaseById,
  useReceivePurchase,
  useCreatePurchase,
  useDraftPurchases,
  useReceivedPurchases,
  useSearchSuppliers,
  useCreateSupplier,
} from './hooks/usePurchases';

// Hooks - Exits
export { useCreateExit } from './hooks/useInventoryExits';

// API - Inventory
export { inventoryApi } from './api/inventory.api';
export type {
  InventoryIngredient,
  InventorySummary,
  InventoryMovement,
  PaginatedResponse,
} from './api/inventory.api';

// API - Purchases
export { purchasesApi } from './api/purchases.api';
export type { Purchase, PurchaseItem, Supplier, DuplicateErrorResponse } from './api/purchases.api';

// API - Exits
export { inventoryExitsApi, EXIT_REASON_LABELS } from './api/inventory-exits.api';
export type { ExitReason, CreateExitPayload, ExitResult } from './api/inventory-exits.api';
