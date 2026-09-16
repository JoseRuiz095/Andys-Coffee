import { apiClient } from '../../../app/api'
import type { Product, CreateProductInput, UpdateProductInput, Category } from '../types/product.types'

const BASE_URL = '/products'

export const ProductAPI = {
  // Products
  async getAll(page = 1, limit = 50) {
    const { data } = await apiClient.get<{ products: Product[]; total: number }>(
      `${BASE_URL}?page=${page}&limit=${limit}`
    )
    return data
  },

  async getById(id: string) {
    const { data } = await apiClient.get<Product>(`${BASE_URL}/${id}`)
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
}

export const CategoryAPI = {
  async getAll(page = 1, limit = 100) {
    const { data } = await apiClient.get<{ categories: Category[]; total: number }>(
      '/categories?page=' + page + '&limit=' + limit
    )
    return data
  },
}
