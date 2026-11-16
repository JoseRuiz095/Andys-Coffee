import React from 'react'
import { ProductImage } from '../../../shared/components/ProductImage'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { XIcon } from '../../../components/ui/XIcon'
import { ExtrasPicker } from './ExtrasPicker'
import { extrasUnitPrice } from '../utils/extras'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '../../../components/ui/dialog'
import type { MenuItem, SelectedExtra } from '../types/menu.types'
import { DRINK_TEMPERATURES, getTemperatureLabel, supportsTemperature, formatTemperature, variantLabelOf, salsaOf, proteinOf, type DrinkTemperatureChoice, type ChilaquilesSalsa, type ChilaquilesProtein } from '../utils/productFamilies'

interface ProductFamilyModalProps {
  family: { key: string; title: string; variants: MenuItem[] }
  onClose: () => void
  onAddToOrder?: (product: MenuItem, quantity: number, extras?: SelectedExtra[]) => void
}

export function ProductFamilyModal({ family, onClose, onAddToOrder }: ProductFamilyModalProps) {
  const isChilaquiles = family.key === 'Chilaquiles'
  const temperatureOptions = DRINK_TEMPERATURES.filter((temperature) =>
    family.variants.some((variant) => supportsTemperature(variant, temperature)),
  )

  const [selectedSalsa, setSelectedSalsa] = React.useState<ChilaquilesSalsa>(() =>
    family.variants[0] ? salsaOf(family.variants[0]) : 'roja',
  )
  const [selectedProtein, setSelectedProtein] = React.useState<ChilaquilesProtein>(() =>
    family.variants[0] ? proteinOf(family.variants[0]) : 'naturales',
  )
  const [selectedTemperature, setSelectedTemperature] = React.useState<DrinkTemperatureChoice>(() => {
    const firstVariant = family.variants[0]
    const initialTemperature = firstVariant?.temperature === 'HOT'
      ? 'caliente'
      : firstVariant?.temperature === 'COLD'
        ? 'frio'
        : getTemperatureLabel(firstVariant?.name ?? 'caliente')

    return temperatureOptions.includes(initialTemperature)
      ? initialTemperature
      : temperatureOptions[0] ?? 'caliente'
  })
  const [selectedSize, setSelectedSize] = React.useState<'REGULAR' | 'JUMBO'>('REGULAR')
  const [selectedVariantId, setSelectedVariantId] = React.useState<string>(family.variants[0]?.id ?? '')
  const [selectedExtras, setSelectedExtras] = React.useState<SelectedExtra[]>([])

  const visibleVariants = React.useMemo(() => {
    if (!family.variants.length) {
      return []
    }

    if (isChilaquiles) {
      return family.variants.filter(
        (variant) =>
          salsaOf(variant) === selectedSalsa &&
          proteinOf(variant) === selectedProtein,
      )
    }

    return family.variants.filter((variant) => supportsTemperature(variant, selectedTemperature))
  }, [family.variants, isChilaquiles, selectedProtein, selectedSalsa, selectedTemperature])

  const selectedVariant =
    visibleVariants.find((variant) => variant.id === selectedVariantId) ?? visibleVariants[0] ?? family.variants[0]
  const offeredExtras = selectedVariant?.extras ?? []
  // Only the extras the chosen variant offers (switching flavor may drop some).
  const chosenExtras = selectedExtras.filter((extra) => offeredExtras.some((offered) => offered.id === extra.extraId))
  const hasJumbo = selectedVariant?.jumboPrice !== null && selectedVariant?.jumboPrice !== undefined
  const effectiveSize: 'REGULAR' | 'JUMBO' = selectedSize === 'JUMBO' && hasJumbo ? 'JUMBO' : 'REGULAR'
  const basePrice = effectiveSize === 'JUMBO' ? selectedVariant?.jumboPrice : selectedVariant?.price
  const selectedPrice = basePrice === null || basePrice === undefined ? basePrice : basePrice + extrasUnitPrice(chosenExtras)

  const salsaOptions = (['verde', 'roja'] as ChilaquilesSalsa[]).filter((salsa) =>
    family.variants.some((variant) => salsaOf(variant) === salsa),
  )
  const proteinOptions = (['naturales', 'pollo', 'arrachera', 'huevo'] as ChilaquilesProtein[]).filter((protein) =>
    family.variants.some((variant) => proteinOf(variant) === protein),
  )

  const canConfirm = Boolean(selectedVariant) && selectedPrice !== null && selectedPrice !== undefined

  /**
   * Changing the temperature keeps what the cashier already chose: the same product if it is
   * served both ways, otherwise the same flavor in the other temperature. Only when that flavor
   * doesn't exist there does it fall back to the first option.
   */
  const handleTemperatureChange = (temperature: DrinkTemperatureChoice) => {
    setSelectedTemperature(temperature)
    if (selectedVariant && supportsTemperature(selectedVariant, temperature)) return
    const candidates = family.variants.filter((variant) => supportsTemperature(variant, temperature))
    const sameFlavor = selectedVariant
      ? candidates.find((variant) => variantLabelOf(variant) === variantLabelOf(selectedVariant))
      : undefined
    const next = sameFlavor ?? candidates[0]
    if (next) setSelectedVariantId(next.id)
  }

  const handleConfirm = () => {
    if (!selectedVariant || !canConfirm) return
    const isJumbo = !isChilaquiles && family.key === 'Latte' && effectiveSize === 'JUMBO'
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
      chosenExtras,
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
                <ProductImage src={selectedVariant?.imageUrl} alt={family.title} eager />
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
                      aria-pressed={selectedSalsa === salsa}
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
                      aria-pressed={selectedProtein === protein}
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
                    aria-pressed={selectedTemperature === temperature}
                    onClick={() => handleTemperatureChange(temperature)}
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
                    aria-pressed={selectedVariant?.id === variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className="min-w-[140px] rounded-xl border p-3 text-left"
                    style={{
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    }}
                  >
                    <div className="mb-2 h-16 overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
                      <ProductImage src={variant.imageUrl} alt={variant.name} eager />
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {variantLabelOf(variant)}
                    </div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {formatCurrency((effectiveSize === 'JUMBO' ? variant.jumboPrice ?? variant.price : variant.price))}
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
                  aria-pressed={effectiveSize === 'REGULAR'}
                  onClick={() => setSelectedSize('REGULAR')}
                  className="rounded-xl border px-3 py-2 text-sm font-medium"
                  style={{
                    borderColor: effectiveSize === 'REGULAR' ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: effectiveSize === 'REGULAR' ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Regular
                </button>
                <button
                  type="button"
                  aria-pressed={effectiveSize === 'JUMBO'}
                  disabled={selectedVariant?.jumboPrice === null || selectedVariant?.jumboPrice === undefined}
                  onClick={() => setSelectedSize('JUMBO')}
                  className="rounded-xl border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: effectiveSize === 'JUMBO' ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: effectiveSize === 'JUMBO' ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Jumbo
                </button>
              </div>
            </div>
          )}

          <ExtrasPicker extras={offeredExtras} value={chosenExtras} onChange={setSelectedExtras} />

          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                  Precio total
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                  {formatCurrency(selectedPrice ?? 0)}
                </p>
              </div>
              <div className="text-right text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <div>{selectedVariant?.name ?? 'Sin selección'}{effectiveSize === 'JUMBO' ? ' Jumbo' : ''}</div>
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
            disabled={!canConfirm}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-button-text)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Agregar al pedido
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
