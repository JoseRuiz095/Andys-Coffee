import { apiClient } from '../../../app/api'
import type { Extra, ExtraInput } from '../types/extra.types'

export const ExtraAPI = {
  async getAll() {
    const { data } = await apiClient.get<Extra[]>('/extras')
    return data
  },

  async create(input: ExtraInput) {
    const { data } = await apiClient.post<Extra>('/extras', input)
    return data
  },

  async update(id: string, input: Partial<ExtraInput>) {
    const { data } = await apiClient.patch<Extra>(`/extras/${id}`, input)
    return data
  },

  async setActive(id: string, isActive: boolean) {
    const { data } = await apiClient.patch<Extra>(`/extras/${id}/active`, { isActive })
    return data
  },

  async delete(id: string) {
    await apiClient.delete(`/extras/${id}`)
  },

  /** Replaces the extras the POS offers with a product. */
  async setProductExtras(productId: string, extraIds: string[]) {
    await apiClient.patch(`/products/${productId}/extras`, { extraIds })
  },
}
