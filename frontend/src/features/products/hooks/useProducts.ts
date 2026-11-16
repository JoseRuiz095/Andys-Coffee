import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sileo } from 'sileo'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { getErrorMessage } from '../../../shared/utils/errors'
import { ProductAPI, CategoryAPI, ProductFamilyAPI } from '../api/product.api'
import type { CreateProductInput, UpdateProductInput } from '../types/product.types'
import { useState } from 'react'

const PRODUCTS_PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300

export function useProducts(page = 1) {
  const [currentPage, setCurrentPage] = useState(page)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>()
  const queryClient = useQueryClient()
  // One request once the user stops typing, not one per keystroke.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', currentPage, { search: debouncedSearch, categoryFilter, statusFilter }],
    queryFn: () =>
      ProductAPI.getAll(currentPage, PRODUCTS_PAGE_SIZE, {
        categoryId: categoryFilter,
        isActive: statusFilter,
        search: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  })

  const createMutation = useMutation({
    mutationFn: ({ input }: { input: CreateProductInput }) => ProductAPI.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products-without-recipe'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ input }: { input: UpdateProductInput }) => ProductAPI.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products-without-recipe'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ProductAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products-without-recipe'] })
    },
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      ProductAPI.setActive(id, isActive),
    onSuccess: (_data, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products-without-recipe'] })
      sileo.success({ title: isActive ? 'Producto activado' : 'Producto desactivado' })
    },
    // No caller handles it: without this a failed toggle was silent.
    onError: (error: unknown) => {
      sileo.error({ title: 'No se pudo cambiar el estado', description: getErrorMessage(error, 'Inténtalo de nuevo.') })
    },
  })

  return {
    products: data?.data || [],
    totalPages: data?.pagination?.totalPages ?? 0,
    total: data?.pagination?.total ?? 0,
    pageSize: data?.pagination?.limit ?? PRODUCTS_PAGE_SIZE,
    loading: isLoading,
    error,
    page: currentPage,
    setPage: setCurrentPage,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    setActive: setActiveMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isLoadingActive: setActiveMutation.isPending,
    /** Product whose active state is being changed (only that row shows it as busy). */
    togglingProductId: setActiveMutation.isPending ? setActiveMutation.variables?.id ?? null : null,
  }
}

/** Upload/replace and removal of a product's image; both refresh the catalog and the POS menu. */
export function useProductImage() {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['menu'] })
  }

  const upload = useMutation({
    mutationFn: ({ productId, file }: { productId: string; file: File }) => ProductAPI.uploadImage(productId, file),
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: (productId: string) => ProductAPI.removeImage(productId),
    onSuccess: refresh,
  })

  return {
    uploadAsync: upload.mutateAsync,
    removeAsync: remove.mutateAsync,
    isUploading: upload.isPending,
    isRemoving: remove.isPending,
  }
}

/** Product detail (incl. recipe-based suggested cost); disabled until an id is given. */
export function useProductDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => ProductAPI.getById(id!),
    enabled: Boolean(id),
  })
}

/** POS families (Latte, Chilaquiles…) to group products; creating one refreshes the list. */
export function useProductFamilies(enabled = true) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['product-families'], queryFn: () => ProductFamilyAPI.getAll(), enabled })
  const create = useMutation({
    mutationFn: (input: Parameters<typeof ProductFamilyAPI.create>[0]) => ProductFamilyAPI.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-families'] })
    },
  })
  return { families: query.data ?? [], isLoading: query.isLoading, createAsync: create.mutateAsync, isCreating: create.isPending }
}

/** `includeInactive` is for the category manager; pickers and filters only need the active ones. */
export function useCategories(options: { includeInactive?: boolean } = {}) {
  const includeInactive = options.includeInactive ?? false
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['categories', { includeInactive }],
    queryFn: () => CategoryAPI.getAll(1, 100, includeInactive),
  })

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof CategoryAPI.create>[0]) => CategoryAPI.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products-without-recipe'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof CategoryAPI.update>[1] }) => CategoryAPI.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products-without-recipe'] })
    },
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => CategoryAPI.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products-without-recipe'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => CategoryAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'products-without-recipe'] })
    },
  })

  return {
    categories: data?.categories || [],
    loading: isLoading,
    error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    setActive: setActiveMutation.mutate,
    remove: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isLoadingActive: setActiveMutation.isPending,
    /** Product whose active state is being changed (only that row shows it as busy). */
    togglingProductId: setActiveMutation.isPending ? setActiveMutation.variables?.id ?? null : null,
    isDeleting: deleteMutation.isPending,
  }
}
