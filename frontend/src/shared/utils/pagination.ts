/**
 * Up to `size` consecutive page numbers around the current page, always `size` long when there
 * are enough pages (the previous copies showed only 3 numbers on the last pages).
 */
export function getPageWindow(page: number, totalPages: number, size = 5): number[] {
  if (totalPages <= 0) return []
  const length = Math.min(size, totalPages)
  const start = Math.min(Math.max(1, page - Math.floor(size / 2)), totalPages - length + 1)
  return Array.from({ length }, (_, index) => start + index)
}

/** "a–b" range of the rows shown on the current page. */
export function getRowRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 }
  const from = (page - 1) * pageSize + 1
  return { from: Math.min(from, total), to: Math.min(page * pageSize, total) }
}
