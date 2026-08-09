import type { FormEvent } from "react";
import { useTheme } from "../../../shared/assets/theme";
import { Input } from "../../../shared/components/Input";
import { Spinner } from "../../../shared/components/Spinner";
import { useLogin } from "../hooks/useLogin";
import type { LoginCredentials } from "../types/auth.types";

export function LoginForm() {
  const { colors } = useTheme()
  const { error, isSubmitting, showPassword, submit, togglePassword } =
    useLogin();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const credentials: LoginCredentials = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      rememberMe: formData.get("rememberMe") === "on",
    };

    void submit(credentials);
  }

  return (
    <div
      className="relative z-10 mx-auto flex w-full max-w-md min-w-0 flex-col justify-center px-10 py-10 lg:px-12 lg:py-12"
      style={{ backgroundColor: colors.panelRightBg }}
    >
      <div className="mb-7 min-w-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em]" style={{ color: colors.accent }}>
          Matcha & Latte
        </p>
        <h1 className="text-3xl font-semibold leading-tight lg:text-4xl" style={{ color: colors.text }}>
          Inicia sesión en tu espacio
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: colors.textMuted }}>
          Accede rápidamente al panel de operación, ventas y control de inventario.
        </p>
      </div>

      <form className="grid min-w-0 gap-4" onSubmit={handleSubmit}>
        <label className="grid min-w-0 gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: colors.textMuted }}>
            Correo electrónico
          </span>
          <Input
            type="email"
            name="email"
            defaultValue="ejemplo@gmail.com"
            autoComplete="email"
            placeholder="ejemplo@gmail.com"
            className="w-full rounded-3xl border px-4 py-3 text-sm"
            style={{
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              outline: 'none',
            }}
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: colors.textMuted }}>
            Contraseña
          </span>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              name="password"
              defaultValue="password123"
              autoComplete="current-password"
              className="w-full rounded-3xl border px-4 py-3 pr-12 text-sm"
              style={{
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={togglePassword}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold"
              style={{ color: colors.textMuted }}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex items-center gap-2 text-sm" style={{ color: colors.textMuted }}>
            <input
              type="checkbox"
              name="rememberMe"
              defaultChecked
              className="h-4 w-4 rounded"
              style={{
                accentColor: colors.primary,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
              }}
            />
            Recordarme
          </label>
          <a href="#" className="font-semibold hover:underline" style={{ color: colors.accent }}>
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        {error && (
          <p className="rounded-3xl bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-3xl py-3 text-sm font-bold transition-transform duration-200 ease-out active:scale-[0.98]"
          style={{
            backgroundColor: colors.primary,
            color: colors.buttonText,
            boxShadow: `0 16px 32px -16px ${colors.primary}40`,
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Spinner /> : 'Iniciar sesión'}
        </button>
      </form>

      <div className="mt-7 flex items-center justify-center gap-3 text-sm" style={{ color: colors.textMuted }}>
        <span className="h-px flex-1 rounded-full" style={{ backgroundColor: colors.border }}></span>
        <span className="font-medium">o</span>
        <span className="h-px flex-1 rounded-full" style={{ backgroundColor: colors.border }}></span>
      </div>

      <button
        type="button"
        className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full border px-5 py-3 text-sm font-semibold transition-shadow"
        style={{
          color: colors.text,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          boxShadow: '0 8px 20px -12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F2EFE8] text-xs font-bold text-[#5A804F]">
          G
        </span>
        Iniciar sesión con Google
      </button>
    </div>
  );
}
