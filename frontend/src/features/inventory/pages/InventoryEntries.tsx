import { useState, useMemo } from 'react'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useDraftPurchases, useReceivePurchase, usePurchaseById, useDeletePurchase } from '../hooks/usePurchases'
import { getErrorMessage } from '../../../shared/utils/errors'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { PermissionNotice } from '../../../shared/components/PermissionNotice'
import { PageHeader } from '../../../shared/components/PageHeader'
import { navigateTo } from '../../../app/navigation'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'

export function InventoryEntries() {
  const user = useCurrentUser()
  const canReceive = user?.permissions?.includes('inventory.create_entry') ?? false

  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [isConfirmingReceive, setIsConfirmingReceive] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [searchSupplier, setSearchSupplier] = useState('')

  const { data: purchases, isLoading: isLoadingPurchases, error: purchasesError, refetch: refetchPurchases } = useDraftPurchases()
  const { data: selectedPurchase, isLoading: isLoadingDetail } = usePurchaseById(selectedPurchaseId || '')
  const { mutate: receivePurchase, isPending: isReceiving } = useReceivePurchase()
  const { mutate: deletePurchase, isPending: isDeleting } = useDeletePurchase()

  // A pending "Confirmar" belongs to the purchase it was armed for: picking another one disarms it.
  const selectPurchase = (purchaseId: string) => {
    if (isReceiving || isDeleting || purchaseId === selectedPurchaseId) return
    setIsConfirmingReceive(false)
    setIsConfirmingDelete(false)
    setSelectedPurchaseId(purchaseId)
  }

  const handleReceivePurchase = () => {
    if (!selectedPurchaseId) return

    receivePurchase(selectedPurchaseId, {
      onSuccess: () => {
        setIsConfirmingReceive(false)
        setSelectedPurchaseId(null)
        sileo.success({ title: 'Compra recibida correctamente.', duration: 3000 })
      },
      onError: (error) => {
        sileo.error({
          title: 'Error al recibir la compra',
          description: getErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const handleDeletePurchase = () => {
    if (!selectedPurchaseId) return

    deletePurchase(selectedPurchaseId, {
      onSuccess: () => {
        setIsConfirmingDelete(false)
        setSelectedPurchaseId(null)
        sileo.success({ title: 'Compra cancelada correctamente.', duration: 3000 })
      },
      onError: (error) => {
        setIsConfirmingDelete(false)
        sileo.error({
          title: 'Error al cancelar la compra',
          description: getErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const draftPurchases = useMemo(() => purchases?.data ?? [], [purchases])

  // Filtrar compras por nombre de proveedor
  const filteredPurchases = useMemo(
    () => {
      if (!searchSupplier.trim()) {
        // Si no hay búsqueda, mostrar todas las compras (incluyendo sin proveedor)
        return draftPurchases;
      }
      // Si hay búsqueda, filtrar por nombre de proveedor o número de factura
      const search = searchSupplier.toLowerCase();
      return draftPurchases.filter(p =>
        (p.supplier?.name?.toLowerCase().includes(search)) ||
        (p.invoiceNumber?.toLowerCase().includes(search)) ||
        ('sin proveedor'.includes(search) && !p.supplier)
      );
    },
    [draftPurchases, searchSupplier]
  )

  return (
    <div
     
    >
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Compras por recibir"
          description={
            draftPurchases.length > 0
              ? `${draftPurchases.length} compra(s) por recibir · ${formatCurrency(draftPurchases.reduce((sum, p) => sum + Number(p.total), 0))} · ${draftPurchases.reduce((sum, p) => sum + p.items.length, 0)} items`
              : 'Recibe las compras para sumar su mercancía al inventario.'
          }
          actions={
            canReceive && (
              <button
                type="button"
                onClick={() => navigateTo('/dashboard?view=inventario&inv=add-entry')}
                className="min-h-10 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-button-text)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                + Nueva compra
              </button>
            )
          }
        />

        {!canReceive && <PermissionNotice action="recibir ni cancelar compras" />}

        {purchasesError && (
          <QueryErrorState error={purchasesError} subject="las compras por recibir" onRetry={() => void refetchPurchases()} />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
          {/* Lista de compras pendientes */}
          <div
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <h2 className="mb-4 font-semibold text-[var(--color-text-primary)]">
              Compras pendientes ({filteredPurchases.length})
            </h2>

            {/* Búsqueda */}
            <input
              type="text"
              placeholder="Buscar por proveedor o factura..."
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              className="mb-4 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />

            {isLoadingPurchases ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : filteredPurchases.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {draftPurchases.length === 0 ? 'No hay compras pendientes' : 'No hay coincidencias'}
              </p>
            ) : (
              <div className="space-y-2">
                                  {filteredPurchases.map((purchase) => (
                    <button
                      key={purchase.id}
                      onClick={() => selectPurchase(purchase.id)}
                      className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                        selectedPurchaseId === purchase.id
                          ? 'border-[var(--color-primary)] bg-[var(--color-surface-secondary)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border)]'
                      }`}
                    >
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {purchase.supplier?.name || 'Proveedor sin nombre'}
                      </p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {purchase.items.length} items • {formatCurrency(Number(purchase.total))}
                      </p>
                      {purchase.invoiceNumber && (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          Factura: {purchase.invoiceNumber}
                        </p>
                      )}
                    </button>
                  ))}
                              </div>
            )}
          </div>

          {/* Detalle de compra seleccionada */}
                      {selectedPurchaseId && !isLoadingDetail && selectedPurchase ? (
              <div
                key="detail"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
              >
                {/* Resumen rápido - PRIMERO */}
                <div
                  className="mb-6 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase text-[var(--color-text-secondary)]">Factura</p>
                      <p className="text-lg font-bold text-[var(--color-text-primary)]">
                        {selectedPurchase.invoiceNumber || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-[var(--color-text-secondary)]">Total</p>
                      <p className="text-lg font-bold text-[var(--color-success)]">
                        {formatCurrency(Number(selectedPurchase.total))}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs uppercase text-[var(--color-text-secondary)]">Proveedor</p>
                      <p className="text-base font-medium text-[var(--color-text-primary)]">
                        {selectedPurchase.supplier?.name || 'Sin proveedor especificado'}
                      </p>
                      {selectedPurchase.supplier?.email && (
                        <p className="text-xs text-[var(--color-text-secondary)]">{selectedPurchase.supplier.email}</p>
                      )}
                    </div>
                  </div>
                </div>

                <h2 className="mb-4 font-semibold text-[var(--color-text-primary)]">Cambios de inventario</h2>

                {/* Advertencia de cambios */}
                <div
                  className="mb-6 rounded-lg border-l-4 border-[var(--color-info)] bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] p-4"
                >
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Se actualizarán {selectedPurchase.items.length} ingrediente(s)
                  </p>
                  <ul className="mt-2 space-y-1">
                    {selectedPurchase.items.map((item) => (
                      <li key={item.id} className="text-sm text-[var(--color-text-primary)]">
                        + {Number(item.quantity).toFixed(2)} {item.ingredient.unit.abbreviation} de{' '}
                        <strong>{item.ingredient.name}</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Items table */}
                <div
                  className="mb-4 overflow-x-auto"
                >
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="px-2 py-2 text-left font-semibold text-[var(--color-text-primary)]">
                          Ingrediente
                        </th>
                        <th className="px-2 py-2 text-right font-semibold text-[var(--color-text-primary)]">
                          Cantidad
                        </th>
                        <th className="px-2 py-2 text-right font-semibold text-[var(--color-text-primary)]">
                          Costo unitario
                        </th>
                        <th className="px-2 py-2 text-right font-semibold text-[var(--color-text-primary)]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                                              {selectedPurchase.items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-[var(--color-border)]"
                          >
                            <td className="px-2 py-3">
                              <p className="font-medium text-[var(--color-text-primary)]">{item.ingredient.name}</p>
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                {item.ingredient.sku || '—'}
                              </p>
                            </td>
                            <td className="px-2 py-3 text-right text-[var(--color-text-secondary)]">
                              {Number(item.quantity).toFixed(2)} {item.ingredient.unit.abbreviation}
                            </td>
                            <td className="px-2 py-3 text-right text-[var(--color-text-secondary)]">
                              {formatCurrency(Number(item.unitCost))}
                            </td>
                            <td className="px-2 py-3 text-right font-medium text-[var(--color-text-primary)]">
                              {formatCurrency((Number(item.quantity) * Number(item.unitCost)))}
                            </td>
                          </tr>
                        ))}
                                          </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div
                  className="mb-6 space-y-2 rounded-lg bg-[var(--color-surface-hover)] p-3"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Subtotal:</span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {formatCurrency(Number(selectedPurchase.subtotal))}
                    </span>
                  </div>
                  {selectedPurchase.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">IVA:</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {formatCurrency(Number(selectedPurchase.tax))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[var(--color-border)] pt-2 font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(Number(selectedPurchase.total))}</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedPurchase.notes && (
                  <div
                    className="mb-6 rounded-lg bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] p-3"
                  >
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      <span className="font-medium">Notas:</span> {selectedPurchase.notes}
                    </p>
                  </div>
                )}

                {/* Receive / Cancel buttons (confirmed in dialogs below) */}
                {canReceive && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingReceive(true)}
                      disabled={isReceiving || isDeleting}
                      className="flex-1 rounded-lg bg-[var(--color-success)] px-4 py-2 font-medium text-[var(--color-button-text)] transition-colors hover:bg-[var(--color-success-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isReceiving ? 'Recibiendo...' : 'Recibir compra'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      disabled={isReceiving || isDeleting}
                      className="flex-1 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] px-4 py-2 font-medium text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancelar compra
                    </button>
                  </div>
                )}
                <ConfirmDialog
                  isOpen={isConfirmingReceive}
                  title="¿Recibir esta compra?"
                  message="Esto actualizará el inventario con los items de esta compra."
                  confirmText="Confirmar"
                  isLoading={isReceiving}
                  onConfirm={handleReceivePurchase}
                  onCancel={() => setIsConfirmingReceive(false)}
                />
                <ConfirmDialog
                  isOpen={isConfirmingDelete}
                  title="¿Eliminar esta compra en borrador?"
                  message="Esta acción es irreversible y no afecta al inventario, porque aún no ha sido recibida."
                  confirmText="Confirmar eliminación"
                  isDangerous
                  isLoading={isDeleting}
                  onConfirm={handleDeletePurchase}
                  onCancel={() => setIsConfirmingDelete(false)}
                />
              </div>
            ) : selectedPurchaseId && isLoadingDetail ? (
              <div
                key="loading"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
              >
                <h2 className="mb-4 font-semibold text-[var(--color-text-primary)]">Cargando detalles...</h2>
                <div className="space-y-4">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-12" />
                </div>
              </div>
            ) : (
              <div
                key="empty"
                className="flex min-h-96 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center"
              >
                <p className="text-[var(--color-text-secondary)]">Selecciona una compra para ver detalles</p>
              </div>
            )}
                  </div>

      </div>
    </div>
  )
}
