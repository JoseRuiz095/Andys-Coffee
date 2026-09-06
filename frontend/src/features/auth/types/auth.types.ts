export type LoginCredentials = {
  email: string
  password: string
  rememberMe: boolean
}

export type AuthUser = {
  id: string
  email: string
  name: string
  roleId: string
  roleName?: string
  isActive: boolean
  permissions?: string[]
}

export type LoginResult = {
  user: AuthUser
}

export const _ = {};
