import React, { useRef } from 'react'
import { cn } from '../../../lib/utils'

const UploadCloudIcon = () => (
  <svg
    width={40}
    height={40}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-blue-400"
  >
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
)

const FileIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const FolderIcon = () => (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

export function UploadDropzone({ isDragging, setIsDragging, handleFileUpload }) {
  const inputRef = useRef(null)
  const folderInputRef = useRef(null)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files).filter((f) =>
          f.name.toLowerCase().endsWith('.pdf')
        )
        handleFileUpload(files)
      }}
      className={cn(
        'rounded-xl border-2 border-dashed p-5 flex flex-col items-center gap-3 cursor-pointer transition-all',
        isDragging
          ? 'border-blue-400 bg-blue-50'
          : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-blue-50/40'
      )}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf"
        className="hidden"
        onChange={(e) => handleFileUpload(Array.from(e.target.files))}
      />
      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
          isDragging ? 'bg-blue-100' : 'bg-slate-50'
        )}
      >
        <UploadCloudIcon />
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-slate-700">Tải tệp tin lên</p>
        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
          Kéo thả tệp PDF vào đây
          <br />
          hoặc nhấn để chọn file
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full mt-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.click()
          }}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200"
        >
          <FileIcon /> Chọn tệp tin
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            folderInputRef.current?.click()
          }}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:bg-slate-50 transition-colors"
        >
          <FolderIcon /> Tải cả thư mục
        </button>
        <input
          type="file"
          ref={folderInputRef}
          className="hidden"
          webkitdirectory="true"
          directory="true"
          multiple
          onChange={(e) => handleFileUpload(Array.from(e.target.files))}
        />
      </div>
    </div>
  )
}
