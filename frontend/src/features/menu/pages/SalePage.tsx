import { useMenu } from '../hooks/useMenu'
import type { MenuCategory, MenuItem } from '../types/menu.types'

// --- Componentes de UI (Estos podrían estar en /components) ---

const Loader = () => (
  <div className="flex h-screen items-center justify-center">
    <p className="text-lg font-semibold">Cargando productos...</p>
  </div>
)

const ErrorMessage = ({ message }: { message: string }) => (
  <div className="m-4 rounded-lg border border-red-400 bg-red-100 p-8 text-center text-red-700">
    <p className="font-bold">¡Ha ocurrido un error!</p>
    <p>{message}</p>
  </div>
)

const ProductCard = ({ product }: { product: MenuItem }) => (
  <div className="transform cursor-pointer rounded-lg border p-4 shadow-md transition-shadow hover:shadow-lg">
    <h3 className="text-xl font-bold">{product.name}</h3>
    {product.description && <p className="text-gray-600">{product.description}</p>}
    <p className="mt-2 text-lg font-semibold">${product.price}</p>
  </div>
)

const ProductGrid = ({ categories }: { categories: MenuCategory[] }) => {
  if (!categories || categories.length === 0) {
    return <p className="p-8 text-center">No hay productos disponibles en este momento.</p>
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <div key={category.id}>
          <h2 className="mb-4 border-b pb-2 text-2xl font-bold">{category.name}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {category.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export const SalePage = () => {
  // 1. Usamos nuestro hook para obtener el estado completo de la petición.
  const { data: menuData, isLoading, isError, error } = useMenu()

  // 2. Manejamos el estado de carga (loading).
  if (isLoading) {
    return <Loader />
  }

  // 3. Manejamos el estado de error.
  if (isError) {
    // Tu función `getLoginErrorMessage` es un buen modelo para crear una
    // utilidad que formatee mensajes de error de Axios de forma centralizada.
    return <ErrorMessage message={error.message} />
  }

  // 4. Si todo está bien (isSuccess), mostramos los productos.
  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-3xl font-bold">Punto de Venta</h1>
      <ProductGrid categories={menuData ?? []} />
    </div>
  )
}