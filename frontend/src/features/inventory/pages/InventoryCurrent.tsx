import { useState, useCallback } from 'react'
import { useInventoryList, useInventorySummary, useProductCoverage } from '../hooks/useInventory'
import { ProductCoverageCard } from '../components/ProductCoverageCard'
import type { UseInventoryListParams } from '../hooks/useInventory'
import { InventoryAttention } from '../components/InventoryAttention'
import { ConsumptionOffNotice } from '../components/ConsumptionOffNotice'
import { InventorySettingsMenu } from '../components/InventorySettingsCard'
import { InventoryTable } from '../components/InventoryTable'
import { PageHeader } from '../../../shared/components/PageHeader'
import { StockSummaryStrip, type StockStatusFilter } from '../components/StockSummaryStrip'
import { Pagination } from '../../../shared/components/Pagination'
import { FilterBar } from '../../../shared/components/FilterBar'
import { FILTER_FIELD_CLASS } from '../../../shared/constants/fieldStyles'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { navigateTo } from '../../../app/navigation'

const STATUS_OPTIONS: { value: StockStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'normal', label: 'Normal' },
  { value: 'low_stock', label: 'Stock bajo' },
  { value: 'out_of_stock', label: 'Agotado' },
]

/**
 * Existencias: what is in stock and what needs attention. The table comes right after a compact
 * summary; settings live in a menu and the warnings in one collapsible notice.
 */
export function InventoryCurrent() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  // One request once the user stops typing, not one per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState<StockStatusFilter>('all')
  // Product filter: only the ingredients of its recipe, and how many units the stock covers.
  const [productId, setProductId] = useState('')
  const { data: coverage = [] } = useProductCoverage()
  const selectedProduct = coverage.find((product) => product.id === productId)
  const productOptions = [...coverage].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const queryParams: UseInventoryListParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status,
    productId: productId || undefined,
  }

  const { data, isLoading, error, refetch, isFetching } = useInventoryList(queryParams)
  // Totals of the whole inventory from the server, not of the page (20 rows) or the active filter.
  const { data: summary, isLoading: isSummaryLoading } = useInventorySummary()
  const lowStockCount = summary?.lowStockCount ?? 0
  const outOfStockCount = summary?.outOfStockCount ?? 0
  const normalStockCount = Math.max(0, (summary?.totalIngredients ?? 0) - lowStockCount - outOfStockCount)

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleStatusChange = (newStatus: StockStatusFilter) => {
    setStatus(newStatus)
    setPage(1)
  }

  const handleProductChange = (id: string) => {
    setProductId(id)
    setPage(1)
  }

  const hasFilters = Boolean(search) || status !== 'all' || Boolean(productId)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Existencias"
        description="Stock actual de cada insumo y lo que requiere atención."
        actions={<InventorySettingsMenu />}
      />

      <StockSummaryStrip
        total={summary?.totalIngredients ?? 0}
        normal={normalStockCount}
        low={lowStockCount}
        outOfStock={outOfStockCount}
        value={Number(summary?.totalValue ?? 0)}
        activeStatus={status}
        onSelectStatus={handleStatusChange}
        isLoading={isSummaryLoading}
      />

      <ConsumptionOffNotice onShowProducts={() => navigateTo('/dashboard?view=inventario&inv=management&gestion=products')} />

      <InventoryAttention
        onShowLowStock={() => handleStatusChange('low_stock')}
        onShowProducts={() => navigateTo('/dashboard?view=inventario&inv=management&gestion=products')}
      />

      <FilterBar
        hasFilters={hasFilters}
        onClear={() => {
          handleSearch('')
          handleStatusChange('all')
          handleProductChange('')
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nombre o SKU"
          aria-label="Buscar ingrediente por nombre o SKU"
          className={`${FILTER_FIELD_CLASS} w-full sm:w-72`}
        />
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as StockStatusFilter)}
          aria-label="Filtrar por estado del stock"
          className={FILTER_FIELD_CLASS}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
          aria-label="Filtrar por producto"
          className={`${FILTER_FIELD_CLASS} w-full sm:w-72`}
        >
          <option value="">Todos los productos</option>
          {productOptions.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} — {product.units <= 0 ? 'no alcanza' : `alcanza para ${product.units}`}
            </option>
          ))}
        </select>
      </FilterBar>

      {selectedProduct && <ProductCoverageCard product={selectedProduct} onClear={() => handleProductChange('')} />}

      {error ? (
        <QueryErrorState error={error} subject="las existencias" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : (
        <InventoryTable
          ingredients={data?.data || []}
          isLoading={isLoading}
          emptyMessage={hasFilters ? 'Ningún insumo coincide con los filtros.' : 'No hay ingredientes registrados.'}
        />
      )}

      {data && data.pagination.totalPages > 1 && (
        <Pagination
          className="mt-4"
          page={page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          pageSize={data.pagination.limit}
          itemLabel="ingredientes"
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
