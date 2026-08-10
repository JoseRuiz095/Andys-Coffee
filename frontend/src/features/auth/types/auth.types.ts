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
}

export type LoginResult = {
  token: string
  user: AuthUser
}
