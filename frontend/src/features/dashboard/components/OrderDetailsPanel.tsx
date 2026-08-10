import { Skeleton } from '../../../shared/components/Skeleton'

interface OrderItem {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  image: string
}

interface OrderDetailsPanelProps {
  customerName?: string
  items?: OrderItem[]
  subtotal?: number
  tax?: number
  total?: number
  isLoading?: boolean
  onProcessTransaction?: () => void
}

export function OrderDetailsPanel({
  customerName,
  items,
  subtotal = 0,
  tax = 0,
  total = 0,
  isLoading = true,
  onProcessTransaction,
}: OrderDetailsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Customer Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="mb-3 h-5 w-32" />
          <Skeleton className="mb-4 h-8 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* Order Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="mb-4 h-5 w-28" />

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg bg-slate-50 p-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="mb-4 h-5 w-28" />

          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="my-2 border-t border-slate-200" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>

          <Skeleton className="mt-4 h-10 w-full rounded-lg bg-blue-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Customer Info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-900">Customer Information</h3>
        <input
          type="text"
          placeholder="Customer Name"
          value={customerName || ''}
          className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder-slate-500"
        />
        <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700">
          <option>Select Table</option>
          <option>Table 1</option>
          <option>Table 2</option>
          <option>Table 3</option>
        </select>
      </div>

      {/* Order Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Order Details</h3>

        {items && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-lg bg-slate-50 p-3">
                <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-200">
                  <img
                    src={item.image}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{item.productName}</div>
                  <div className="text-xs text-slate-500">
                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  ${(item.quantity * item.unitPrice).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">No items added yet</div>
        )}
      </div>

      {/* Order Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Order Summary</h3>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Tax (10%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="my-3 border-t border-slate-200" />
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={onProcessTransaction}
          className="mt-4 w-full rounded-lg bg-blue-500 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          disabled={!items || items.length === 0}
        >
          Process Transaction
        </button>
      </div>
    </div>
  )
}
