import { AnimatePresence, motion } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'
import { MenuSection } from '../../menu/components/MenuSection'
import { OrderDetailsPanel } from '../components/OrderDetailsPanel'
import { authStore } from '../../auth/store/auth.store'
import type { AuthUser } from '../../auth/types/auth.types'
import { hasPermission } from '../../auth/utils/permissions'
import React from 'react'
import { CoffeeIcon } from '../../../components/ui/coffee'
import type { CoffeeIconHandle } from '../../../components/ui/coffee'
import { SettingsIcon } from '../../../components/ui/settings'
import { APP_ROUTES } from '../../../shared/constants/routes'
import type { OrderItem } from '../types/order.types'
import type { MenuItem } from '../../menu/types/menu.types'
import { useMenu } from '../../menu/hooks/useMenu'
import { useCreateOrder } from '../hooks/useCreateOrder'
import { useNotifications } from '../hooks/useNotifications'
import { OrdersPage } from '../../orders/pages/OrdersPage'
import { InventoryLayout } from '../../inventory'
import { ProductsCatalogPage } from '../../products'
import { NotificationCenter } from '../components/NotificationCenter'
import { CashOpeningPanel } from '../components/CashOpeningPanel'
import { CashPaymentDialog } from '../components/CashPaymentDialog'
import { CashClosingDialog } from '../components/CashClosingDialog'
import { useCashSession } from '../hooks/useCashSession'
import axios from 'axios'

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string; errors?: unknown }>(error)) {
    const data = error.response?.data
    if (data?.errors) {
      const details = typeof data.errors === 'string' ? data.errors : JSON.stringify(data.errors)
      return `${data.message ?? 'Error de validación.'}: ${details}`
    }
    return data?.message ?? error.message
  }
  return error instanceof Error ? error.message : fallback
}

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

export function DashboardPage() {
  const [isLoading] = React.useState(false)
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(
    authStore.getState().user,
  )
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] =
    React.useState(false)
  const [activeView, setActiveView] = React.useState('Venta')
  const prevActiveView = usePrevious(activeView)

  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([])
  const [orderNotes, setOrderNotes] = React.useState('')
  const [customerName, setCustomerName] = React.useState('')
  const [paymentMethod, setPaymentMethod] = React.useState<string>()
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
    { label: 'Administracion', requiredPermission: 'users.read' },
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
    const orderPayload = {
      customerName: customerName || 'Cliente',
      notes: orderNotes,
      cashSessionId: cashSession?.id,
      paymentMethod: paymentMethod!,
      cashReceived,
      items: orderItems.map(
        ({ productId, comboId, quantity, note, type }) => ({
          productId: type === 'product' ? productId : undefined,
          comboId: type === 'combo' ? comboId : undefined,
          quantity,
          note,
        }),
      ),
    }

    createOrder(orderPayload, {
      onSuccess: () => {
        setIsCashPaymentOpen(false)
        handleClearOrder()
        sileo.success({ title: 'Orden creada exitosamente.', duration: 3000 })
      },
      onError: (error) => {
        sileo.error({
          title: 'Algo salio mal',
          description: getApiErrorMessage(error, 'No se pudo registrar la venta.'),
        })
      },
    })
  }

  const handleProcessOrder = () => {
    if (orderItems.length === 0) {
      sileo.error({
        title: 'Algo salio mal',
        description: 'Intentalo mas tarde.',
      })
      return
    }

    if (!paymentMethod) {
      sileo.error({
        title: 'Algo salio mal',
        description: 'Por favor, seleccione un método de pago.',
      })
      return
    }

    if (paymentMethod === 'Efectivo' || paymentMethod === 'cash') {
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

  const handleAddToOrder = (menuItem: MenuItem, quantity: number) => {
    setOrderItems((prevItems) => {
      const key = menuItem.type === 'product' ? 'productId' : 'comboId'
      const existingItemWithoutNote = prevItems.find(
        (item) => item[key] === menuItem.id && !item.note,
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
        quantity,
        unitPrice: menuItem.price,
        image: menuItem.imageUrl ?? brandLogo,
        type: menuItem.type,
      }

      if (menuItem.type === 'product') {
        newOrderItem.productId = menuItem.id
      } else {
        newOrderItem.comboId = menuItem.id
      }

      return [...prevItems, newOrderItem]
    })
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

  const handleUpdateItemNote = (itemId: string, note: string) => {
    setOrderItems((prevItems) => {
      const itemIndex = prevItems.findIndex((item) => item.id === itemId)
      if (itemIndex === -1) return prevItems

      const itemToUpdate = prevItems[itemIndex]

      // If quantity is 1, just update the note.
      if (itemToUpdate.quantity === 1) {
        return prevItems.map((item) =>
          item.id === itemId ? { ...item, note } : item,
        )
      }

      // If item already has the same note, do nothing to prevent splitting again.
      if (itemToUpdate.note === note) {
        return prevItems
      }

      // If quantity > 1, split the item.
      const updatedItems = [...prevItems]
      // Decrease quantity of the original item
      updatedItems[itemIndex] = {
        ...itemToUpdate,
        quantity: itemToUpdate.quantity - 1,
      }

      // Add a new item with the note
      const newItemWithNote: OrderItem = {
        ...itemToUpdate,
        id: crypto.randomUUID(), // New unique ID
        quantity: 1,
        note,
      }

      // Check if an item with the same note already exists
      const existingItemWithSameNote = prevItems.find(
        (item) =>
          item.productId === newItemWithNote.productId && item.note === note,
      )

      if (existingItemWithSameNote) {
        // If it exists, just increase its quantity
        return updatedItems.map((item) =>
          item.id === existingItemWithSameNote.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      } else {
        // Otherwise, add the new item
        return [...updatedItems, newItemWithNote]
      }
    })
  }

  const handleNotesChange = (notes: string) => {
    setOrderNotes(notes)
  }

  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name)
  }

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method)
  }

  const handleClearOrder = () => {
    setOrderItems([])
    setOrderNotes('')
    setCustomerName('')
    setPaymentMethod(undefined)
  }

  const subtotal = React.useMemo(
    () =>
      orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [orderItems],
  )
  const total = subtotal

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
                  openSession.mutate(openingAmount, {
                    onSuccess: () => {
                      sileo.success({ title: 'Caja abierta correctamente.', duration: 3000 })
                    },
                    onError: (error) => {
                      sileo.error({
                        title: 'No se pudo abrir la caja',
                        description: getApiErrorMessage(error, 'Inténtalo de nuevo.'),
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
                isLoading={isCreatingOrder}
                items={orderItems}
                subtotal={subtotal}
                total={total}
                orderNotes={orderNotes}
                customerName={customerName}
                paymentMethod={paymentMethod}
                onNotesChange={handleNotesChange}
                onCustomerNameChange={handleCustomerNameChange}
                onPaymentMethodChange={handlePaymentMethodChange}
                onRemoveItem={handleRemoveItem}
                onClearOrder={handleClearOrder}
                onUpdateItemNote={handleUpdateItemNote}
                onProcessTransaction={handleProcessOrder}
              />
              <CashPaymentDialog
                key={isCashPaymentOpen ? 'cash-payment-open' : 'cash-payment-closed'}
                open={isCashPaymentOpen}
                total={total}
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
            <OrdersPage />
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
            <InventoryLayout />
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
            <ProductsCatalogPage />
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
          closeSession.mutate(input, {
            onSuccess: () => {
              setIsCashClosingOpen(false)
              sileo.success({ title: 'Caja cerrada correctamente.', duration: 3000 })
            },
            onError: (error) => sileo.error({ title: 'No se pudo cerrar la caja', description: getApiErrorMessage(error, 'Inténtalo de nuevo.') }),
          })
        }}
      />
    </div>
  )
}
