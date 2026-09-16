interface OrdersHeaderProps {
  pendingOrders: number
}

export function OrdersHeader({ pendingOrders }: OrdersHeaderProps) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Órdenes entrantes</h1>
      <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
        Tienes {pendingOrders} órden{pendingOrders === 1 ? '' : 'es'} pendiente{pendingOrders === 1 ? '' : 's'}.
      </p>
    </div>
  )
}
