import { AuthLayout } from '../../../shared/layouts/AuthLayout'
import { LoginForm } from '../components/LoginForm'
import { useGeneralPreferencesContext } from '../../../shared/contexts/GeneralPreferencesContext'

export function LoginPage() {
  const { preferences } = useGeneralPreferencesContext()

  return (
    <AuthLayout
      title={preferences?.businessName || "Andy's Coffee"}
      subtitle="Accede a las herramientas necesarias para la operacion diaria."
    >
      <LoginForm />
    </AuthLayout>
  )
}
