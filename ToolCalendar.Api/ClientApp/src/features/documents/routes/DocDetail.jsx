/* eslint-disable */
import React from 'react'
import { DOCUMENT_STATUS } from '@/constants/document'
import { ArrowLeft, Loader2, FileText, ExternalLink, Edit, Trash2, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDocDetail } from './DocDetail/hooks/useDocDetail'
import { DocOverviewTab } from './DocDetail/components/DocOverviewTab'
import { DocContentTab } from './DocDetail/components/DocContentTab'
import { DocRoutingTab } from './DocDetail/components/DocRoutingTab'
import { DocHistoryTab } from './DocDetail/components/DocHistoryTab'
import { DocComments } from './DocDetail/components/DocComments'
import { DocModals } from './DocDetail/components/DocModals'

const isUserInRoutings = (routingList, userId) => {
  if (!routingList || !Array.isArray(routingList)) return false
  for (const r of routingList) {
    if (r.receiverId === userId) return true
    if (r.children && isUserInRoutings(r.children, userId)) return true
  }
  return false
}

export default function DocDetail({ docId, onBack }) {
  const {
    doc,
    setDoc,
    comments,
    isLoading,
    activeTab,
    setActiveTab,
    departments,
    users,
    routings,
    setCommentFiles,
    commentFiles,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    isForwardModalOpen,
    setIsForwardModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    isEvidenceModalOpen,
    setIsEvidenceModalOpen,
    editForm,
    setEditForm,
    pdfPage,
    setPdfPage,
    isFullscreenPdf,
    setIsFullscreenPdf,
    fetchRoutings,
    fetchData,
    handleUpdateStatus,
    executeDelete,
    handleViewEvidence,
    newComment,
    setNewComment,
    isSubmittingComment,
    handlePostComment,
    fileInputRef,
    previewImage,
    setPreviewImage,
  } = useDocDetail(docId, onBack)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="size-8 animate-spin text-red-600" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
          Đang tải chi tiết...
        </p>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="p-5 rounded-3xl bg-slate-100">
          <FileText className="size-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Không tìm thấy văn bản</h3>
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm"
        >
          Quay lại
        </button>
      </div>
    )
  }

  const tabs = [
    { key: 'overview', label: 'TỔNG QUAN' },
    { key: 'content', label: 'NỘI DUNG' },
    { key: 'routing', label: 'QUÁ TRÌNH XỬ LÝ' },
    { key: 'history', label: 'LỊCH SỬ' },
  ]

  const currentUserId = parseInt(localStorage.getItem('user_id'), 10)

  const canInteract =
    doc.assignedTo == currentUserId ||
    doc.uploadedByUserId == currentUserId ||
    isUserInRoutings(routings, currentUserId) ||
    localStorage.getItem('user_role') === 'Admin'

  const isLeafReceiver = (routingList, userId) => {
    if (!routingList || !Array.isArray(routingList) || routingList.length === 0) return false
    for (const r of routingList) {
      if (r.receiverId === userId && (!r.children || r.children.length === 0)) return true
      if (r.children && isLeafReceiver(r.children, userId)) return true
    }
    return false
  }

  const hasRoutings = routings && routings.length > 0
  const canSubmitEvidence = hasRoutings
    ? isLeafReceiver(routings, currentUserId)
    : doc.assignedTo == currentUserId

  const pdfUrl = `/api/documents/${docId}/file?access_token=${localStorage.getItem('auth_token')}#page=${pdfPage}&toolbar=0&navpanes=0`

  return (
    <div className="h-full font-sans flex flex-col gap-4 overflow-hidden px-2 pb-2">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 py-1">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl bg-white border hover:bg-slate-50">
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-900">{doc.soVanBan}</h1>
            <p className="text-[11px] font-bold text-slate-400 truncate max-w-[600px]">
              {doc.trichYeu}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          {(doc.status === DOCUMENT_STATUS.CHUA_XU_LY ||
            doc.status === DOCUMENT_STATUS.DA_RA_SOAT) &&
            canInteract && (
              <button
                onClick={() => handleUpdateStatus(DOCUMENT_STATUS.DANG_XU_LY)}
                className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl"
              >
                TIẾP NHẬN XỬ LÝ
              </button>
            )}

          {doc.status === DOCUMENT_STATUS.DANG_XU_LY && canSubmitEvidence && (
            <>
              <button
                onClick={() => handleUpdateStatus(DOCUMENT_STATUS.DA_HOAN_THANH)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-xl shadow-lg shadow-amber-500/20"
              >
                KẾT THÚC VĂN BẢN
              </button>
              <button
                onClick={() => setIsEvidenceModalOpen(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-xl shadow-lg shadow-green-600/20"
              >
                BÁO CÁO HOÀN THÀNH
              </button>
            </>
          )}

          <button
            onClick={() => {
              const token = localStorage.getItem('auth_token')
              document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
              window.open(`/api/documents/${docId}/file`, '_blank')
            }}
            className="px-3 py-2 bg-red-600 text-white text-[9px] font-black rounded-xl"
          >
            XEM PDF
          </button>
        </div>
      </div>

      {/* 2. Tabs */}
      <div className="flex border-b border-slate-200 bg-white/50 rounded-t-2xl px-2 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-[10px] font-black tracking-widest ${activeTab === tab.key ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-400'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Main Content */}
      <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-10 lg:pb-0">
        <div className="flex-none lg:flex-1 flex flex-col min-h-0">
          {activeTab === 'overview' && (
            <DocOverviewTab
              doc={doc}
              departments={departments}
              users={users}
              handleViewEvidence={handleViewEvidence}
            />
          )}
          {activeTab === 'content' && (
            <DocContentTab
              doc={doc}
              docId={docId}
              pdfUrl={pdfUrl}
              setIsFullscreenPdf={setIsFullscreenPdf}
            />
          )}
          {activeTab === 'routing' && (
            <DocRoutingTab
              doc={doc}
              routings={routings}
              fetchRoutings={fetchRoutings}
              setIsForwardModalOpen={setIsForwardModalOpen}
              canForward={canInteract}
              users={users}
            />
          )}
          {activeTab === 'history' && <DocHistoryTab doc={doc} users={users} routings={routings} />}
        </div>

        {/* Right Panel */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col h-[500px] lg:h-full">
          <DocComments
            comments={comments}
            commentFiles={commentFiles}
            setCommentFiles={setCommentFiles}
            newComment={newComment}
            setNewComment={setNewComment}
            isSubmittingComment={isSubmittingComment}
            handlePostComment={handlePostComment}
            fileInputRef={fileInputRef}
          />
        </div>
      </div>

      <DocModals
        docId={docId}
        doc={doc}
        setDoc={setDoc}
        isEditModalOpen={isEditModalOpen}
        setIsEditModalOpen={setIsEditModalOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        departments={departments}
        users={users}
        isDeleteModalOpen={isDeleteModalOpen}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        executeDelete={executeDelete}
        isEvidenceModalOpen={isEvidenceModalOpen}
        setIsEvidenceModalOpen={setIsEvidenceModalOpen}
        fetchData={fetchData}
        previewImage={previewImage}
        setPreviewImage={setPreviewImage}
        isFullscreenPdf={isFullscreenPdf}
        setIsFullscreenPdf={setIsFullscreenPdf}
        pdfUrl={pdfUrl}
        isForwardModalOpen={isForwardModalOpen}
        setIsForwardModalOpen={setIsForwardModalOpen}
        fetchRoutings={fetchRoutings}
        pdfPage={pdfPage}
        setPdfPage={setPdfPage}
      />
    </div>
  )
}
