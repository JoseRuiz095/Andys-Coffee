interface OrdersHeaderProps {
  pendingOrders: number
}

export function OrdersHeader({ pendingOrders }: OrdersHeaderProps) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-3xl font-bold text-[#2C211D]">Órdenes entrantes</h1>
      <p className="text-base text-[#6B7280]">
        Tienes {pendingOrders} órden{pendingOrders === 1 ? '' : 'es'} pendiente{pendingOrders === 1 ? '' : 's'}.
      </p>
    </div>
  )
}
