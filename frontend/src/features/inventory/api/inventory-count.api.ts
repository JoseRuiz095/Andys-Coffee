import { apiClient } from '../../../app/api';

export interface InventoryCountItem {
  id?: string;
  inventoryCountId: string;
  ingredientId: string;
  ingredient?: {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    unit: {
      id: string;
      abbreviation: string;
    };
  };
  systemQuantity: number;
  countedQuantity: number;
  difference: number;
  notes: string | null;
}

export interface InventoryCount {
  id: string;
  status: 'draft' | 'completed' | 'applied';
  items: InventoryCountItem[];
  createdBy: {
    id: string;
    name: string;
  };
  completedBy?: {
    id: string;
    name: string;
  };
  createdAt: string;
  completedAt: string | null;
  appliedAt: string | null;
}

export interface PaginatedInventoryCounts {
  data: InventoryCount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const InventoryCountAPI = {
  async getAll(params: { page?: number; limit?: number; status?: string; date?: string } = {}): Promise<PaginatedInventoryCounts> {
    const response = await apiClient.get('/inventory-counts', { params });
    return response.data;
  },

  async createCount(): Promise<InventoryCount> {
    const response = await apiClient.post('/inventory-counts');
    return response.data.data;
  },

  async getCount(countId: string): Promise<InventoryCount> {
    const response = await apiClient.get(`/inventory-counts/${countId}`);
    return response.data.data;
  },

  async addItem(
    countId: string,
    ingredientId: string,
    countedQuantity: number,
    notes?: string,
  ): Promise<InventoryCountItem> {
    const response = await apiClient.post(`/inventory-counts/${countId}/items`, {
      ingredientId,
      countedQuantity,
      notes: notes || null,
    });
    return response.data.data;
  },

  async completeCount(countId: string): Promise<InventoryCount> {
    const response = await apiClient.post(
      `/inventory-counts/${countId}/complete`,
    );
    return response.data.data;
  },

  async applyAdjustments(countId: string): Promise<InventoryCount> {
    const response = await apiClient.post(`/inventory-counts/${countId}/apply`);
    return response.data.data;
  },

  async removeItem(countId: string, ingredientId: string): Promise<void> {
    await apiClient.delete(`/inventory-counts/${countId}/items/${ingredientId}`);
  },

  async deleteCount(countId: string): Promise<void> {
    await apiClient.delete(`/inventory-counts/${countId}`);
  },
};
