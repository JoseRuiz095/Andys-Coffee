import { apiClient } from '../../../app/api'

export interface UserData {
  id: string
  name: string
  email: string
  isActive: boolean
  roleId: string
  role: {
    id: string
    name: string
    permissions?: Array<{ permission: { id: string; name: string; description?: string } }>
  }
  createdAt: string
  updatedAt: string
}

export interface PaginatedUsers {
  data: UserData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export const UserAPI = {
  async getAll(params: { page?: number; limit?: number; search?: string; isActive?: boolean; roleId?: string } = {}): Promise<PaginatedUsers> {
    const response = await apiClient.get('/users', { params })
    return response.data
  },

  async getById(id: string): Promise<UserData> {
    const response = await apiClient.get(`/users/${id}`)
    return response.data
  },

  async create(data: { name: string; email: string; password: string; roleId: string }): Promise<{ success: boolean; message: string; user: UserData }> {
    const response = await apiClient.post('/users', data)
    return response.data
  },

  async update(id: string, data: { name?: string; email?: string; roleId?: string }): Promise<{ success: boolean; message: string; user: UserData }> {
    const response = await apiClient.patch(`/users/${id}`, data)
    return response.data
  },

  async setActive(id: string, isActive: boolean): Promise<{ success: boolean; message: string; user: UserData }> {
    const response = await apiClient.patch(`/users/${id}/active`, { isActive })
    return response.data
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/users/${id}`)
    return response.data
  },
}
