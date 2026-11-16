import React from 'react'
import { ProductImage } from '../../../shared/components/ProductImage'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { XIcon } from '../../../components/ui/XIcon'
import { Button } from '../../../shared/components/Button'
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

// Touch-sized choice buttons (44px on touch screens); the chosen one is tinted with the brand color.
const choiceClassName =
  'min-h-10 rounded-xl border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11'

const choiceStyle = (isSelected: boolean) => ({
  borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
  backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))' : 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  // Inline: index.css `button { font: inherit }` overrides font utilities on buttons.
  fontSize: '0.875rem',
  fontWeight: isSelected ? 600 : 500,
})

const sectionTitleClassName = 'mb-2 text-xs font-semibold uppercase tracking-wide'

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
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()} size="xl">
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--color-image-tile)' }}>
                <ProductImage src={selectedVariant?.imageUrl} alt={family.title} eager fit="contain" />
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
              className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors pointer-coarse:h-11 pointer-coarse:w-11"
              style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
            >
              <XIcon size={18} />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isChilaquiles ? (
            <>
              <div>
                <h3 className={sectionTitleClassName} style={{ color: 'var(--color-text-secondary)' }}>
                  Salsa
                </h3>
                <div className="flex gap-2">
                  {salsaOptions.map((salsa) => (
                    <button
                      key={salsa}
                      type="button"
                      aria-pressed={selectedSalsa === salsa}
                      onClick={() => setSelectedSalsa(salsa)}
                      className={`flex-1 ${choiceClassName}`}
                      style={choiceStyle(selectedSalsa === salsa)}
                    >
                      {salsa === 'verde' ? 'Verde' : 'Roja'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className={sectionTitleClassName} style={{ color: 'var(--color-text-secondary)' }}>
                  Proteína
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {proteinOptions.map((protein) => (
                    <button
                      key={protein}
                      type="button"
                      aria-pressed={selectedProtein === protein}
                      onClick={() => setSelectedProtein(protein)}
                      className={choiceClassName}
                      style={choiceStyle(selectedProtein === protein)}
                    >
                      {protein[0].toUpperCase() + protein.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : temperatureOptions.length > 0 && (
            <div>
              <h3 className={sectionTitleClassName} style={{ color: 'var(--color-text-secondary)' }}>
                Temperatura
              </h3>
              <div className="flex gap-2">
                {temperatureOptions.map((temperature) => (
                  <button
                    key={temperature}
                    type="button"
                    aria-pressed={selectedTemperature === temperature}
                    onClick={() => handleTemperatureChange(temperature)}
                    className={`flex-1 ${choiceClassName}`}
                    style={choiceStyle(selectedTemperature === temperature)}
                  >
                    {formatTemperature(temperature)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isChilaquiles && <div>
            <h3 className={sectionTitleClassName} style={{ color: 'var(--color-text-secondary)' }}>
              Sabor
            </h3>
            {/* A grid, not a horizontal strip: every flavor is in view without scrolling sideways. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visibleVariants.map((variant) => {
                const isSelected = selectedVariant?.id === variant.id

                return (
                  <button
                    key={variant.id}
                    type="button"
                    aria-pressed={selectedVariant?.id === variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className="flex min-h-14 items-center gap-2 rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)]"
                    style={choiceStyle(isSelected)}
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--color-image-tile)' }}>
                      <ProductImage src={variant.imageUrl} alt={variant.name} eager fit="contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm leading-5" style={{ color: 'var(--color-text-primary)' }}>
                        {variantLabelOf(variant)}
                      </div>
                      <div className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                        {formatCurrency((effectiveSize === 'JUMBO' ? variant.jumboPrice ?? variant.price : variant.price))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>}

          {!isChilaquiles && family.key === 'Latte' && (
            <div>
              <h3 className={sectionTitleClassName} style={{ color: 'var(--color-text-secondary)' }}>
                Tamaño
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={effectiveSize === 'REGULAR'}
                  onClick={() => setSelectedSize('REGULAR')}
                  className={choiceClassName}
                  style={choiceStyle(effectiveSize === 'REGULAR')}
                >
                  Regular
                </button>
                <button
                  type="button"
                  aria-pressed={effectiveSize === 'JUMBO'}
                  disabled={selectedVariant?.jumboPrice === null || selectedVariant?.jumboPrice === undefined}
                  onClick={() => setSelectedSize('JUMBO')}
                  className={choiceClassName}
                  style={choiceStyle(effectiveSize === 'JUMBO')}
                >
                  Jumbo
                </button>
              </div>
            </div>
          )}

          <ExtrasPicker extras={offeredExtras} value={chosenExtras} onChange={setSelectedExtras} />

          <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                  Precio total
                </p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
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

        {/* Always in view, even when many flavors and extras make the dialog scroll. */}
        <DialogFooter sticky>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>Agregar al pedido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
