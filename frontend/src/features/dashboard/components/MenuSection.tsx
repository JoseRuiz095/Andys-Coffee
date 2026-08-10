import React from 'react'
import { Skeleton } from '../../../shared/components/Skeleton'

interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  available: number
  category: string
}

interface MenuSectionProps {
  products?: Product[]
  categories?: string[]
  isLoading?: boolean
  selectedCategory?: string
  onSelectCategory?: (category: string) => void
  onAddToOrder?: (product: Product, quantity: number) => void
}

export function MenuSection({
  products,
  categories = ['Appetizer', 'Main course', 'Dessert', 'Beverage'],
  isLoading = true,
  selectedCategory,
  onSelectCategory,
  onAddToOrder,
}: MenuSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Category Tabs */}
        <div className="mb-6 flex gap-4">
          {categories.map((cat) => (
            <Skeleton key={cat} className="h-10 w-24 rounded-lg" />
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
              <Skeleton className="h-40 w-full" />
              <div className="p-3">
                <Skeleton className="mb-2 h-4 w-28" />
                <Skeleton className="mb-3 h-3 w-full" />
                <div className="mb-3 flex items-center justify-between">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 flex-1 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg bg-blue-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Category Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory?.(cat)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {products?.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToOrder={onAddToOrder}
          />
        ))}
      </div>
    </div>
  )
}

interface ProductCardProps {
  product: Product
  onAddToOrder?: (product: Product, quantity: number) => void
}

function ProductCard({ product, onAddToOrder }: ProductCardProps) {
  const [quantity, setQuantity] = React.useState(0)

  const handleAdd = () => {
    setQuantity(quantity + 1)
    onAddToOrder?.(product, quantity + 1)
  }

  const handleRemove = () => {
    if (quantity > 0) {
      setQuantity(quantity - 1)
      onAddToOrder?.(product, quantity - 1)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 transition-shadow hover:shadow-md">
      <div className="relative h-40 overflow-hidden bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-3">
        <h4 className="mb-1 font-medium text-slate-900">{product.name}</h4>
        <p className="mb-3 line-clamp-2 text-xs text-slate-600">{product.description}</p>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-slate-900">${product.price.toFixed(2)}</span>
          <span className="text-xs text-slate-500">{product.available} Available</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRemove}
            disabled={quantity === 0}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            −
          </button>
          <input
            type="text"
            value={quantity}
            readOnly
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={product.available === 0}
            className="rounded-lg bg-blue-500 px-2 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

