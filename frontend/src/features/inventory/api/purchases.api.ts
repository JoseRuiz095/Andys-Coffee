import { apiClient } from '../../../app/api';

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  total: number | null;
  createdAt: string;
  ingredient: {
    id: string;
    name: string;
    sku: string | null;
    currentStock: number;
    minimumStock: number;
    averageCost: number;
    unit: {
      id: string;
      name: string;
      abbreviation: string;
    };
  };
}

export interface Purchase {
  id: string;
  supplierId: string | null;
  invoiceNumber: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  purchasedAt: string;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  items: PurchaseItem[];
  supplier?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isActive: boolean;
  } | null;
  createdBy?: {
    id: string;
    name: string;
  } | null;
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

export interface DuplicateErrorResponse {
  error: 'DUPLICATE_ERROR';
  message: string;
  details: {
    type: 'INGREDIENT' | 'SUPPLIER';
    existingId: string;
  };
}

export const purchasesApi = {
  // Get all purchases with optional status filter
  getAll: async (params: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}) => {
    const response = await apiClient.get<PaginatedResponse<Purchase>>(
      '/purchases',
      { params }
    );
    return response.data;
  },

  // Get single purchase by ID
  getById: async (id: string) => {
    const response = await apiClient.get<Purchase>(`/purchases/${id}`);
    return response.data;
  },

  // Create a new purchase
  create: async (data: {
    supplierId?: string;
    supplierName?: string;
    invoiceNumber?: string;
    notes?: string;
    tax?: number;
    items: Array<{
      ingredientId: string;
      quantity: number;
      unitCost: number;
    }>;
  }) => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      purchase: Purchase;
    }>('/purchases', data);
    return response.data;
  },

  // Receive a purchase (update status and inventory)
  receivePurchase: async (id: string) => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      purchase: Purchase;
    }>(`/purchases/${id}/receive`);
    return response.data;
  },

  // Search suppliers by name
  searchSuppliers: async (query: string) => {
    const response = await apiClient.get<Supplier[]>(
      '/suppliers/search',
      { params: { q: query } }
    );
    return response.data;
  },

  // Create a new supplier
  createSupplier: async (data: { name: string; phone?: string; email?: string; address?: string }) => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      supplier: Supplier;
    }>('/suppliers', data);
    return response.data;
  },
};
