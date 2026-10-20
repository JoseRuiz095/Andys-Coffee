import { AnimatePresence, motion } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { getErrorMessage } from '../../../shared/utils/errors'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'
import { MenuSection } from '../../menu/components/MenuSection'
import { OrderDetailsPanel } from '../components/OrderDetailsPanel'
import { authStore } from '../../auth/store/auth.store'
import type { AuthUser } from '../../auth/types/auth.types'
import { hasPermission } from '../../auth/utils/permissions'
import React from 'react'

// Views outside the POS are loaded on demand so the sales screen starts light
// (MetricsPage alone pulls in the charting library).
const OrdersPage = React.lazy(() => import('../../orders/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const InventoryLayout = React.lazy(() => import('../../inventory/pages/InventoryLayout').then((m) => ({ default: m.InventoryLayout })))
const MetricsPage = React.lazy(() => import('../pages/MetricsPage').then((m) => ({ default: m.MetricsPage })))
import { CoffeeIcon } from '../../../components/ui/coffee'
import type { CoffeeIconHandle } from '../../../components/ui/coffee'
import { SettingsIcon } from '../../../components/ui/settings'
import { APP_ROUTES } from '../../../shared/constants/routes'
import type { CreateOrderItem, CreateOrderPayload, OrderItem } from '../types/order.types'
import type { MenuItem, SelectedExtra } from '../../menu/types/menu.types'
import { extrasKey, extrasUnitPrice } from '../../menu/utils/extras'
import { useMenu } from '../../menu/hooks/useMenu'
import { useCreateOrder } from '../hooks/useCreateOrder'
import { useOrderQuote } from '../hooks/useOrderQuote'
import { sessionEntry, useSessionState } from '../../../shared/hooks/useSessionState'
import { useNotifications } from '../hooks/useNotifications'
import { LazyView } from '../../../shared/components/LazyView'
import { NotificationCenter } from '../components/NotificationCenter'
import { CashOpeningPanel } from '../components/CashOpeningPanel'
import { CashPaymentDialog } from '../components/CashPaymentDialog'
import { CashClosingDialog } from '../components/CashClosingDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { useCashSession } from '../hooks/useCashSession'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function usePrevious<T>(value: T) {
  const ref = React.useRef<T | undefined>(undefined)
  React.useEffect(() => {
    ref.current = value
  })
  // The ref intentionally exposes the value from the previous render.
  // eslint-disable-next-line react-hooks/refs
  return ref.current
}

/**
 * Idempotency key of the current sale attempt. It is kept while the cart (and everything else
 * that defines the sale) stays the same, so a retry after a lost response — timeout, network
 * drop — reuses it and the server returns the order it already created. Any change to the sale
 * starts a new attempt. The cash received is left out: retyping it must not create a second sale.
 */
function useSaleAttemptKey(storageKey: string) {
  // Kept in sessionStorage too: reloading the tab after a lost response must not start a new
  // attempt for the same cart (the persisted cart would otherwise be charged twice).
  const readStored = () => {
    try {
      const raw = sessionEntry.get(storageKey)
      return raw ? (JSON.parse(raw) as { fingerprint: string; key: string }) : null
    } catch {
      return null
    }
  }

  return {
    keyFor(payload: CreateOrderPayload) {
      const fingerprint = JSON.stringify({ ...payload, cashReceived: undefined })
      const stored = readStored()
      if (stored?.fingerprint === fingerprint) return stored.key
      const attempt = { fingerprint, key: crypto.randomUUID() }
      sessionEntry.set(storageKey, JSON.stringify(attempt))
      return attempt.key
    },
    /** The sale went through: the next one is a new attempt. */
    reset() {
      sessionEntry.set(storageKey, null)
    },
  }
}

function getLocalDateTimeValue(date: Date = new Date(Date.now() + 60 * 60 * 1000)) {
  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function DashboardPage() {
  const [isLoading] = React.useState(false)
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(
    authStore.getState().user,
  )
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] =
    React.useState(false)
  const [activeView, setActiveView] = React.useState('Venta')
  const prevActiveView = usePrevious(activeView)

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
  const coffeeIconRef = React.useRef<CoffeeIconHandle>(null)
  const notificationContainerRef = React.useRef<HTMLDivElement>(null)

  // Define menu items with required permissions
  const allMenuItems = [
    { label: 'Venta', requiredPermission: 'sales.create' },
    { label: 'Ordenes', requiredPermission: 'sales.read' },
    { label: 'Inventario', requiredPermission: 'inventory.view' },
    { label: 'Administracion', requiredPermission: 'dashboard.read' },
  ]

  // Filter menu items based on user permissions
  const visibleMenuItems = allMenuItems.filter(
    (item) => item.requiredPermission === null || hasPermission(currentUser, item.requiredPermission)
  )

  const viewOrder = allMenuItems.map((item) => item.label)
  const direction = prevActiveView ? (viewOrder.indexOf(activeView) > viewOrder.indexOf(prevActiveView) ? 1 : -1) : 1

  const {
    data: menuData,
    isLoading: isMenuLoading,
    isError,
    error,
  } = useMenu()
  const { mutate: createOrder, isPending: isCreatingOrder } = useCreateOrder()
  const saleAttempt = useSaleAttemptKey(draftKey('attempt'))

  // Cart lines exactly as the API receives them: the quote and the sale send the same items.
  const saleItems = React.useMemo<CreateOrderItem[]>(
    () =>
      orderItems.map(({ productId, comboId, quantity, note, type, temperature, size, extras }) => ({
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
      })),
    [orderItems],
  )
  const { quote, lastQuote, error: quoteError } = useOrderQuote(saleItems)

  // Mandadito the customer pays to Andy's in cash: not revenue, but it goes into the drawer
  // together with the sale, so the cash dialog charges both.
  const deliveryCashAmount =
    hasDelivery && deliveryResponsible === 'customer_to_business' && deliveryPaymentMethod === 'cash'
      ? Number(deliveryAmount) || 0
      : 0
  const takesCash = paymentMethod === 'cash' || deliveryCashAmount > 0
  const {
    data: cashSession,
    isLoading: isCashSessionLoading,
    error: cashSessionError,
    refetch: refetchCashSession,
    openSession,
    closeSession,
  } = useCashSession()
  const { unreadCount } = useNotifications()
  const hasUnreadNotifications = unreadCount > 0

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
          sileo.success({ title: 'Pedido programado.', description: `Se activará el ${new Date(orderPayload.scheduledFor).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}.`, duration: 4000 })
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
        sileo.error({
          title: 'No se pudo registrar la venta',
          description: getErrorMessage(error, 'Revisa tu conexión e intenta de nuevo: la orden sigue en pantalla.'),
        })
      },
    })
  }

  const handleProcessOrder = () => {
    if (isCreatingOrder) return

    if (orderItems.length === 0) {
      sileo.error({
        title: 'La orden está vacía',
        description: 'Agrega al menos un producto.',
      })
      return
    }

    if (!paymentMethod) {
      sileo.error({
        title: 'Falta el método de pago',
        description: 'Selecciona cómo paga el cliente.',
      })
      return
    }

    if (paymentMethod === 'pending' && !customerName.trim()) {
      sileo.error({
        title: 'Revisa la orden',
        description: 'Debes ingresar el nombre del cliente para registrar un pago pendiente.',
      })
      return
    }

    if (hasDelivery) {
      if (!deliveryAmount || Number(deliveryAmount) <= 0) {
        sileo.error({
          title: 'Revisa la orden',
          description: 'Ingresa el costo del mandadito.',
        })
        return
      }
      if (!deliveryResponsible) {
        sileo.error({
          title: 'Revisa la orden',
          description: 'Indica quién recibe/paga el mandadito.',
        })
        return
      }
      if (deliveryResponsible === 'customer_to_business' && !deliveryPaymentMethod) {
        sileo.error({
          title: 'Revisa la orden',
          description: 'Indica el método de pago del mandadito.',
        })
        return
      }
    }

    if (takesCash) {
      setIsCashPaymentOpen(true)
      return
    }

    submitOrder()
  }

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

  React.useEffect(() => {
    const syncUser = () => setCurrentUser(authStore.getState().user)

    syncUser()
    window.addEventListener('auth:changed', syncUser)

    return () => window.removeEventListener('auth:changed', syncUser)
  }, [])

  React.useEffect(() => {
    if (hasUnreadNotifications) {
      coffeeIconRef.current?.startAnimation()
      return
    }

    coffeeIconRef.current?.stopAnimation()
  }, [hasUnreadNotifications])

  React.useEffect(() => {
    if (!isNotificationCenterOpen) return

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!notificationContainerRef.current?.contains(event.target as Node)) {
        setIsNotificationCenterOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown)
  }, [isNotificationCenterOpen])

  const handleAddToOrder = (menuItem: MenuItem, quantity: number, extras: SelectedExtra[] = []) => {
    setOrderItems((prevItems) => {
      const key = menuItem.type === 'product' ? 'productId' : 'comboId'
      // Same product, temperature, size and extras, without a note: one more unit of that line.
      const existingItemWithoutNote = prevItems.find(
        (item) =>
          item[key] === menuItem.id &&
          item.temperature === menuItem.temperature &&
          item.size === menuItem.size &&
          extrasKey(item.extras) === extrasKey(extras) &&
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
    if (!scheduleInputValue) {
      sileo.error({ title: 'Fecha inválida', description: 'Selecciona una fecha y hora futura para programar la orden.' })
      return
    }

    const selectedDate = new Date(scheduleInputValue)
    if (Number.isNaN(selectedDate.getTime())) {
      sileo.error({ title: 'Fecha inválida', description: 'La fecha y hora programada no son válidas.' })
      return
    }

    if (selectedDate.getTime() <= Date.now()) {
      sileo.error({ title: 'Fecha inválida', description: 'La programación debe estar en el futuro.' })
      return
    }

    setScheduledFor(selectedDate.toISOString())
    setIsScheduleDialogOpen(false)
    sileo.success({ title: 'Pedido programado', description: `Se activará el ${selectedDate.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}.`, duration: 3000 })
  }

  // Server pricing when available (the last one while a new quote is on its way); the menu
  // prices are only a rough fallback, e.g. if the quote request failed.
  const localSubtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice + extrasUnitPrice(item.extras)) * item.quantity, 0)
  const subtotal = lastQuote ? Number(lastQuote.subtotal) : localSubtotal
  const discount = lastQuote ? Number(lastQuote.discount) : 0
  const total = lastQuote ? Number(lastQuote.total) : localSubtotal
  const lineTotals = lastQuote?.items.map((line) => ({ gross: Number(line.gross), net: Number(line.net) }))

  const displayName = currentUser?.name ?? 'Usuario'
  const rawRoleName = currentUser?.roleName ?? currentUser?.roleId ?? ''
  const roleLabel =
    rawRoleName.toUpperCase() === 'ADMIN'
      ? 'Administrador'
      : rawRoleName.toUpperCase() === 'CAJERO'
      ? 'Cajero'
      : rawRoleName.toUpperCase() === 'ADMINISTRADOR'
      ? 'Administrador'
      : rawRoleName.toUpperCase() === 'CAJERO'
      ? 'Cajero'
      : currentUser?.roleId
      ? 'Usuario'
      : 'Usuario'

  const toggleNotificationCenter = () => {
    setIsNotificationCenterOpen((isOpen) => !isOpen)
  }

  const handleCloseCashSession = () => {
    if (closeSession.isPending || isCashClosingOpen) return
    void (async () => {
      const result = await refetchCashSession()
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
        {activeView === 'Venta' &&
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
              className="grid grid-cols-1 gap-6 lg:grid-cols-[56fr_44fr]"
            >
              {isError ? (
                <div className="rounded-lg border border-red-400 bg-red-100 p-8 text-center text-red-700">
                  <p className="font-bold">¡Error al cargar el menú!</p>
                  <p>{error.message}</p>
                </div>
              ) : (
                <MenuSection
                  menu={menuData}
                  isLoading={isMenuLoading}
                  categoryNames={categoryNames}
                  onAddToOrder={handleAddToOrder}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              )}
              <OrderDetailsPanel
                isLoading={false}
                isProcessing={isCreatingOrder}
                items={orderItems}
                subtotal={subtotal}
                discount={discount}
                total={total}
                lineTotals={lineTotals}
                isPricing={orderItems.length > 0 && !quote}
                pricingError={quoteError ? getErrorMessage(quoteError, 'No se pudo calcular el total con el servidor.') : null}
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
                onClearOrder={handleClearOrder}
                onUpdateItemNote={handleUpdateItemNote}
                onProcessTransaction={handleProcessOrder}
                onScheduleOrder={() => {
                  setScheduleInputValue(getLocalDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)))
                  setIsScheduleDialogOpen(true)
                }}
              />
              <Dialog open={isScheduleDialogOpen} onOpenChange={(open) => setIsScheduleDialogOpen(open)}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Programar pedido</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Fecha y hora programada
                      <input
                        type="datetime-local"
                        value={scheduleInputValue}
                        onChange={(event) => setScheduleInputValue(event.target.value)}
                        className="mt-2 w-full rounded-xl border px-3 py-2"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: 'var(--color-input-bg)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                    </label>
                    <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
                      {scheduleInputValue ? `Se activará el ${new Date(scheduleInputValue).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}.` : 'Selecciona una fecha y hora futura.'}
                    </div>
                  </div>
                  <DialogFooter>
                    <button type="button" className="rounded-xl px-3 py-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }} onClick={() => setIsScheduleDialogOpen(false)}>
                      Cancelar
                    </button>
                    <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }} onClick={handleScheduleOrderConfirmation}>
                      Confirmar
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <CashPaymentDialog
                key={isCashPaymentOpen ? 'cash-payment-open' : 'cash-payment-closed'}
                open={isCashPaymentOpen}
                // null while the server price of the current cart is on its way.
                saleAmount={paymentMethod === 'cash' ? (quote ? Number(quote.total) : null) : 0}
                deliveryAmount={deliveryCashAmount}
                isLoading={isCreatingOrder}
                onClose={() => setIsCashPaymentOpen(false)}
                onConfirm={(cashReceived) => submitOrder(cashReceived)}
              />
            </motion.div>
          ))}

        {activeView === 'Ordenes' && (
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

        {activeView === 'Inventario' && (
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

        {activeView === 'Administracion' && (
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

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(circle at top, var(--color-surface) 0%, var(--color-background) 100%)',
      }}
    >
      <header
        className="relative z-50 border-b px-4 py-4 shadow-[0_8px_30px_rgba(45,33,29,0.05)] backdrop-blur sm:px-6"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'color-mix(in srgb, var(--color-surface) 96%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-6 w-24" />
              </>
            ) : (
              <>
                <div
                  className="flex h-15 w-15 items-center justify-center rounded-2xl border p-2 shadow-sm"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-background)',
                  }}
                >
                  <img
                    src={brandLogo}
                    alt="Andys Coffee"
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {displayName}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{roleLabel}</div>
                </div>
              </>
            )}
          </div>

          <nav
            className="flex flex-wrap items-center gap-2 rounded-full border px-3 py-2 shadow-sm sm:gap-3"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
            }}
          >
            {visibleMenuItems.map((item) =>
              isLoading ? (
                <Skeleton key={item.label} className="h-4 w-20" />
              ) : (
                <button
                  key={item.label}
                  onClick={() => setActiveView(item.label)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: activeView === item.label ? 'var(--color-primary)' : 'transparent',
                    color: activeView === item.label ? 'var(--color-button-text)' : 'var(--color-text-primary)',
                  }}
                >
                  {item.label}
                </button>
              ),
            )}
          </nav>

          <div className="flex items-center gap-3">
            {cashSession && (
              <button
                type="button"
                onClick={handleCloseCashSession}
                disabled={closeSession.isPending}
                className="rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-60"
                style={{
                  borderColor: 'var(--color-danger)',
                  backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--color-danger)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-danger) 15%, var(--color-surface))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-danger) 10%, var(--color-surface))';
                }}
              >
                {closeSession.isPending ? 'Cerrando...' : 'Cerrar caja'}
              </button>
            )}
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </>
            ) : (
              <>
                <div ref={notificationContainerRef} className="relative">
                  <button
                    type="button"
                    aria-label="Abrir notificaciones del proyecto"
                    aria-expanded={isNotificationCenterOpen}
                    onClick={toggleNotificationCenter}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2`}
                style={hasUnreadNotifications ? {
                  borderColor: 'var(--color-warning)',
                  backgroundColor: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))',
                  color: 'var(--color-warning)',
                  boxShadow: '0 0 0 4px rgba(217, 119, 6, 0.14), 0 10px 24px rgba(217, 119, 6, 0.18)',
                  '--tw-ring-color': 'var(--color-warning)'
                } as React.CSSProperties : {
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-primary)',
                  '--tw-ring-color': 'var(--color-primary)'
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  if (hasUnreadNotifications) {
                    e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-warning) 16%, var(--color-surface))';
                  } else {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasUnreadNotifications) {
                    e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))';
                  } else {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  }
                }}

                  >
                    {hasUnreadNotifications && (
                      <>
                        <span className="absolute inset-0 rounded-full border-2 animate-ping" style={{ borderColor: 'color-mix(in srgb, var(--color-warning) 50%, transparent)' }} />
                        <span className="absolute -inset-1.5 rounded-full border" style={{ borderColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' }} />
                      </>
                    )}
                    <CoffeeIcon
                      ref={coffeeIconRef}
                      className="relative z-10"
                      size={23}
                      aria-hidden="true"
                    />
                    {hasUnreadNotifications && (
                      <span className="absolute -right-2 -top-2 z-20 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[10px] font-bold leading-none text-white" style={{
                        borderColor: 'var(--color-surface)',
                        backgroundColor: 'var(--color-danger)',
                        boxShadow: '0 4px 10px rgba(220, 38, 38, 0.35)'
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {isNotificationCenterOpen && <NotificationCenter onClose={() => setIsNotificationCenterOpen(false)} />}
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  aria-label="Abrir configuracion del proyecto"
                  onClick={() => navigateTo(APP_ROUTES.settings)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-primary)',
                    '--tw-ring-color': 'var(--color-primary)'
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--color-primary) 40%, transparent)';
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  }}
                >
                  <SettingsIcon size={22} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4 sm:p-6">
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
