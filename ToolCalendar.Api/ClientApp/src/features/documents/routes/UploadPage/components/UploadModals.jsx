/* eslint-disable */
import React from 'react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ReviewModal } from '../../components/ReviewModal'

export function UploadModals({
  showClearConfirm,
  setShowClearConfirm,
  executeClearBatch,
  showBulkDeleteConfirm,
  setShowBulkDeleteConfirm,
  selectedIds,
  setIsBulkDeleting,
  handleBulkDelete,
  setSelectedIds,
  deleteItemConfirm,
  setDeleteItemConfirm,
  handleDeleteItem,
  isReviewModalOpen,
  setIsReviewModalOpen,
  pdfBlobUrl,
  setPdfBlobUrl,
  reviewItem,
  setReviewItem,
  isPdfLoading,
  pdfPage,
  setPdfPage,
  departments,
  users,
  setBatchItems,
}) {
  return (
    <>
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false)
          if (pdfBlobUrl) {
            URL.revokeObjectURL(pdfBlobUrl)
            setPdfBlobUrl(null)
          }
        }}
        reviewItem={reviewItem}
        setReviewItem={setReviewItem}
        pdfBlobUrl={pdfBlobUrl}
        isPdfLoading={isPdfLoading}
        pdfPage={pdfPage}
        setPdfPage={setPdfPage}
        departments={departments}
        users={users}
        onSave={(updated) => {
          setBatchItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
          setIsReviewModalOpen(false)
        }}
      />

      <ConfirmationModal
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Hủy đợt tải?"
        description="Bạn có chắc chắn muốn hủy đợt bóc tách này? Tất cả dữ liệu chưa lưu sẽ bị xóa vĩnh viễn."
        confirmLabel="XÁC NHẬN HỦY"
        cancelLabel="QUAY LẠI"
        onConfirm={() => executeClearBatch(() => setShowClearConfirm(false))}
        variant="warning"
      />
      <ConfirmationModal
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        title={`Xóa ${selectedIds.size} văn bản?`}
        description={`Bạn sắp xóa vĩnh viễn ${selectedIds.size} văn bản đã chọn cùng toàn bộ file đính kèm. Hành động này không thể hoàn tác.`}
        confirmLabel={`XÓA ${selectedIds.size} VĂN BẢN`}
        cancelLabel="QUAY LẠI"
        onConfirm={() => {
          setIsBulkDeleting(true)
          handleBulkDelete(selectedIds, setSelectedIds, () => {
            setIsBulkDeleting(false)
            setShowBulkDeleteConfirm(false)
          })
        }}
        variant="destructive"
      />
      <ConfirmationModal
        open={deleteItemConfirm.open}
        onOpenChange={(open) => setDeleteItemConfirm((prev) => ({ ...prev, open }))}
        title="Xóa khỏi đợt tải?"
        description={`Bạn có chắc chắn muốn xóa văn bản "${deleteItemConfirm.item?.fileName}"?`}
        confirmLabel="XÓA NGAY"
        onConfirm={handleDeleteItem}
        variant="destructive"
      />
    </>
  )
}
