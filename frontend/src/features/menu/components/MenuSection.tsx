import React from 'react'
import { Skeleton } from '../../../shared/components/Skeleton'
import type { MenuCategory, MenuItem } from '../types/menu.types'
import { getSupabaseImageUrl } from '../../../shared/utils/imageUtils'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '../../../components/ui/dialog'
import { XIcon } from '../../../components/ui/XIcon'

type DisplayProduct =
  | { kind: 'single'; product: MenuItem }
  | { kind: 'group'; key: string; title: string; variants: MenuItem[] }

const BEVERAGE_FAMILIES = [
  'latte',
  'americano',
  'espresso',
  'cappuccino',
  'matcha',
  'mocha',
  'chai',
  'taro',
  'chilaquiles',
] as const

const REFRESHER_NAMES = new Set(['bloom', 'limonada'])

const normalizeProductName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const getDrinkFamily = (name: string): string | null => {
  const normalized = normalizeProductName(name)
  if (!normalized) return null

  if (REFRESHER_NAMES.has(normalized)) {
    return 'Refreshers'
  }

  for (const family of BEVERAGE_FAMILIES) {
    if (normalized.startsWith(family)) {
      return family[0].toUpperCase() + family.slice(1)
    }
  }

  return null
}

const getTemperatureLabel = (name: string): 'caliente' | 'frio' => {
  const normalized = normalizeProductName(name)

  if (normalized.includes(' frio') || normalized.includes(' frio') || normalized.includes('iced') || normalized.includes('cold')) {
    return 'frio'
  }

  return 'caliente'
}

const getVariantLabel = (name: string) => {
  const normalized = name.replace(/^\s+|\s+$/g, '')
  const withoutBase = normalized
    .replace(/^(Latte|Americano|Espresso|Cappuccino|Matcha|Mocha|Chai|Taro|Chilaquiles)[\s-]+/i, '')
    .replace(/\s+(Frio|Frío|Iced|Cold|Caliente|Hot)$/i, '')
    .replace(/\s+(Regular|Classic|Clásico|Normal)$/i, '')

  const trimmed = withoutBase.trim()
  return trimmed || 'Variante'
}

const formatTemperature = (temperature: 'caliente' | 'frio') =>
  temperature === 'frio' ? 'Frío' : 'Caliente'

type ChilaquilesSalsa = 'verde' | 'roja'
type ChilaquilesProtein = 'naturales' | 'pollo' | 'arrachera' | 'huevo'

const getChilaquilesSalsa = (name: string): ChilaquilesSalsa =>
  normalizeProductName(name).includes(' verdes') ? 'verde' : 'roja'

const getChilaquilesProtein = (name: string): ChilaquilesProtein => {
  const normalized = normalizeProductName(name)

  if (normalized.includes(' pollo ')) return 'pollo'
  if (normalized.includes(' arrachera ')) return 'arrachera'
  if (normalized.includes(' huevo ')) return 'huevo'

  return 'naturales'
}

interface MenuSectionProps {
  menu?: MenuCategory[]
  categoryNames?: string[]
  isLoading?: boolean
  selectedCategory?: string
  onSelectCategory?: (category: string) => void
  onAddToOrder?: (product: MenuItem, quantity: number) => void
}

export function MenuSection({
  menu,
  categoryNames = ['Bebidas', 'Bagels', 'Desayunos', 'Promociones', 'Otros'],
  isLoading = true,
  selectedCategory,
  onSelectCategory,
  onAddToOrder,
}: MenuSectionProps) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [selectedFamily, setSelectedFamily] = React.useState<{
    key: string
    title: string
    variants: MenuItem[]
  } | null>(null)

  // Find the products for the selected category
  const productsToShow = React.useMemo(() => {
    if (!menu || !selectedCategory) {
      return []
    }
    return (menu.find((category) => category.name === selectedCategory)?.items ?? [])
      .filter((product) => normalizeProductName(product.name) !== 'latte jumbo')
  }, [menu, selectedCategory])

  const filteredProducts = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) {
      return productsToShow
    }

    return productsToShow.filter((product) =>
      product.name.toLowerCase().includes(term),
    )
  }, [productsToShow, searchTerm])

  const displayProducts = React.useMemo<DisplayProduct[]>(() => {
    const groupedProducts = new Map<string, MenuItem[]>()

    for (const product of filteredProducts) {
      const family = getDrinkFamily(product.name) ?? (product.temperature === 'BOTH' ? product.name : null)
      if (!family) {
        continue
      }

      const variants = groupedProducts.get(family) ?? []
      variants.push(product)
      groupedProducts.set(family, variants)
    }

    const usedFamilies = new Set<string>()
    const result: DisplayProduct[] = []

    for (const product of filteredProducts) {
      const family = getDrinkFamily(product.name) ?? (product.temperature === 'BOTH' ? product.name : null)

      if (!family) {
        result.push({ kind: 'single', product })
        continue
      }

      const variants = groupedProducts.get(family) ?? []
      if (variants.length <= 1 && product.temperature !== 'BOTH') {
        result.push({ kind: 'single', product })
        continue
      }

      if (usedFamilies.has(family)) {
        continue
      }

      usedFamilies.add(family)
      result.push({
        kind: 'group',
        key: family,
        title: family,
        variants: [...variants].sort((first, second) => first.price - second.price),
      })
    }

    return result
  }, [filteredProducts])

  const handleOpenFamilyModal = (item: { key: string; title: string; variants: MenuItem[] }) => {
    setSelectedFamily(item)
  }

  const closeFamilyModal = () => setSelectedFamily(null)

  if (isLoading) {
    return (
      <div
        className="space-y-4 rounded-[1.5rem] border p-6 shadow-[0_20px_50px_rgba(45,33,29,0.06)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="mb-6 flex justify-center gap-10 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
          {categoryNames.map((cat) => (
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
    <>
      <div
        className="space-y-4 rounded-[1.5rem] border p-6 shadow-[0_20px_50px_rgba(45,33,29,0.06)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="mb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex justify-center gap-4 overflow-x-auto pb-1">
            {categoryNames.map((cat) => (
              <button
                key={cat}
                onClick={() => onSelectCategory?.(cat)}
                className="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  borderColor: selectedCategory === cat ? 'var(--color-primary)' : 'transparent',
                  color: selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-text-primary)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="sticky top-0 z-10 rounded-xl border p-3 backdrop-blur" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar producto o bebida"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayProducts.length === 0 && !isLoading && (
            <div className="col-span-full py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              No hay productos en esta categoría.
            </div>
          )}
          {displayProducts.map((item) =>
            item.kind === 'single' ? (
              <ProductCard key={item.product.id} product={item.product} onAddToOrder={onAddToOrder} />
            ) : (
              <ProductFamilyCard key={item.key} title={item.title} variants={item.variants} onOpen={() => handleOpenFamilyModal(item)} />
            ),
          )}
        </div>
      </div>

      {selectedFamily && (
        <ProductFamilyModal
          family={selectedFamily}
          onClose={closeFamilyModal}
          onAddToOrder={onAddToOrder}
        />
      )}
    </>
  )
}

interface ProductFamilyCardProps {
  title: string
  variants: MenuItem[]
  onOpen?: () => void
}

function ProductFamilyCard({ title, variants, onOpen }: ProductFamilyCardProps) {
  const mainVariant = variants[0]
  const imageUrl = mainVariant.imageUrl ? getSupabaseImageUrl(mainVariant.imageUrl, 'Img', 'public') : undefined

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block overflow-hidden rounded-xl border text-left transition-shadow hover:shadow-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="relative h-32 overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
        {imageUrl && (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        )}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h4>
          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
            {variants.length} opciones
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>${mainVariant.price.toFixed(2)}</span>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Personalizar</span>
        </div>
      </div>
    </button>
  )
}

interface ProductFamilyModalProps {
  family: { key: string; title: string; variants: MenuItem[] }
  onClose: () => void
  onAddToOrder?: (product: MenuItem, quantity: number) => void
}

function ProductFamilyModal({ family, onClose, onAddToOrder }: ProductFamilyModalProps) {
  const isChilaquiles = family.key === 'Chilaquiles'
  const temperatures = React.useMemo(
    () => ['caliente', 'frio'] as const,
    [],
  )

  const [selectedSalsa, setSelectedSalsa] = React.useState<ChilaquilesSalsa>(() =>
    getChilaquilesSalsa(family.variants[0]?.name ?? 'rojos'),
  )
  const [selectedProtein, setSelectedProtein] = React.useState<ChilaquilesProtein>(() =>
    getChilaquilesProtein(family.variants[0]?.name ?? 'naturales'),
  )
  const [selectedTemperature, setSelectedTemperature] = React.useState<'caliente' | 'frio'>(() =>
    getTemperatureLabel(family.variants[0]?.name ?? 'caliente'),
  )
  const [selectedSize, setSelectedSize] = React.useState<'REGULAR' | 'JUMBO'>('REGULAR')
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>(family.variants[0]?.id ?? '')

  const visibleVariants = React.useMemo(() => {
    if (!family.variants.length) {
      return []
    }

    if (isChilaquiles) {
      return family.variants.filter(
        (variant) =>
          getChilaquilesSalsa(variant.name) === selectedSalsa &&
          getChilaquilesProtein(variant.name) === selectedProtein,
      )
    }

    const matching = family.variants.filter(
      (variant) =>
        variant.temperature === 'BOTH' ||
        (variant.temperature === 'HOT' && selectedTemperature === 'caliente') ||
        (variant.temperature === 'COLD' && selectedTemperature === 'frio') ||
        (!variant.temperature && getTemperatureLabel(variant.name) === selectedTemperature),
    )

    return matching.length > 0 ? matching : family.variants
  }, [family.variants, isChilaquiles, selectedProtein, selectedSalsa, selectedTemperature])

  const selectedVariant =
    visibleVariants.find((variant) => variant.id === selectedVariantId) ?? visibleVariants[0] ?? family.variants[0]
  const selectedPrice = selectedSize === 'JUMBO' ? selectedVariant?.jumboPrice : selectedVariant?.price

  React.useEffect(() => {
    if (selectedVariant && !visibleVariants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(selectedVariant.id)
    }
  }, [selectedVariant, selectedVariantId, visibleVariants])

  const temperatureOptions: Array<'caliente' | 'frio'> = temperatures.filter((temperature) =>
    family.variants.some((variant) =>
      variant.temperature === 'BOTH' ||
      (variant.temperature === 'HOT' && temperature === 'caliente') ||
      (variant.temperature === 'COLD' && temperature === 'frio') ||
      (!variant.temperature && getTemperatureLabel(variant.name) === temperature),
    ),
  )

  const salsaOptions = (['verde', 'roja'] as ChilaquilesSalsa[]).filter((salsa) =>
    family.variants.some((variant) => getChilaquilesSalsa(variant.name) === salsa),
  )
  const proteinOptions = (['naturales', 'pollo', 'arrachera', 'huevo'] as ChilaquilesProtein[]).filter((protein) =>
    family.variants.some((variant) => getChilaquilesProtein(variant.name) === protein),
  )

  const handleConfirm = () => {
    if (!selectedVariant) return
    const isJumbo = !isChilaquiles && family.key === 'Latte' && selectedSize === 'JUMBO'
    const price = isJumbo ? selectedVariant.jumboPrice : selectedVariant.price
    if (price === null || price === undefined) return

    onAddToOrder?.(
      {
        ...selectedVariant,
        name: isJumbo ? `${selectedVariant.name} Jumbo` : selectedVariant.name,
        price,
        size: isJumbo ? 'JUMBO' : undefined,
        temperature: isChilaquiles ? null : selectedTemperature === 'frio' ? 'COLD' : 'HOT',
      },
      1,
    )

    onClose()
  }

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--color-background)' }}>
                {selectedVariant?.imageUrl && (
                  <img
                    src={getSupabaseImageUrl(selectedVariant.imageUrl, 'Img', 'public') ?? undefined}
                    alt={family.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div>
                <DialogTitle>{family.title}</DialogTitle>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Personaliza tu bebida
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar personalización"
              title="Cerrar"
              className="rounded-lg p-2 transition-colors"
              style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
            >
              <XIcon size={18} />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {isChilaquiles ? (
            <>
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                  Salsa
                </h3>
                <div className="flex gap-2">
                  {salsaOptions.map((salsa) => (
                    <button
                      key={salsa}
                      type="button"
                      onClick={() => setSelectedSalsa(salsa)}
                      className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium"
                      style={{
                        borderColor: selectedSalsa === salsa ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: selectedSalsa === salsa ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {salsa === 'verde' ? 'Verde' : 'Roja'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                  Proteína
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {proteinOptions.map((protein) => (
                    <button
                      key={protein}
                      type="button"
                      onClick={() => setSelectedProtein(protein)}
                      className="rounded-xl border px-3 py-2 text-sm font-medium"
                      style={{
                        borderColor: selectedProtein === protein ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: selectedProtein === protein ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {protein[0].toUpperCase() + protein.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : temperatureOptions.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                Temperatura
              </h3>
              <div className="flex gap-2">
                {temperatureOptions.map((temperature) => (
                  <button
                    key={temperature}
                    type="button"
                    onClick={() => setSelectedTemperature(temperature)}
                    className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium"
                    style={{
                      borderColor: selectedTemperature === temperature ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: selectedTemperature === temperature ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {formatTemperature(temperature)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isChilaquiles && <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
              Sabor
            </h3>
            <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-1">
              {visibleVariants.map((variant) => {
                const isSelected = selectedVariant?.id === variant.id

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    className="min-w-[140px] rounded-xl border p-3 text-left"
                    style={{
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    }}
                  >
                    <div className="mb-2 h-16 overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
                      {variant.imageUrl && (
                        <img
                          src={getSupabaseImageUrl(variant.imageUrl, 'Img', 'public') ?? undefined}
                          alt={variant.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {getVariantLabel(variant.name)}
                    </div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                      ${(selectedSize === 'JUMBO' ? variant.jumboPrice ?? variant.price : variant.price).toFixed(2)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>}

          {!isChilaquiles && family.key === 'Latte' && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                Tamaño
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={selectedSize === 'REGULAR'}
                  onClick={() => setSelectedSize('REGULAR')}
                  className="rounded-xl border px-3 py-2 text-sm font-medium"
                  style={{
                    borderColor: selectedSize === 'REGULAR' ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: selectedSize === 'REGULAR' ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Regular
                </button>
                <button
                  type="button"
                  aria-pressed={selectedSize === 'JUMBO'}
                  disabled={selectedVariant?.jumboPrice === null || selectedVariant?.jumboPrice === undefined}
                  onClick={() => setSelectedSize('JUMBO')}
                  className="rounded-xl border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: selectedSize === 'JUMBO' ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: selectedSize === 'JUMBO' ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Jumbo
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                  Precio total
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                  ${selectedPrice?.toFixed(2) ?? '0.00'}
                </p>
              </div>
              <div className="text-right text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <div>{selectedVariant?.name ?? 'Sin selección'}{selectedSize === 'JUMBO' ? ' Jumbo' : ''}</div>
                {!isChilaquiles && (
                  <div>{selectedVariant ? formatTemperature(selectedTemperature) : 'Sin temperatura'}</div>
                )}
              </div>
            </div>
          </div>

        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Agregar al pedido
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ProductCardProps {
  product: MenuItem
  onAddToOrder?: (product: MenuItem, quantity: number) => void
}

function ProductCard({ product, onAddToOrder }: ProductCardProps) {
  const imageUrl = product.imageUrl
    ? getSupabaseImageUrl(product.imageUrl, 'Img', 'public')
    : undefined

  return (
    <button
      type="button"
      onClick={() => onAddToOrder?.(product, 1)}
      className="group block overflow-hidden rounded-xl border text-left transition-shadow hover:shadow-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="relative h-32 overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
        {imageUrl && (
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        )}
      </div>
      <div className="p-4">
        <h4 className="mb-1 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{product.name}</h4>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>${product.price.toFixed(2)}</span>
        </div>
      </div>
    </button>
  )
}
