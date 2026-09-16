import { apiClient } from '../../../app/api'

export interface SystemPreference {
  key: string
  value: string | number | boolean | object
  type: 'string' | 'number' | 'boolean' | 'json'
}

const BASE_URL = '/preferences'

export const PreferencesAPI = {
  async getAll() {
    try {
      const { data } = await apiClient.get<SystemPreference[]>(BASE_URL)
      return data
    } catch (error) {
      return []
    }
  },

  async get(key: string) {
    const { data } = await apiClient.get<SystemPreference>(`${BASE_URL}/${key}`)
    return data
  },

  async set(key: string, value: string | number | boolean | object) {
    const { data } = await apiClient.patch<SystemPreference>(`${BASE_URL}/${key}`, { value })
    return data
  },

  async delete(key: string) {
    await apiClient.delete(`${BASE_URL}/${key}`)
  },
}
