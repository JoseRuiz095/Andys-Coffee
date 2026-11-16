import { apiClient } from '../../../app/api';

export interface InventoryIngredient {
  id: string;
  name: string;
  sku: string | null;
  currentStock: number;
  minimumStock: number;
  /** Restock target; null = 2 × minimumStock. */
  maximumStock: number | null;
  averageCost: number;
  isActive: boolean;
  createdAt: string;
  unit: {
    id: string;
    name: string;
    abbreviation: string;
  };
}

/** Unit of measure. Ingredients are stocked in base units (factor 1: gr, ml, pz). */
export interface InventoryUnit {
  id: string;
  name: string;
  abbreviation: string;
  dimension: 'MASS' | 'VOLUME' | 'COUNT';
  /** Conversion to the base unit of its dimension (Decimal serialized as text, e.g. "1000"). */
  factor: string;
}

/** GET /inventory/replenishment: an ingredient to restock and how much. */
export interface ReplenishmentSuggestion {
  ingredientId: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number | null;
  dailyConsumption: number;
  coverageDays: number | null;
  target: number;
  suggestedQuantity: number;
  lastSupplier: { id: string; name: string } | null;
  lastPurchasedAt: string | null;
  unitCost: number;
  estimatedCost: number;
}

/** Inventory switches (GET/PATCH /inventory/settings). */
export interface InventorySettings {
  consumeOnSale: boolean;
  lowStockNotify: boolean;
}

export interface InventorySummary {
  totalIngredients: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: string;
}

export interface InventoryMovement {
  id: string;
  type: string;
  quantity: number;
  unitCost: number;
  referenceType: string | null;
  referenceId: string | null;
  /** Exit reason (waste, damaged…). */
  reason: string | null;
  notes: string | null;
  /** Stock right after the movement (null on movements before 2026-11-11). */
  balanceAfter: number | string | null;
  /** Sale line that originated it. */
  orderItem: { productName: string; size: 'REGULAR' | 'JUMBO'; order: { id: string; orderNumber: string } } | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  } | null;
  ingredient: {
    id: string;
    name: string;
    sku: string | null;
    unit: {
      abbreviation: string;
    };
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const inventoryApi = {
  // Get summary stats
  getSummary: async () => {
    const response = await apiClient.get<InventorySummary>('/inventory/summary');
    return response.data;
  },

  // Get total inventory value
  getTotalValue: async () => {
    const response = await apiClient.get<{ totalValue: string }>('/inventory/value');
    return response.data.totalValue;
  },

  // Get low stock ingredients
  /** Restock suggestions from the consumption of the last `days`. */
  getReplenishment: async (days: number) => {
    const response = await apiClient.get<ReplenishmentSuggestion[]>('/inventory/replenishment', { params: { days } });
    return response.data;
  },

  getSettings: async () => {
    const response = await apiClient.get<InventorySettings>('/inventory/settings');
    return response.data;
  },

  /** Turning consumption on is refused (409) while products lack their recipe. */
  updateSettings: async (input: Partial<InventorySettings>) => {
    const response = await apiClient.patch<InventorySettings>('/inventory/settings', input);
    return response.data;
  },

  /** Active products that consume inventory but miss their recipe (per size). */
  getProductsWithoutRecipe: async () => {
    const response = await apiClient.get<Array<{
      id: string;
      name: string;
      sku: string;
      category: string | null;
      missing: Array<'REGULAR' | 'JUMBO'>;
    }>>('/inventory/products-without-recipe');
    return response.data;
  },

  getLowStock: async () => {
    const response = await apiClient.get<InventoryIngredient[]>('/inventory/low-stock');
    return response.data;
  },

  // List all ingredients with pagination and filters
  getAll: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'all' | 'normal' | 'low_stock' | 'out_of_stock';
    isActive?: boolean;
  } = {}) => {
    const response = await apiClient.get<PaginatedResponse<InventoryIngredient>>(
      '/inventory',
      { params }
    );
    return response.data;
  },

  // Get single ingredient by ID
  getById: async (id: string) => {
    const response = await apiClient.get<
      InventoryIngredient & {
        movements: InventoryMovement[];
        recipes: Array<{
          productId: string;
          quantity: number;
          product: {
            id: string;
            name: string;
            sku: string;
          };
        }>;
      }
    >(`/inventory/${id}`);
    return response.data;
  },

  // Get ingredient by SKU
  getBySku: async (sku: string) => {
    const response = await apiClient.get<InventoryIngredient>(`/inventory/sku/${sku}`);
    return response.data;
  },

  // Get inventory movements with filters
  getMovements: async (params: {
    page?: number;
    limit?: number;
    ingredientId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {}) => {
    const response = await apiClient.get<PaginatedResponse<InventoryMovement>>(
      '/inventory/movements',
      { params }
    );
    return response.data;
  },

  // Search ingredients by name or SKU
  searchIngredients: async (query: string) => {
    const response = await apiClient.get<InventoryIngredient[]>(
      '/inventory/search',
      { params: { q: query } }
    );
    return response.data;
  },

  // Get all inventory units
  getUnits: async () => {
    const response = await apiClient.get<InventoryUnit[]>('/inventory/units');
    return response.data;
  },

  // Create new ingredient
  create: async (data: {
    name: string;
    sku?: string;
    unitId: string;
    minimumStock?: number;
    maximumStock?: number | null;
  }) => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      ingredient: InventoryIngredient;
    }>('/inventory', data);
    return response.data;
  },

  // Update ingredient
  update: async (id: string, data: {
    name?: string;
    sku?: string;
    minimumStock?: number;
    maximumStock?: number | null;
  }) => {
    const response = await apiClient.patch<{
      success: boolean;
      message: string;
      ingredient: InventoryIngredient;
    }>(`/inventory/${id}`, data);
    return response.data;
  },

  // Activate/deactivate ingredient
  setActive: async (id: string, isActive: boolean) => {
    const response = await apiClient.patch<{
      success: boolean;
      message: string;
      ingredient: InventoryIngredient;
    }>(`/inventory/${id}/active`, { isActive });
    return response.data;
  },

  // Delete ingredient
  delete: async (id: string) => {
    const response = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/inventory/${id}`);
    return response.data;
  },
};
