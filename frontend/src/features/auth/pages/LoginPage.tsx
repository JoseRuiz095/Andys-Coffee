import { AuthLayout } from '../../../shared/layouts/AuthLayout'
import { LoginForm } from '../components/LoginForm'

export function LoginPage() {
  return (
    <AuthLayout
      title="Andy's Coffee"
      subtitle="Accede a las herramientas necesarias para la operacion diaria."
    >
      <LoginForm />
    </AuthLayout>
  )
}
