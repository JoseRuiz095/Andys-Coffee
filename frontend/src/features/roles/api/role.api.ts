import { apiClient } from '../../../app/api'

export interface Permission {
  id: string
  name: string
  description?: string
}

export interface RoleData {
  id: string
  name: string
  description?: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
  _count: { users: number }
  permissions: Array<{ permission: Permission }>
}

export const RoleAPI = {
  async getAll(): Promise<RoleData[]> {
    const response = await apiClient.get('/roles')
    return response.data
  },

  async getById(id: string): Promise<RoleData> {
    const response = await apiClient.get(`/roles/${id}`)
    return response.data
  },

  async create(data: { name: string; description?: string }): Promise<{ success: boolean; message: string; role: RoleData }> {
    const response = await apiClient.post('/roles', data)
    return response.data
  },

  async update(id: string, data: { name?: string; description?: string }): Promise<{ success: boolean; message: string; role: RoleData }> {
    const response = await apiClient.patch(`/roles/${id}`, data)
    return response.data
  },

  async assignPermissions(id: string, permissionIds: string[]): Promise<{ success: boolean; message: string; role: RoleData }> {
    const response = await apiClient.patch(`/roles/${id}/permissions`, { permissionIds })
    return response.data
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/roles/${id}`)
    return response.data
  },
}

export const PermissionAPI = {
  async getAll(): Promise<Permission[]> {
    const response = await apiClient.get('/permissions')
    return response.data
  },
}
