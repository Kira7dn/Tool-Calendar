/* eslint-disable */
import React from 'react'
import { ArrowLeft, Loader2, FileText, ExternalLink, Edit, Trash2, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDocDetail } from './hooks/useDocDetail'
import { DocOverviewTab } from './components/DocOverviewTab'
import { DocContentTab } from './components/DocContentTab'
import { DocRoutingTab } from './components/DocRoutingTab'
import { DocHistoryTab } from './components/DocHistoryTab'
import { DocComments } from './components/DocComments'
import { ForwardDocumentModal } from '@/components/ForwardDocumentModal'

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
    pdfPage,
    isFullscreenPdf,
    setIsFullscreenPdf,
    fetchRoutings,
    handleUpdateStatus,
    executeDelete,
    handleViewEvidence,
    newComment,
    setNewComment,
    isSubmittingComment,
    handlePostComment,
    fileInputRef,
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

  const pdfUrl = `/api/documents/${docId}/file#page=${pdfPage}&toolbar=0&navpanes=0`

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
          {doc.status === 'Chưa xử lý' &&
            (doc.assignedTo === localStorage.getItem('user_id') ||
              isUserInRoutings(routings, localStorage.getItem('user_id'))) && (
              <button
                onClick={() => handleUpdateStatus('Đang xử lý')}
                className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl"
              >
                TIẾP NHẬN XỬ LÝ
              </button>
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

      {isForwardModalOpen && (
        <ForwardDocumentModal
          isOpen={isForwardModalOpen}
          onClose={() => setIsForwardModalOpen(false)}
          documentId={docId}
          onSuccess={fetchRoutings}
        />
      )}
    </div>
  )
}
