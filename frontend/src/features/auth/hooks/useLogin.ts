import { useState } from 'react'
import { login } from '../services/auth.service'
import { authStore } from '../store/auth.store'
import type { LoginCredentials } from '../types/auth.types'
import { loginSchema } from '../validators/login.schema'

export function useLogin() {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function togglePassword() {
    setShowPassword((value) => !value)
  }

  async function submit(credentials: LoginCredentials) {
    const validationError = loginSchema.validate(credentials)

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const result = await login(credentials)
      authStore.setSession(result.token, result.user)
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    error,
    isSubmitting,
    showPassword,
    submit,
    togglePassword,
  }
}
