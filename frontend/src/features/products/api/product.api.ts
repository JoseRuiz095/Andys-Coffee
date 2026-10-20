import { apiClient } from '../../../app/api'
import type { Product, CreateProductInput, UpdateProductInput, Category, ProductDetail, CreateCategoryInput, ProductImageUploadResult } from '../types/product.types'

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
    const { data } = await apiClient.get<ProductDetail>(`${BASE_URL}/${id}`)
    return data
  },

  async create(input: CreateProductInput) {
    const { data } = await apiClient.post<Product>(BASE_URL, input)
    return data
  },

  async update(input: UpdateProductInput) {
    const { id, ...payload } = input
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

  /** Uploads a photo; the server validates it, converts it to WebP and replaces the current one. */
  async uploadImage(id: string, file: File) {
    const form = new FormData()
    form.append('image', file)
    const { data } = await apiClient.patch<ProductImageUploadResult>(`${BASE_URL}/${id}/image`, form)
    return data
  },

  async removeImage(id: string) {
    await apiClient.delete(`${BASE_URL}/${id}/image`)
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

  async create(input: CreateCategoryInput) {
    const { data } = await apiClient.post<Category>('/categories', input)
    return data
  },

  async update(id: string, input: Partial<CreateCategoryInput>) {
    const { data } = await apiClient.patch<Category>(`/categories/${id}`, input)
    return data
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<Category>(`/categories/${id}/active`, { isActive })
    return data
  },

  async delete(id: string) {
    await apiClient.delete(`/categories/${id}`)
  },
}
