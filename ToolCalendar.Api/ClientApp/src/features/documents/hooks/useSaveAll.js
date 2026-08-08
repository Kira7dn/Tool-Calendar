// features/documents/hooks/useSaveAll.js
// Logic lưu hàng loạt (concurrent 10 requests) và bulk delete
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DOCUMENT_STATUS } from '@/constants/document'

export function useSaveAll({ batchItems, setBatchItems }) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveAll = useCallback(async () => {
    const targets = batchItems.filter((item) => item.status === 'ready' || item.status === 'review')
    if (targets.length === 0) return

    setIsSaving(true)
    let successCount = 0
    let failCount = 0

    const saveOne = async (item) => {
      try {
        const response = await fetch(`/api/documents/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: item.id,
            soVanBan: item.soVanBan,
            trichYeu: item.trichYeu,
            coQuanBanHanh: item.coQuanBanHanh,
            coQuanChuQuan: item.coQuanChuQuan,
            ngayBanHanh: item.ngayBanHanh ? `${item.ngayBanHanh}T00:00:00` : null,
            thoiHan: item.thoiHan ? `${item.thoiHan}T00:00:00` : null,
            filePath: item.filePath,
            status: DOCUMENT_STATUS.CHUA_XU_LY,
            departmentId: item.departmentIds?.[0] || null,
            assignedTo: item.assignedToIds?.[0] || null,
            assignedDepartmentIds: JSON.stringify(item.departmentIds || []),
            assignedUserIds: JSON.stringify(item.assignedToIds || []),
          }),
        })
        if (response.ok) {
          successCount++
          setBatchItems((prev) => prev.filter((i) => i.id !== item.id))
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    // Song song 10 requests — 1000 file từ ~50s xuống ~5s
    const saveQueue = [...targets]
    const workers = Array.from({ length: 10 }, async () => {
      while (saveQueue.length > 0) {
        const item = saveQueue.shift()
        if (item) await saveOne(item)
      }
    })
    await Promise.all(workers)

    setIsSaving(false)
    if (successCount > 0) toast.success(`Đã lưu thành công ${successCount} văn bản`)
    if (failCount > 0) toast.error(`Có ${failCount} văn bản lưu thất bại. Vui lòng thử lại.`)
  }, [batchItems, setBatchItems])

  const handleBulkDelete = useCallback(
    async (selectedIds, setSelectedIds, onDone) => {
      const ids = Array.from(selectedIds).filter((id) => typeof id === 'number')
      if (ids.length === 0) return

      try {
        const response = await fetch('/api/documents/bulk-delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ids),
        })
        if (response.ok) {
          setBatchItems((prev) => prev.filter((i) => !selectedIds.has(i.id)))
          setSelectedIds(new Set())
          toast.success(`Đã xóa ${ids.length} văn bản thành công.`)
        } else {
          toast.error('Xóa thất bại, vui lòng thử lại.')
        }
      } catch {
        toast.error('Lỗi kết nối khi xóa.')
      } finally {
        if (onDone) onDone()
      }
    },
    [setBatchItems]
  )

  const executeClearBatch = useCallback(
    async (onDone) => {
      const ids = batchItems.filter((i) => typeof i.id === 'number').map((i) => i.id)
      if (ids.length > 0) {
        try {
          await fetch('/api/documents/bulk-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ids),
          })
        } catch (e) {
          console.error(e)
        }
      }
      setBatchItems([])
      if (onDone) onDone()
      toast.success('Đã hủy đợt tải và xóa các tài liệu nháp')
    },
    [batchItems, setBatchItems]
  )

  return { isSaving, handleSaveAll, handleBulkDelete, executeClearBatch }
}
