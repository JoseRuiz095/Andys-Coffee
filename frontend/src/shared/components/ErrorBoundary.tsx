import React, { ReactNode } from 'react'

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
              {this.state.error?.message || 'Ocurrió un error inesperado'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition"
              style={{ backgroundColor: 'var(--color-danger)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-danger-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-danger)'
              }}
            >
              Reintentar
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
