/* eslint-disable */
import React, { useMemo } from 'react'
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

// Tìm bản ghi routing của user (kết quả là record, không chỉ boolean)
const findUserRouting = (routingList, userId) => {
  if (!routingList || !Array.isArray(routingList)) return null
  for (const r of routingList) {
    if (r.receiverId === userId) return r
    if (r.children) {
      const found = findUserRouting(r.children, userId)
      if (found) return found
    }
  }
  return null
}

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
    isRejectModalOpen,
    setIsRejectModalOpen,
    rejectReason,
    setRejectReason,
    editForm,
    setEditForm,
    pdfPage,
    setPdfPage,
    isFullscreenPdf,
    setIsFullscreenPdf,
    fetchRoutings,
    fetchData,
    handleUpdateStatus,
    isUpdatingStatus,
    handleRejectRouting,
    executeDelete,
    handleViewEvidence,
    newComment,
    setNewComment,
    isSubmittingComment,
    handlePostComment,
    handleReact,
    fileInputRef,
    previewImage,
    setPreviewImage,
  } = useDocDetail(docId, onBack)

  const displayRoutings = useMemo(() => {
    // Root node (Văn thư tiếp nhận) — synthetic, chỉ là tiêu đề hiển thị
    const uploader = users?.find((u) => u.id === doc?.uploadedByUserId)
    const uploaderName = uploader?.fullName || 'Văn thư / Tiếp nhận'

    const rootNode = {
      id: 'synthetic-root-uploader',
      receiverName: uploaderName,
      receiverId: doc?.uploadedByUserId,
      role: 'Tiếp nhận',
      forwardDate: doc?.ngayThem,
      deadline: doc?.thoiHan,
      comment: '',
      processingContent: '',
      status:
        doc?.status === DOCUMENT_STATUS.DA_XU_LY
          ? 'Đã xử lý'
          : routings && routings.length > 0
            ? 'Đã chuyển tiếp'
            : doc?.status || 'Chưa xử lý',
      // Cây con lấy thẳng từ DB — không dùng synthetic node nữa
      children: routings || [],
    }

    return [rootNode]
  }, [routings, doc, users])

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
  const isAdmin = localStorage.getItem('user_role') === 'Admin'

  // Cấp 1: người upload (Văn thư/Admin)
  const isLevel1 = doc.uploadedByUserId == currentUserId
  // Cấp 2: là receiver trong routings thật từ DB (không phải Cấp 1)
  const isLevel2 = !isLevel1 && isUserInRoutings(routings, currentUserId)
  // Routing record cụ thể của user hiện tại (dùng để gọi API reject) — tìm trong routings thật
  const myRouting = isLevel2 ? findUserRouting(routings, currentUserId) : null

  const canInteract =
    doc.assignedTo == currentUserId ||
    doc.uploadedByUserId == currentUserId ||
    isUserInRoutings(routings, currentUserId) ||
    isAdmin

  const isLeafReceiver = (routingList, userId) => {
    if (!routingList || !Array.isArray(routingList) || routingList.length === 0) return false
    for (const r of routingList) {
      if (r.receiverId === userId && (!r.children || r.children.length === 0)) return true
      if (r.children && isLeafReceiver(r.children, userId)) return true
    }
    return false
  }

  // Leaf node, Văn thư (Level 1), Admin, hoặc người có vai trò Chủ trì đều được nộp bằng chứng và kết thúc
  const canSubmitEvidence =
    isLeafReceiver(displayRoutings, currentUserId) ||
    isLevel1 ||
    isAdmin ||
    (myRouting && myRouting.role === 'Chủ trì')
  // Chỉ Cấp 1 (và Admin) mới được chuyển xử lý — Cấp 2 bị khóa
  const canForward = (isLevel1 || isAdmin) && !isLevel2

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
          {isLevel2 &&
            myRouting &&
            (myRouting.status === 'Chưa xử lý' || myRouting.status === 'Đang xử lý') &&
            myRouting.status !== 'Từ chối' &&
            doc.status !== DOCUMENT_STATUS.DA_XU_LY &&
            doc.status !== 'Hoàn thành' &&
            !isUpdatingStatus && (
              <button
                onClick={() => setIsRejectModalOpen(true)}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black rounded-xl shadow-lg shadow-orange-500/20 transition-colors"
              >
                HỦY TIẾP NHẬN
              </button>
            )}

          {/* Nút TIẾP NHẬN XỬ LÝ — hiện khi doc chưa xử lý, HOẶC user Cấp 2 chưa tiếp nhận */}
          {((!isLevel2 &&
            (doc.status === DOCUMENT_STATUS.CHUA_XU_LY ||
              doc.status === DOCUMENT_STATUS.DA_RA_SOAT) &&
            canInteract) ||
            (isLevel2 && myRouting && myRouting.status === 'Chưa xử lý')) &&
            doc.status !== DOCUMENT_STATUS.DA_XU_LY && (
              <button
                onClick={() => handleUpdateStatus(DOCUMENT_STATUS.DANG_XU_LY)}
                disabled={isUpdatingStatus}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingStatus ? 'ĐANG XỬ LÝ...' : 'TIẾP NHẬN XỬ LÝ'}
              </button>
            )}

          {/* KẾT THÚC VĂN BẢN & BÁO CÁO ĐÃ XỬ LÝ — chỉ hiện khi doc Đang xử lý VÀ (user là Cấp 1 HOẶC user Cấp 2 đã tiếp nhận) */}
          {doc.status === DOCUMENT_STATUS.DANG_XU_LY &&
            canSubmitEvidence &&
            (!isLevel2 || (myRouting && myRouting.status === 'Đang xử lý')) && (
              <>
                <button
                  onClick={() => handleUpdateStatus(DOCUMENT_STATUS.DA_XU_LY)}
                  disabled={isUpdatingStatus}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingStatus ? 'ĐANG XỬ LÝ...' : 'KẾT THÚC VĂN BẢN'}
                </button>
                {!isUpdatingStatus &&
                  (!doc.evidencePaths || doc.evidencePaths === '[]') &&
                  (!doc.evidenceNotes || doc.evidenceNotes === '') && (
                    <button
                      onClick={() => setIsEvidenceModalOpen(true)}
                      disabled={isUpdatingStatus}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black rounded-xl shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      BÁO CÁO ĐÃ XỬ LÝ
                    </button>
                  )}
              </>
            )}

          {!isUpdatingStatus && (
            <button
              onClick={() => {
                const token = localStorage.getItem('auth_token')
                document.cookie = `jwt_cookie=${token}; path=/; max-age=3600; Secure; SameSite=Lax`
                // Mobile: mở fullscreen modal có nút X đóng
                // Desktop: mở tab mới
                if (window.innerWidth < 768) {
                  setIsFullscreenPdf(true)
                } else {
                  window.open(`/api/documents/${docId}/file`, '_blank')
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-xl shadow-lg shadow-red-600/20"
            >
              XEM PDF
            </button>
          )}
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
        <div className="flex-none lg:flex-1 flex flex-col min-h-0 min-w-0">
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
              displayRoutings={displayRoutings}
              fetchRoutings={fetchRoutings}
              setIsForwardModalOpen={setIsForwardModalOpen}
              canForward={canForward}
            />
          )}
          {activeTab === 'history' && <DocHistoryTab doc={doc} users={users} routings={routings} />}
        </div>

        {/* Right Panel */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col min-h-[500px] lg:h-full">
          <DocComments
            comments={comments}
            commentFiles={commentFiles}
            setCommentFiles={setCommentFiles}
            newComment={newComment}
            setNewComment={setNewComment}
            isSubmittingComment={isSubmittingComment}
            handlePostComment={handlePostComment}
            handleReact={handleReact}
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
        isRejectModalOpen={isRejectModalOpen}
        setIsRejectModalOpen={setIsRejectModalOpen}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        onConfirmReject={() => handleRejectRouting(myRouting?.id, rejectReason)}
      />
    </div>
  )
}
