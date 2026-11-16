import { useState } from 'react'
import { login } from '../services/auth.service'
import { authStore } from '../store/auth.store'
import type { LoginCredentials } from '../types/auth.types'
import { loginSchema } from '../validators/login.schema'

import { navigateTo } from '../../../app/navigation'

// replace: Back from the dashboard must not return to the login form.
const redirectToDashboard = () => navigateTo('/dashboard', { replace: true })

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
      authStore.setSession(result.user)
      redirectToDashboard()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo iniciar sesión')
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
