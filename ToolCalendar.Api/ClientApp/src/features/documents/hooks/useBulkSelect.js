/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
// features/documents/hooks/useBulkSelect.js
// Logic chọn nhiều rows trong bảng (select-all, toggle, indeterminate)

export function useBulkSelect(items) {
  const [selectedIds, setSelectedIds] = useState(new Set())

  const selectableItems = useMemo(() => items.filter((i) => typeof i.id === 'number'), [items])

  const isAllSelected =
    selectableItems.length > 0 && selectableItems.every((i) => selectedIds.has(i.id))

  const isIndeterminate = !isAllSelected && selectableItems.some((i) => selectedIds.has(i.id))

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableItems.map((i) => i.id)))
    }
  }, [isAllSelected, selectableItems])

  const toggleSelectOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  return {
    selectedIds,
    setSelectedIds,
    isAllSelected,
    isIndeterminate,
    toggleSelectAll,
    toggleSelectOne,
    clearSelection,
  }
}
