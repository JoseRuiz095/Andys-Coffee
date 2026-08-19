import { Skeleton } from '../../../shared/components/Skeleton'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'
import { OrderListSection } from '../components/OrderListSection'
import { MenuSection } from '../../menu/components/MenuSection'
import { OrderDetailsPanel } from '../components/OrderDetailsPanel'
import { authStore } from '../../auth/store/auth.store'
import type { AuthUser } from '../../auth/types/auth.types'
import React from 'react'
import { CoffeeIcon } from '../../../components/ui/coffee'
import type { CoffeeIconHandle } from '../../../components/ui/coffee'
import { SettingsIcon } from '../../../components/ui/settings'
import { APP_ROUTES } from '../../../shared/constants/routes'
import type { OrderItem } from '../types/order.types'
import type { MenuItem } from '../../menu/types/menu.types'
import { useMenu } from '../../menu/hooks/useMenu'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function DashboardPage() {
  const [isLoading] = React.useState(false) // Keep this if OrderListSection still uses it
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>()
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(authStore.getState().user)
  const [hasUnreadNotifications, setHasUnreadNotifications] = React.useState(true)
  const [activeView, setActiveView] = React.useState('Venta')
  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
  const [orderNotes, setOrderNotes] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState<string | undefined>()
  const isInitialCategorySet = React.useRef(false)
  const coffeeIconRef = React.useRef<CoffeeIconHandle>(null)

  const { data: menuData, isLoading: isMenuLoading, isError, error } = useMenu()
  // The category names for the tabs can be derived from the fetched data
  const categoryNames = React.useMemo(() => menuData?.map((c) => c.name) ?? [], [menuData])

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

  const handleAddToOrder = (product: MenuItem, quantity: number) => {
    setOrderItems((prevItems) => {
      const existingItemWithoutNote = prevItems.find(
        (item) => item.productId === product.id && !item.note,
      );

      if (existingItemWithoutNote) {
        return prevItems.map((item) =>
          item.id === existingItemWithoutNote.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [
        ...prevItems,
        {
          id: crypto.randomUUID(),
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: product.price,
          image: product.imageUrl ?? brandLogo,
        },
      ];
    });
  };

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    setOrderItems((prevItems) => {
      if (newQuantity <= 0) {
        return prevItems.filter((item) => item.id !== itemId)
      }
      return prevItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item,
      )
    })
  }

  const handleRemoveItem = (itemId: string) => {
    setOrderItems((prevItems) => {
      return prevItems
        .map((item) => {
          if (item.id === itemId) {
            if (item.quantity > 1) {
              return { ...item, quantity: item.quantity - 1 };
            }
            return null; // Mark for removal
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]; // Filter out nulls
    });
  };

  const handleUpdateItemNote = (itemId: string, note: string) => {
    setOrderItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, note } : item
      )
    );
  };

  const handleNotesChange = (notes: string) => {
    setOrderNotes(notes);
  };

  const handleClearOrder = () => {
    setOrderItems([])
    setOrderNotes('')
  }

  const subtotal = React.useMemo(() => orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [orderItems])
  const tax = subtotal * 0.16
  const total = subtotal + tax

  const displayName = currentUser?.name ?? 'Usuario'
  const rawRoleName = currentUser?.roleName ?? currentUser?.roleId ?? ''
  const roleLabel = rawRoleName.toUpperCase() === 'ADMIN'
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#FCF8EF_0%,_#F7F2E8_100%)]">
      <header className="border-b border-[#E7E3DC] bg-[#FDFBF7]/95 px-4 py-4 shadow-[0_8px_30px_rgba(45,33,29,0.05)] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-6 w-24" />
              </>
            ) : (
              <>
                <div className="flex h-15 w-15 items-center justify-center rounded-2xl border border-[#E7E3DC] bg-[#F3E8D6] p-2 shadow-sm">
                  <img src={brandLogo} alt="Andys Coffee" className="h-8 w-auto object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#2C211D]">{displayName}</div>
                  <div className="text-xs text-[#6B7280]">{roleLabel}</div>
                </div>
              </>
            )}
          </div>

          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-[#E7E3DC] bg-white/80 px-3 py-2 shadow-sm sm:gap-3">
            {['Venta', 'Dashboard', 'Ordenes', 'Inventario', 'Administracion'].map((item) =>
              isLoading ? (
                <Skeleton key={item} className="h-4 w-20" />
              ) : (
                <button
                  key={item}
                  onClick={() => setActiveView(item)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${activeView === item ? 'bg-[#5A804F] text-white shadow-sm' : 'text-[#4B5563] hover:bg-[#F2EFE8] hover:text-[#5A804F]'}`}
                >
                  {item}
                </button>
              ),
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </>
            ) : (
              <>
                <button
                  type="button"
                  aria-label="Abrir notificaciones del proyecto"
                  onClick={() => setHasUnreadNotifications(false)}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#5A804F]/25 ${
                    hasUnreadNotifications
                      ? 'border-[#C78234] bg-[#FFF4DC] text-[#8A4E18] shadow-[0_0_0_4px_rgba(199,130,52,0.14),0_10px_24px_rgba(138,78,24,0.18)] hover:bg-[#FFE8B8]'
                      : 'border-[#E7E3DC] bg-white text-[#5A804F] hover:border-[#5A804F]/40 hover:bg-[#F2EFE8]'
                  }`}
                >
                  {hasUnreadNotifications && (
                    <>
                      <span className="absolute inset-0 rounded-full border-2 border-[#C78234]/50 animate-ping" />
                      <span className="absolute -inset-1.5 rounded-full border border-[#C78234]/30" />
                    </>
                  )}
                  <CoffeeIcon ref={coffeeIconRef} className="relative z-10" size={23} aria-hidden="true" />
                  {hasUnreadNotifications && (
                    <span className="absolute -right-2 -top-2 z-20 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#FDFBF7] bg-[#C83232] px-1 text-[10px] font-bold leading-none text-white shadow-[0_4px_10px_rgba(200,50,50,0.35)]">
                      1
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Abrir configuracion del proyecto"
                  onClick={() => navigateTo(APP_ROUTES.settings)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E7E3DC] bg-white text-[#5A804F] shadow-sm transition hover:border-[#5A804F]/40 hover:bg-[#F2EFE8] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/25"
                >
                  <SettingsIcon size={22} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-6 rounded-[1.75rem] border border-[#E7E3DC] bg-[#FDFBF7] p-5 shadow-[0_20px_50px_rgba(45,33,29,0.06)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#5A804F]">Operación del día</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#2C211D]">Gestiona órdenes y productos con una vista más clara</h2>
            </div>
            <div className="rounded-full border border-[#E7E3DC] bg-[#F2EFE8] px-3 py-1.5 text-sm text-[#4B5563]">
              {roleLabel}
            </div>
          </div>
        </div>

        {activeView === 'Venta' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[56fr_44fr]">
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
              items={orderItems}
              subtotal={subtotal}
              tax={tax}
              total={total}
              orderNotes={orderNotes}
              onNotesChange={handleNotesChange}
              onRemoveItem={handleRemoveItem}
              onClearOrder={handleClearOrder}
              onUpdateItemNote={handleUpdateItemNote} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr_320px]">
            {/* LEFT: Order List */}
            <OrderListSection // This component still uses isLoading
              isLoading={isLoading}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
            />

            {/* CENTER: Menu & Products */}
            <MenuSection
              menu={menuData} // This should be filtered based on a state
              isLoading={isMenuLoading} // This is correct
              categoryNames={categoryNames}
              onAddToOrder={handleAddToOrder}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />

            {/* RIGHT: Order Details & Summary */}
            <OrderDetailsPanel isLoading={isLoading} />
          </div>
        )}
      </div>
    </div>
  )
}
