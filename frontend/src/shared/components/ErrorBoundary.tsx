import React, { ReactNode } from 'react'
import { isChunkLoadError } from '../utils/lazyWithReload'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            className="rounded-lg p-6"
            style={{
              border: '1px solid var(--color-danger)',
              backgroundColor: `color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))`,
            }}
          >
            <h2
              className="text-lg font-semibold"
              style={{ color: 'var(--color-danger)' }}
            >
              Algo salió mal
            </h2>
            <p
              className="mt-2 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {isChunkLoadError(this.state.error)
                ? 'Hay una versión nueva de la aplicación. Recarga la página para continuar.'
                : 'Ocurrió un error inesperado al mostrar esta sección. Tus datos no se perdieron.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90"
                style={{ backgroundColor: 'var(--color-danger)', color: 'var(--color-button-text)' }}
              >
                Reintentar
              </button>
              {/* A view whose code failed to load stays failed until the page is reloaded. */}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-90"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                Recargar página
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
