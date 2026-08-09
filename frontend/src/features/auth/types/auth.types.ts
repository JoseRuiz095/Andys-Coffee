export type LoginCredentials = {
  email: string
  password: string
  rememberMe: boolean
}

export type AuthUser = {
  email: string
  name: string
}

export type LoginResult = {
  token: string
  user: AuthUser
}
