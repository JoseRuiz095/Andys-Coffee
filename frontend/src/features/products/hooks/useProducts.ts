import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ProductAPI, CategoryAPI } from '../api/product.api'
import type { CreateProductInput, UpdateProductInput } from '../types/product.types'
import { useState } from 'react'

export function useProducts(page = 1) {
  const [currentPage, setCurrentPage] = useState(page)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', currentPage, { search, categoryFilter, statusFilter }],
    queryFn: () =>
      ProductAPI.getAll(currentPage, 50, {
        categoryId: categoryFilter,
        isActive: statusFilter,
        search: search || undefined,
      }),
  })

  const createMutation = useMutation({
    mutationFn: ({ input, imageFile }: { input: CreateProductInput; imageFile?: File }) =>
      ProductAPI.create(input, imageFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ input, imageFile }: { input: UpdateProductInput; imageFile?: File }) =>
      ProductAPI.update(input, imageFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ProductAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      ProductAPI.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })

  return {
    products: data?.data || [],
    totalPages: data?.pagination?.totalPages ?? 0,
    total: data?.pagination?.total ?? 0,
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
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    setActive: setActiveMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isLoadingActive: setActiveMutation.isPending,
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

export function useCategories() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: () => CategoryAPI.getAll(1, 100, false),
  })

  const createMutation = useMutation({
    mutationFn: (input: Omit<any, 'id' | 'createdAt' | 'updatedAt'>) => CategoryAPI.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<any> }) => CategoryAPI.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => CategoryAPI.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })

  return {
    categories: data?.categories || [],
    loading: isLoading,
    error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    setActive: setActiveMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isLoadingActive: setActiveMutation.isPending,
  }
}
