/* eslint-disable react/prop-types, no-unused-vars */
import React from 'react'
import { X } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { ForwardDocumentModal } from '@/components/ForwardDocumentModal'
import { EditDocModal } from './EditDocModal'
import { SubmitEvidenceModal } from './SubmitEvidenceModal'

export function DocModals({
  docId,
  setDoc,
  isEditModalOpen,
  setIsEditModalOpen,
  editForm,
  setEditForm,
  departments,
  users,
  isDeleteModalOpen,
  setIsDeleteModalOpen,
  executeDelete,
  isEvidenceModalOpen,
  setIsEvidenceModalOpen,
  fetchData,
  previewImage,
  setPreviewImage,
  isFullscreenPdf,
  setIsFullscreenPdf,
  pdfUrl,
  isForwardModalOpen,
  setIsForwardModalOpen,
  fetchRoutings,
  pdfPage,
  setPdfPage,
}) {
  return (
    <>
      <EditDocModal
        docId={docId}
        setDoc={setDoc}
        isEditModalOpen={isEditModalOpen}
        setIsEditModalOpen={setIsEditModalOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        departments={departments}
        users={users}
        pdfPage={pdfPage}
        setPdfPage={setPdfPage}
      />

      <ForwardDocumentModal
        isOpen={isForwardModalOpen}
        onClose={() => setIsForwardModalOpen(false)}
        documentId={docId}
        parentRoutingId={null} // TODO: pass correct parent ID if replying to a specific routing
        onForwardSuccess={() => {
          fetchRoutings()
          fetchData()
        }}
      />

      <SubmitEvidenceModal
        docId={docId}
        isEvidenceModalOpen={isEvidenceModalOpen}
        setIsEvidenceModalOpen={setIsEvidenceModalOpen}
        fetchData={fetchData}
      />

      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all border border-white/20"
          >
            <X size={24} />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full rounded-2xl shadow-2xl animate-in zoom-in-95 duration-500 border-4 border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ConfirmationModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Xác nhận xóa văn bản?"
        description="Bạn có chắc chắn muốn xóa văn bản này không? Thao tác này sẽ xóa vĩnh viễn dữ liệu và các tệp đính kèm liên quan."
        confirmLabel="XÓA NGAY"
        onConfirm={executeDelete}
        variant="destructive"
      />

      {isFullscreenPdf && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              XEM TOÀN MÀN HÌNH
            </h3>
            <button
              onClick={() => setIsFullscreenPdf(false)}
              className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden bg-slate-100">
            <iframe
              src={pdfUrl}
              className="w-full h-full border-none"
              title="Fullscreen PDF Viewer"
            />
          </div>
        </div>
      )}
    </>
  )
}
