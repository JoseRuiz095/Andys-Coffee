import { useState, useMemo } from 'react'
import { referenceUnitCost } from '../utils/purchaseLine'
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
import { FORM_FIELD_CLASS } from '../../../shared/constants/fieldStyles'
import { ACTION_DANGER_CLASS, ACTION_PRIMARY_CLASS, ACTION_SUCCESS_CLASS } from '../../../shared/constants/actionStyles'
import { CELL_SECONDARY_CLASS, NUMERIC_CLASS, TABLE_CLASS, TABLE_HEAD_CLASS, TD_CLASS, TH_CLASS } from '../../../shared/constants/tableStyles'

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

  const pendingTotal = draftPurchases.reduce((sum, p) => sum + Number(p.total), 0)
  const pendingItems = draftPurchases.reduce((sum, p) => sum + p.items.length, 0)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Compras por recibir"
        description={
          draftPurchases.length > 0
            ? `${draftPurchases.length} compra(s) por recibir · ${formatCurrency(pendingTotal)} · ${pendingItems} items`
            : 'Recibe las compras para sumar su mercancía al inventario.'
        }
        actions={
          canReceive && (
            <span className="text-sm">
              <button type="button" onClick={() => navigateTo('/dashboard?view=inventario&inv=add-entry')} className={ACTION_PRIMARY_CLASS}>
                + Nueva compra
              </button>
            </span>
          )
        }
      />

      {!canReceive && <PermissionNotice action="recibir ni cancelar compras" />}

      {purchasesError && (
        <QueryErrorState error={purchasesError} subject="las compras por recibir" onRetry={() => void refetchPurchases()} />
      )}

      {/* Master-detail: the list stays at hand while the detail is read; on lg+ both share the row. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(18rem,1fr)_2fr]">
        {/* Lista de compras pendientes */}
        <section aria-labelledby="entries-list-title" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="space-y-3 border-b border-[var(--color-border)] p-3">
            <h2 id="entries-list-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              Compras pendientes <span className="font-normal text-[var(--color-text-secondary)]">({filteredPurchases.length})</span>
            </h2>
            <input
              type="search"
              placeholder="Buscar por proveedor o factura"
              aria-label="Buscar compra por proveedor o factura"
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              className={FORM_FIELD_CLASS}
            />
          </div>

          {isLoadingPurchases ? (
            <div className="space-y-2 p-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : filteredPurchases.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-text-secondary)]">
              {draftPurchases.length === 0 ? 'No hay compras pendientes' : 'No hay coincidencias'}
            </p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-[var(--color-border)] overflow-y-auto">
              {filteredPurchases.map((purchase) => {
                const isSelected = selectedPurchaseId === purchase.id
                return (
                  <li key={purchase.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => selectPurchase(purchase.id)}
                      className="flex w-full items-start justify-between gap-3 border-l-4 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                      style={{
                        borderLeftColor: isSelected ? 'var(--color-primary)' : 'transparent',
                        backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-surface))' : undefined,
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--color-text-primary)]">
                          {purchase.supplier?.name || 'Proveedor sin nombre'}
                        </span>
                        <span className="block text-sm text-[var(--color-text-secondary)]">
                          {purchase.items.length} items{purchase.invoiceNumber ? ` · Factura ${purchase.invoiceNumber}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text-primary)]">
                        {formatCurrency(Number(purchase.total))}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Detalle de compra seleccionada */}
        {selectedPurchaseId && !isLoadingDetail && selectedPurchase ? (
          <section aria-labelledby="entries-detail-title" key="detail" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            {/* Header: who, invoice and total; the actions right below, visible without scrolling. */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
              <div className="min-w-0">
                <h2 id="entries-detail-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {selectedPurchase.supplier?.name || 'Sin proveedor especificado'}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Factura: <span className="font-medium text-[var(--color-text-primary)]">{selectedPurchase.invoiceNumber || '—'}</span>
                  {selectedPurchase.supplier?.email && <> · {selectedPurchase.supplier.email}</>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--color-text-secondary)]">Total</p>
                <p className="text-2xl font-bold tabular-nums text-[var(--color-success)]">
                  {formatCurrency(Number(selectedPurchase.total))}
                </p>
              </div>
            </div>

            {canReceive && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-border)] px-4 py-3 text-sm">
                <button
                  type="button"
                  onClick={() => setIsConfirmingReceive(true)}
                  disabled={isReceiving || isDeleting}
                  className={ACTION_SUCCESS_CLASS}
                >
                  {isReceiving ? 'Recibiendo...' : 'Recibir compra'}
                </button>
                <span className="text-[var(--color-text-secondary)]">
                  Se sumarán {selectedPurchase.items.length} ingrediente(s) al inventario.
                </span>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  disabled={isReceiving || isDeleting}
                  className={`${ACTION_DANGER_CLASS} ml-auto`}
                >
                  Cancelar compra
                </button>
              </div>
            )}

            {/* Items: "Entra al stock" is what each ingredient gains when the purchase is received. */}
            <div className="overflow-x-auto">
              <table className={TABLE_CLASS}>
                <thead className={TABLE_HEAD_CLASS}>
                  <tr>
                    <th className={`${TH_CLASS} text-left`}>Ingrediente</th>
                    <th className={`${TH_CLASS} text-right`}>Entra al stock</th>
                    <th className={`${TH_CLASS} text-right`}>Costo unitario</th>
                    <th className={`${TH_CLASS} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {selectedPurchase.items.map((item) => {
                    // Per kg/lt for gram and milliliter lines ($0.65 per gr reads $653 per kg).
                    const reference = referenceUnitCost(Number(item.unitCost), item.ingredient.unit.abbreviation)
                    return (
                      <tr key={item.id}>
                        <td className={TD_CLASS}>
                          <p className="font-medium text-[var(--color-text-primary)]">{item.ingredient.name}</p>
                          <p className={CELL_SECONDARY_CLASS}>{item.ingredient.sku || '—'}</p>
                        </td>
                        <td className={`${TD_CLASS} ${NUMERIC_CLASS} font-medium text-[var(--color-success)]`}>
                          +{Number(item.quantity).toFixed(2)}{' '}
                          <span className="text-[var(--color-text-secondary)]">{item.ingredient.unit.abbreviation}</span>
                        </td>
                        <td className={`${TD_CLASS} ${NUMERIC_CLASS} text-[var(--color-text-secondary)]`}>
                          {formatCurrency(reference.value)} / {reference.unit}
                        </td>
                        <td className={`${TD_CLASS} ${NUMERIC_CLASS} font-medium text-[var(--color-text-primary)]`}>
                          {formatCurrency(Number(item.quantity) * Number(item.unitCost))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                  <tr>
                    <td colSpan={3} className={`${TD_CLASS} text-right text-[var(--color-text-secondary)]`}>Subtotal</td>
                    <td className={`${TD_CLASS} ${NUMERIC_CLASS} font-medium text-[var(--color-text-primary)]`}>
                      {formatCurrency(Number(selectedPurchase.subtotal))}
                    </td>
                  </tr>
                  {selectedPurchase.tax > 0 && (
                    <tr>
                      <td colSpan={3} className={`${TD_CLASS} text-right text-[var(--color-text-secondary)]`}>IVA</td>
                      <td className={`${TD_CLASS} ${NUMERIC_CLASS} font-medium text-[var(--color-text-primary)]`}>
                        {formatCurrency(Number(selectedPurchase.tax))}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className={`${TD_CLASS} text-right font-semibold text-[var(--color-text-primary)]`}>Total</td>
                    <td className={`${TD_CLASS} ${NUMERIC_CLASS} font-semibold text-[var(--color-text-primary)]`}>
                      {formatCurrency(Number(selectedPurchase.total))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {selectedPurchase.notes && (
              <p className="border-t border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-text-primary)]">Notas:</span> {selectedPurchase.notes}
              </p>
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
          </section>
        ) : selectedPurchaseId && isLoadingDetail ? (
          <div key="loading" aria-busy="true" className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">Cargando detalles...</p>
            <Skeleton className="h-12" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <div
            key="empty"
            className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]"
          >
            {draftPurchases.length > 0
              ? 'Selecciona una compra de la lista para revisar sus insumos y recibirla.'
              : 'Cuando registres una compra en "Nueva compra", aparecerá aquí para recibirla.'}
          </div>
        )}
      </div>
    </div>
  )
}
