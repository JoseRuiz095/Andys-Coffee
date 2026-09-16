import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ProductAPI, CategoryAPI } from '../api/product.api'
import type { CreateProductInput, UpdateProductInput } from '../types/product.types'
import { useState } from 'react'

export function useProducts(page = 1) {
  const [currentPage, setCurrentPage] = useState(page)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', currentPage],
    queryFn: () => ProductAPI.getAll(currentPage, 50),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateProductInput) => ProductAPI.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: UpdateProductInput) => ProductAPI.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ProductAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const setActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      ProductAPI.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  return {
    products: data?.products || [],
    total: data?.total || 0,
    loading: isLoading,
    error,
    page: currentPage,
    setPage: setCurrentPage,
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

export function useCategories() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: () => CategoryAPI.getAll(),
  })

  return {
    categories: data?.categories || [],
    loading: isLoading,
    error,
  }
}
