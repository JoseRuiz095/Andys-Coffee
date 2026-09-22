import { apiClient } from '../../../app/api'
import type { Product, CreateProductInput, UpdateProductInput, Category } from '../types/product.types'

const BASE_URL = '/products'

export const ProductAPI = {
  // Products
  async getAll(
    page = 1,
    limit = 50,
    filters?: { categoryId?: string; isActive?: boolean; search?: string }
  ) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filters?.categoryId) params.set('category', filters.categoryId)
    if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive))
    if (filters?.search) params.set('search', filters.search)
    const { data } = await apiClient.get<{
      data: Product[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`${BASE_URL}?${params.toString()}`)
    return data
  },

  async getById(id: string) {
    const { data } = await apiClient.get<Product>(`${BASE_URL}/${id}`)
    return data
  },

  async create(input: CreateProductInput, imageFile?: File) {
    if (imageFile) {
      const fd = new FormData()
      Object.entries(input).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, String(v))
      })
      fd.append('image', imageFile)
      const { data } = await apiClient.post<Product>(BASE_URL, fd)
      return data
    }
    const { data } = await apiClient.post<Product>(BASE_URL, input)
    return data
  },

  async update(input: UpdateProductInput, imageFile?: File) {
    const { id, ...payload } = input
    if (imageFile) {
      const fd = new FormData()
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, String(v))
      })
      fd.append('image', imageFile)
      const { data } = await apiClient.patch<Product>(`${BASE_URL}/${id}`, fd)
      return data
    }
    const { data } = await apiClient.patch<Product>(`${BASE_URL}/${id}`, payload)
    return data
  },

  async delete(id: string) {
    await apiClient.delete(`${BASE_URL}/${id}`)
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<Product>(`${BASE_URL}/${id}/active`, { isActive })
    return data
  },
}

export const CategoryAPI = {
  async getAll(page = 1, limit = 100, includeInactive = false) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (includeInactive) params.set('includeInactive', 'true')
    const { data } = await apiClient.get<{ categories: Category[]; total: number }>(
      `/categories?${params.toString()}`
    )
    return data
  },

  async create(input: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data } = await apiClient.post<Category>('/categories', input)
    return data
  },

  async update(id: string, input: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>) {
    const { data } = await apiClient.patch<Category>(`/categories/${id}`, input)
    return data
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<Category>(`/categories/${id}/active`, { isActive })
    return data
  },
}
