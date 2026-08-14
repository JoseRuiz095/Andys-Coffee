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
  categories = ['Bebidas', 'Bagels', 'Desayunos', 'Promociones', 'Otros'],
  isLoading = true,
  selectedCategory,
  onSelectCategory,
  onAddToOrder,
}: MenuSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-6 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
        <div className="mb-6 flex justify-center gap-10 border-b border-[#E7E3DC] pb-3" >
          {categories.map((cat) => (
            <Skeleton key={cat} className="h-10 w-24 rounded-lg" />
          ))}
        </div>

        {/* Products Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
              <Skeleton className="h-40 w-full" />
              <div className="p-3">
                <Skeleton className="mb-2 h-4 w-28" />
                <Skeleton className="mb-3 h-3 w-full" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-6 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
      <div className="mb-4 border-b border-[#E7E3DC]">
        <div className="flex justify-center gap-4 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory?.(cat)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'border-[#5A804F] text-[#5A804F]'
                : 'border-transparent text-[#4B5563] hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
        </div>
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
  return (
    <button
      onClick={() => onAddToOrder?.(product, 1)}
      className="group block overflow-hidden rounded-lg border border-[#E7E3DC] bg-white text-left transition-shadow hover:shadow-lg"
    >
      <div className="relative h-32 overflow-hidden bg-[#F2EFE8]">
        <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
      </div>
      <div className="p-4">
        <h4 className="mb-1 font-semibold text-[#2C211D]">{product.name}</h4>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold text-[#5A804F]">${product.price.toFixed(2)}</span>
        </div>
      </div>
    </button>
  )
}
