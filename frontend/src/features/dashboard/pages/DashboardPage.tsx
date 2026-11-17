import { AnimatePresence, motion } from 'framer-motion'
import { sileo } from 'sileo'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { getErrorMessage, getErrorStatus } from '../../../shared/utils/errors'
import { MenuSection } from '../../menu/components/MenuSection'
import { OrderDetailsPanel } from '../components/OrderDetailsPanel'
import { hasPermission } from '../../auth/utils/permissions'
import React from 'react'
import { lazyWithReload } from '../../../shared/utils/lazyWithReload'
import { useUrlParam } from '../../../shared/hooks/useUrlParam'
import { usePrevious } from '../../../shared/hooks/usePrevious'

// Views outside the POS are loaded on demand so the sales screen starts light
// (MetricsPage alone pulls in the charting library).
const OrdersPage = lazyWithReload(() => import('../../orders/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const InventoryLayout = lazyWithReload(() => import('../../inventory/pages/InventoryLayout').then((m) => ({ default: m.InventoryLayout })))
const MetricsPage = lazyWithReload(() => import('../pages/MetricsPage').then((m) => ({ default: m.MetricsPage })))
import type { CreateOrderItem, CreateOrderPayload, OrderItem } from '../types/order.types'
import type { MenuItem, SelectedExtra, ComboTemperature } from '../../menu/types/menu.types'
import { extrasKey, extrasUnitPrice } from '../../menu/utils/extras'
import { menuItemKey } from '../../menu/utils/menuSearch'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { useMenu } from '../../menu/hooks/useMenu'
import { useCreateOrder } from '../hooks/useCreateOrder'
import { useOrderQuote } from '../hooks/useOrderQuote'
import { useSessionState } from '../../../shared/hooks/useSessionState'
import { LazyView } from '../../../shared/components/LazyView'
import { CashOpeningPanel } from '../components/CashOpeningPanel'
import { CashPaymentDialog } from '../components/CashPaymentDialog'
import { CashClosingDialog } from '../components/CashClosingDialog'
import { useCashSession } from '../hooks/useCashSession'
import { formatShortDateTime } from '../../../shared/utils/dateUtils'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { DashboardHeader } from '../components/DashboardHeader'
import { ScheduleOrderDialog } from '../components/ScheduleOrderDialog'
import { useSaleAttemptKey } from '../hooks/useSaleAttemptKey'
import { getDeliveryCashAmount, getLocalDateTimeValue, getRoleLabel, getSaleValidationError, parseScheduleInput } from '../utils/saleForm'

export function DashboardPage() {
  const currentUser = useCurrentUser()

  // The sale being captured survives a reload of the tab (per user), so a refresh in the
  // middle of a rush doesn't lose the order.
  const draftKey = (field: string) => `andy-pos-draft:${currentUser?.id ?? 'anon'}:${field}`
  const [orderItems, setOrderItems] = useSessionState<OrderItem[]>(draftKey('items'), [])
  const [orderNotes, setOrderNotes] = useSessionState(draftKey('notes'), '')
  const [customerName, setCustomerName] = useSessionState(draftKey('customer'), '')
  // Cash is the most common payment: selected by default to save a step per sale.
  const [paymentMethod, setPaymentMethod] = useSessionState<'cash' | 'transfer' | 'card' | 'pending' | undefined>(draftKey('payment'), 'cash')
  const [hasDelivery, setHasDelivery] = useSessionState(draftKey('hasDelivery'), false)
  const [deliveryAmount, setDeliveryAmount] = useSessionState(draftKey('deliveryAmount'), '')
  const [deliveryResponsible, setDeliveryResponsible] = useSessionState<
    'customer_to_courier' | 'customer_to_business' | 'business_absorbs' | undefined
  >(draftKey('deliveryResponsible'), undefined)
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useSessionState<'cash' | 'transfer' | undefined>(draftKey('deliveryPayment'), undefined)
  const [scheduledFor, setScheduledFor] = useSessionState<string | null>(draftKey('scheduledFor'), null)
  const [scheduleInputValue, setScheduleInputValue] = React.useState('')
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = React.useState(false)
  const [isCashPaymentOpen, setIsCashPaymentOpen] = React.useState(false)
  const [isCashClosingOpen, setIsCashClosingOpen] = React.useState(false)
  const [closingExpectedAmount, setClosingExpectedAmount] = React.useState(0)
  const [selectedCategory, setSelectedCategory] = React.useState<
    string | undefined
  >()
  const isInitialCategorySet = React.useRef(false)

  const allMenuItems = [
    { id: 'venta', label: 'Venta', requiredPermission: 'sales.create' },
    { id: 'ordenes', label: 'Órdenes', requiredPermission: 'sales.read' },
    { id: 'inventario', label: 'Inventario', requiredPermission: 'inventory.view' },
    { id: 'admin', label: 'Administración', requiredPermission: 'dashboard.read' },
  ] as const
  type DashboardView = (typeof allMenuItems)[number]['id']

  const visibleMenuItems = allMenuItems.filter((item) => hasPermission(currentUser, item.requiredPermission))
  const visibleViewIds = visibleMenuItems.map((item) => item.id)
  // The view lives in the URL (?view=…): a reload keeps it and Back returns to the previous
  // one. It is always one the user may open (without sales.create the POS is not the landing view).
  const [currentView, setCurrentView] = useUrlParam<DashboardView>('view', visibleViewIds, visibleViewIds[0] ?? 'venta')
  const prevView = usePrevious(currentView)
  const canOpenCash = hasPermission(currentUser, 'cash.open')
  const canCloseCash = hasPermission(currentUser, 'cash.close')

  const viewOrder: string[] = allMenuItems.map((item) => item.id)
  const direction = prevView ? (viewOrder.indexOf(currentView) > viewOrder.indexOf(prevView) ? 1 : -1) : 1
  // Leaving a view drops its own tabs from the URL.
  const selectView = (view: DashboardView) => setCurrentView(view, { clear: ['admin', 'inv', 'gestion'] })

  const {
    data: menuData,
    isLoading: isMenuLoading,
    isError,
    error,
    refetch: refetchMenu,
    isRefetching: isRefetchingMenu,
  } = useMenu()
  const { mutate: createOrder, isPending: isCreatingOrder } = useCreateOrder()
  const saleAttempt = useSaleAttemptKey(draftKey('attempt'))

  // Cart lines exactly as the API receives them: the quote and the sale send the same items.
  const saleItems = React.useMemo<CreateOrderItem[]>(
    () =>
      orderItems.map(({ productId, comboId, quantity, note, type, temperature, size, extras, comboTemperatures }) => ({
        productId: type === 'product' ? productId : undefined,
        comboId: type === 'combo' ? comboId : undefined,
        quantity,
        note,
        temperature: type === 'product' ? temperature ?? undefined : undefined,
        size: type === 'product' ? size : undefined,
        // Per unit of the line: the server multiplies them by the line quantity.
        extras: type === 'product' && extras?.length
          ? extras.map(({ extraId, quantity: perUnit }) => ({ extraId, quantity: perUnit }))
          : undefined,
        // Combos: hot/cold of each drink sold both ways (its recipe, cup and ice).
        comboTemperatures: type === 'combo' && comboTemperatures?.length
          ? comboTemperatures.map(({ productId: drinkId, temperature: drinkTemperature }) => ({ productId: drinkId, temperature: drinkTemperature }))
          : undefined,
      })),
    [orderItems],
  )
  const { quote, lastQuote, error: quoteError, retry: retryQuote, isRetrying: isRetryingQuote } = useOrderQuote(saleItems)
  const quoteErrorMessage = quoteError ? getErrorMessage(quoteError, 'No se pudo calcular el total con el servidor.') : null

  // Mandadito the customer pays to Andy's in cash: not revenue, but it goes into the drawer
  // together with the sale, so the cash dialog charges both.
  const deliveryCashAmount = getDeliveryCashAmount({ hasDelivery, deliveryResponsible, deliveryPaymentMethod, deliveryAmount })
  const takesCash = paymentMethod === 'cash' || deliveryCashAmount > 0
  const {
    data: cashSession,
    isLoading: isCashSessionLoading,
    error: cashSessionError,
    refetch: refetchCashSession,
    openSession,
    closeSession,
  } = useCashSession({ enabled: canOpenCash })

  const submitOrder = (cashReceived?: number) => {
    if (isCreatingOrder) return

    const orderPayload: CreateOrderPayload = {
      customerName: customerName || 'Cliente',
      notes: orderNotes,
      cashSessionId: cashSession?.id,
      paymentMethod: paymentMethod!,
      cashReceived,
      hasDelivery,
      deliveryAmount: hasDelivery ? Number(deliveryAmount) || 0 : undefined,
      deliveryResponsible: hasDelivery ? deliveryResponsible : undefined,
      deliveryPaymentMethod: hasDelivery && deliveryResponsible === 'customer_to_business' ? deliveryPaymentMethod : undefined,
      scheduledFor: scheduledFor ?? undefined,
      items: saleItems,
    }

    createOrder({ order: orderPayload, idempotencyKey: saleAttempt.keyFor(orderPayload) }, {
      onSuccess: (createdOrder) => {
        saleAttempt.reset()
        setIsCashPaymentOpen(false)
        setIsScheduleDialogOpen(false)
        handleClearOrder()
        if (orderPayload.scheduledFor) {
          sileo.success({ title: 'Pedido programado.', description: `Se activará el ${formatShortDateTime(orderPayload.scheduledFor)}.`, duration: 4000 })
          return
        }
        // Confirm with the server's numbers: they are the ones recorded.
        const chargedTotal = Number(createdOrder.total)
        const cashDue = (orderPayload.paymentMethod === 'cash' ? chargedTotal : 0) + deliveryCashAmount
        const change = cashReceived !== undefined ? cashReceived - cashDue : null
        sileo.success({
          title: 'Orden creada exitosamente.',
          description: `Total: ${formatCurrency(chargedTotal)}${change !== null ? ` · Cambio: ${formatCurrency(Math.max(0, change))}` : ''}`,
          duration: 5000,
        })
      },
      onError: (error) => {
        const status = getErrorStatus(error)
        if (status === undefined) {
          // No answer: the sale may have been recorded. Retrying with the same key is safe.
          saleAttempt.pin()
          sileo.error({
            title: 'No sabemos si la venta se registró',
            description: 'Se perdió la conexión. Vuelve a cobrar: si ya se había registrado, no se duplicará. Revisa Órdenes si tienes dudas.',
          })
          return
        }
        if (status === 409 && /clave de idempotencia/i.test(getErrorMessage(error, ''))) {
          // The pinned attempt was recorded with another cart: don't charge it again blindly.
          saleAttempt.reset()
          sileo.error({
            title: 'Esa venta ya se había registrado',
            description: 'Se registró antes de que cambiaras la orden. Revisa Órdenes antes de volver a cobrar.',
          })
          return
        }
        sileo.error({
          title: 'No se pudo registrar la venta',
          description: getErrorMessage(error, 'Revisa tu conexión e intenta de nuevo: la orden sigue en pantalla.'),
        })
      },
    })
  }

  const handleProcessOrder = () => {
    if (isCreatingOrder) return

    const problem = getSaleValidationError({
      itemCount: orderItems.length,
      paymentMethod,
      customerName,
      hasDelivery,
      deliveryAmount,
      deliveryResponsible,
      deliveryPaymentMethod,
    })
    if (problem) {
      sileo.error(problem)
      return
    }

    if (takesCash) {
      setIsCashPaymentOpen(true)
      return
    }

    submitOrder()
  }

  // Units of each menu item already in the order: the menu cards show them.
  const orderQuantities = React.useMemo(() => {
    const quantities = new Map<string, number>()
    for (const item of orderItems) {
      const key = menuItemKey(item.type, item.type === 'product' ? item.productId : item.comboId)
      quantities.set(key, (quantities.get(key) ?? 0) + item.quantity)
    }
    return quantities
  }, [orderItems])

  // The category names for the tabs can be derived from the fetched data
  const categoryNames = React.useMemo(
    () => menuData?.map((c) => c.name) ?? [],
    [menuData],
  )

  // Set the first category as selected by default when data loads
  React.useEffect(() => {
    if (!isInitialCategorySet.current && categoryNames.length > 0) {
      setSelectedCategory(categoryNames[0])
      isInitialCategorySet.current = true
    }
  }, [categoryNames])

  const handleAddToOrder = (menuItem: MenuItem, quantity: number, extras: SelectedExtra[] = [], comboTemperatures: ComboTemperature[] = []) => {
    // Kept with the drink's name so the cart can show "Latte Andy's · frío".
    const namedTemperatures = comboTemperatures.map((choice) => ({
      ...choice,
      name: menuItem.temperatureChoices?.find((drink) => drink.productId === choice.productId)?.name ?? '',
    }))
    const temperaturesKey = (choices?: ComboTemperature[]) =>
      (choices ?? []).map((choice) => `${choice.productId}:${choice.temperature}`).sort().join('|')
    setOrderItems((prevItems) => {
      const key = menuItem.type === 'product' ? 'productId' : 'comboId'
      // Same product, temperature, size and extras, without a note: one more unit of that line.
      const existingItemWithoutNote = prevItems.find(
        (item) =>
          item[key] === menuItem.id &&
          item.temperature === menuItem.temperature &&
          item.size === menuItem.size &&
          extrasKey(item.extras) === extrasKey(extras) &&
          temperaturesKey(item.comboTemperatures) === temperaturesKey(comboTemperatures) &&
          !item.note,
      )

      if (existingItemWithoutNote) {
        return prevItems.map((item) =>
          item.id === existingItemWithoutNote.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      }

      const newOrderItem: OrderItem = {
        id: crypto.randomUUID(),
        productName: menuItem.name,
        size: menuItem.size,
        // The menu resolves the temperature on the server; 'BOTH' drinks come with a concrete one
        // chosen in the customization dialog.
        temperature: menuItem.temperature === 'BOTH' ? null : menuItem.temperature ?? null,
        quantity,
        unitPrice: menuItem.price,
        // Public URL from the API; ProductImage shows the logo when it is missing or fails.
        image: menuItem.imageUrl ?? null,
        type: menuItem.type,
        ...(extras.length > 0 && { extras }),
        ...(namedTemperatures.length > 0 && { comboTemperatures: namedTemperatures }),
      }

      if (menuItem.type === 'product') {
        newOrderItem.productId = menuItem.id
      } else {
        newOrderItem.comboId = menuItem.id
      }

      return [...prevItems, newOrderItem]
    })
  }

  const handleIncrementItem = (itemId: string) => {
    setOrderItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId && item.quantity < 99 ? { ...item, quantity: item.quantity + 1 } : item)),
    )
  }

  const handleDeleteItem = (itemId: string) => {
    setOrderItems((prevItems) => prevItems.filter((item) => item.id !== itemId))
  }

  const handleRemoveItem = (itemId: string) => {
    setOrderItems((prevItems) => {
      return prevItems
        .map((item) => {
          if (item.id === itemId) {
            if (item.quantity > 1) {
              return { ...item, quantity: item.quantity - 1 }
            }
            return null // Mark for removal
          }
          return item
        })
        .filter(Boolean) as OrderItem[] // Filter out nulls
    })
  }

  // The note describes the whole line (e.g. "1 deslactosado, 1 sin azúcar"): it doesn't split
  // it, and promotions count every unit anyway (business rule 2026-10-20).
  const handleUpdateItemNote = (itemId: string, note: string) => {
    const trimmed = note.trim()
    setOrderItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId ? { ...item, note: trimmed || undefined } : item)),
    )
  }

  const handleNotesChange = (notes: string) => {
    setOrderNotes(notes)
  }

  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name)
  }

  const handlePaymentMethodChange = (method: 'cash' | 'transfer' | 'card' | 'pending') => {
    setPaymentMethod(method)
  }

  const handleClearOrder = () => {
    setOrderItems([])
    setOrderNotes('')
    setCustomerName('')
    setPaymentMethod('cash')
    setHasDelivery(false)
    setDeliveryAmount('')
    setDeliveryResponsible(undefined)
    setDeliveryPaymentMethod(undefined)
    setScheduledFor(null)
    setScheduleInputValue(getLocalDateTimeValue())
  }

  const handleScheduleOrderConfirmation = () => {
    const parsed = parseScheduleInput(scheduleInputValue)
    if ('error' in parsed) {
      sileo.error({ title: 'Fecha inválida', description: parsed.error })
      return
    }

    setScheduledFor(parsed.date.toISOString())
    setIsScheduleDialogOpen(false)
    sileo.success({ title: 'Pedido programado', description: `Se activará el ${formatShortDateTime(parsed.date)}.`, duration: 3000 })
  }

  // Server pricing when available (the last one while a new quote is on its way); the menu
  // prices are only a rough fallback, e.g. if the quote request failed.
  const localSubtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice + extrasUnitPrice(item.extras)) * item.quantity, 0)
  const subtotal = lastQuote ? Number(lastQuote.subtotal) : localSubtotal
  const discount = lastQuote ? Number(lastQuote.discount) : 0
  const total = lastQuote ? Number(lastQuote.total) : localSubtotal
  const lineTotals = lastQuote?.items.map((line) => ({ gross: Number(line.gross), net: Number(line.net) }))

  const displayName = currentUser?.name ?? 'Usuario'
  const roleLabel = getRoleLabel(currentUser?.roleName)

  const handleCloseCashSession = () => {
    if (closeSession.isPending || isCashClosingOpen) return
    void (async () => {
      const result = await refetchCashSession()
      if (result.isError) {
        sileo.error({ title: 'No se pudo consultar la caja', description: getErrorMessage(result.error, 'Revisa tu conexión e inténtalo de nuevo.') })
        return
      }
      if (!result.data) {
        sileo.error({ title: 'La caja ya no está abierta', description: 'Actualiza la pantalla para continuar.' })
        return
      }
      setClosingExpectedAmount(Number(result.data.expectedAmount))
      setIsCashClosingOpen(true)
    })()
  }

  const renderContent = () => {
    const variants = {
      enter: (direction: number) => ({
        x: direction > 0 ? 100 : -100,
        opacity: 0,
      }),
      center: {
        x: 0,
        opacity: 1,
      },
      exit: (direction: number) => ({
        x: direction < 0 ? 100 : -100,
        opacity: 0,
      }),
    }

    return (
      <AnimatePresence mode="wait" custom={direction}>
        {currentView === 'venta' &&
          (!cashSession || cashSession.status !== 'open' ? (
            <motion.div
              key="cash-opening"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
            >
              <CashOpeningPanel
                canOpen={canOpenCash}
                session={cashSession}
                isLoading={isCashSessionLoading}
                error={cashSessionError as Error | null}
                isOpening={openSession.isPending}
                onOpen={(openingAmount) => {
                  if (openSession.isPending) return
                  openSession.mutate(openingAmount, {
                    onSuccess: () => {
                      sileo.success({ title: 'Caja abierta correctamente.', duration: 3000 })
                    },
                    onError: (error) => {
                      sileo.error({
                        title: 'No se pudo abrir la caja',
                        description: getErrorMessage(error, 'Inténtalo de nuevo.'),
                      })
                    },
                  })
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="venta-view"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              // Menu (flexible) and order (fixed width per breakpoint): 2 product columns beside
              // the order on a tablet in portrait, 3–4 in landscape, more on a desktop.
              className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22.5rem] xl:grid-cols-[minmax(0,1fr)_25rem] pos-fit:min-h-0 pos-fit:flex-1 pos-fit:grid-rows-[minmax(0,1fr)]"
            >
              {isError ? (
                <div
                  className="self-start rounded-[1.25rem] border shadow-[var(--shadow-card)]"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                >
                  <QueryErrorState error={error} subject="el menú" onRetry={() => void refetchMenu()} isRetrying={isRefetchingMenu} />
                </div>
              ) : (
                <MenuSection
                  menu={menuData}
                  isLoading={isMenuLoading}
                  categoryNames={categoryNames}
                  onAddToOrder={handleAddToOrder}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  quantities={orderQuantities}
                />
              )}
              <OrderDetailsPanel
                isProcessing={isCreatingOrder}
                items={orderItems}
                subtotal={subtotal}
                discount={discount}
                total={total}
                lineTotals={lineTotals}
                isPricing={orderItems.length > 0 && !quote}
                pricingError={quoteErrorMessage}
                isRetryingPricing={isRetryingQuote}
                onRetryPricing={retryQuote}
                deliveryCharge={hasDelivery && deliveryResponsible === 'customer_to_business' ? Number(deliveryAmount) || 0 : 0}
                orderNotes={orderNotes}
                customerName={customerName}
                paymentMethod={paymentMethod}
                hasDelivery={hasDelivery}
                deliveryAmount={deliveryAmount}
                deliveryResponsible={deliveryResponsible}
                deliveryPaymentMethod={deliveryPaymentMethod}
                scheduledFor={scheduledFor}
                onNotesChange={handleNotesChange}
                onCustomerNameChange={handleCustomerNameChange}
                onPaymentMethodChange={handlePaymentMethodChange}
                onHasDeliveryChange={setHasDelivery}
                onDeliveryAmountChange={setDeliveryAmount}
                onDeliveryResponsibleChange={setDeliveryResponsible}
                onDeliveryPaymentMethodChange={setDeliveryPaymentMethod}
                onRemoveItem={handleRemoveItem}
                onIncrementItem={handleIncrementItem}
                onDeleteItem={handleDeleteItem}
                onUpdateItemNote={handleUpdateItemNote}
                onProcessTransaction={handleProcessOrder}
                onScheduleOrder={() => {
                  setScheduleInputValue(getLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)))
                  setIsScheduleDialogOpen(true)
                }}
              />
              <ScheduleOrderDialog
                open={isScheduleDialogOpen}
                value={scheduleInputValue}
                onChange={setScheduleInputValue}
                onCancel={() => setIsScheduleDialogOpen(false)}
                onConfirm={handleScheduleOrderConfirmation}
              />
              <CashPaymentDialog
                key={isCashPaymentOpen ? 'cash-payment-open' : 'cash-payment-closed'}
                open={isCashPaymentOpen}
                // null while the server price of the current cart is on its way.
                saleAmount={paymentMethod === 'cash' ? (quote ? Number(quote.total) : null) : 0}
                deliveryAmount={deliveryCashAmount}
                isLoading={isCreatingOrder}
                pricingError={paymentMethod === 'cash' ? quoteErrorMessage : null}
                isRetryingPricing={isRetryingQuote}
                onRetryPricing={retryQuote}
                onClose={() => setIsCashPaymentOpen(false)}
                onConfirm={(cashReceived) => submitOrder(cashReceived)}
              />
            </motion.div>
          ))}

        {currentView === 'ordenes' && (
          <motion.div
            key="ordenes-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <LazyView>
              <OrdersPage />
            </LazyView>
          </motion.div>
        )}

        {currentView === 'inventario' && (
          <motion.div
            key="inventario-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <LazyView>
              <InventoryLayout />
            </LazyView>
          </motion.div>
        )}

        {currentView === 'admin' && (
          <motion.div
            key="admin-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <LazyView>
              <MetricsPage />
            </LazyView>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Selling: the screen fits the window (menu and order scroll inside their panels), wider.
  const isSelling = currentView === 'venta' && cashSession?.status === 'open'
  const contentWidth = isSelling ? 'max-w-[1600px]' : 'max-w-7xl'

  return (
    <div
      className={isSelling ? 'min-h-screen pos-fit:flex pos-fit:h-svh pos-fit:min-h-0 pos-fit:flex-col pos-fit:overflow-hidden' : 'min-h-screen'}
      style={{
        background: 'radial-gradient(circle at top, var(--color-surface) 0%, var(--color-background) 100%)',
      }}
    >
      <DashboardHeader
        displayName={displayName}
        roleLabel={roleLabel}
        items={visibleMenuItems}
        currentView={currentView}
        onSelectView={selectView}
        showCloseCash={cashSession?.status === 'open' && canCloseCash}
        isClosingCash={closeSession.isPending}
        onCloseCash={handleCloseCashSession}
        maxWidthClassName={contentWidth}
      />

      <div
        className={isSelling
          ? `mx-auto w-full ${contentWidth} p-3 lg:px-4 pos-fit:flex pos-fit:min-h-0 pos-fit:flex-1 pos-fit:flex-col`
          : `mx-auto ${contentWidth} p-4 sm:p-6`}
      >
        {renderContent()}
      </div>
      <CashClosingDialog
        key={isCashClosingOpen ? 'cash-closing-open' : 'cash-closing-closed'}
        open={isCashClosingOpen}
        expectedAmount={closingExpectedAmount}
        isLoading={closeSession.isPending}
        onClose={() => setIsCashClosingOpen(false)}
        onConfirm={(input) => {
          if (closeSession.isPending) return
          closeSession.mutate(input, {
            onSuccess: () => {
              setIsCashClosingOpen(false)
              sileo.success({ title: 'Caja cerrada correctamente.', duration: 3000 })
            },
            onError: (error) => sileo.error({ title: 'No se pudo cerrar la caja', description: getErrorMessage(error, 'Inténtalo de nuevo.') }),
          })
        }}
      />
    </div>
  )
}
