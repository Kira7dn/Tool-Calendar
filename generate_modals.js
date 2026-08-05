const fs = require('fs');
const lines = fs.readFileSync('/Users/macbookpro/.gemini/antigravity-ide/brain/4dc9b9e6-25a6-44b2-a4d3-bb6e765b49e1/scratch/DocDetail.jsx.bak', 'utf8').split('\n');
let modals = lines.slice(1049, 1428).join('\n');
let formField = lines.slice(1431, 1463).join('\n');
let content = `/* eslint-disable react/prop-types, no-unused-vars */
import React, { useState } from 'react';
import { X, Edit, FileText, ChevronLeft, ChevronRight, Maximize2, Calendar, Clock, Building2, Save, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import ConfirmationModal from '@/components/ConfirmationModal';
import { ForwardDocumentModal } from '@/components/ForwardDocumentModal';

${formField}

export function DocModals({
  docId, doc, setDoc,
  isEditModalOpen, setIsEditModalOpen, editForm, setEditForm, departments, users,
  isDeleteModalOpen, setIsDeleteModalOpen, executeDelete,
  isEvidenceModalOpen, setIsEvidenceModalOpen, fetchData,
  previewImage, setPreviewImage,
  isFullscreenPdf, setIsFullscreenPdf, pdfUrl,
  isForwardModalOpen, setIsForwardModalOpen, fetchRoutings, pdfPage, setPdfPage
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(\`/api/documents/\${docId}\`, {
        method: 'PUT',
        headers: { Authorization: \`Bearer \${localStorage.getItem('auth_token')}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (response.ok) { setDoc(editForm); setIsEditModalOpen(false); toast.success('Cập nhật văn bản thành công'); }
      else { toast.error('Có lỗi xảy ra khi lưu'); }
    } catch (error) { toast.error('Lỗi kết nối máy chủ'); }
    finally { setIsSaving(false); }
  };

  const handleSubmitEvidence = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('note', evidenceNote);
      evidenceFiles.forEach((f) => formData.append('files', f));
      const response = await fetch(\`/api/documents/\${docId}/evidence\`, {
        method: 'POST',
        headers: { Authorization: \`Bearer \${localStorage.getItem('auth_token')}\` },
        body: formData,
      });
      if (response.ok) { toast.success('Đã nộp kết quả xử lý thành công'); setIsEvidenceModalOpen(false); fetchData(); }
      else { toast.error('Có lỗi xảy ra khi lưu'); }
    } catch (error) { toast.error('Lỗi kết nối máy chủ'); }
    finally { setIsSaving(false); }
  };

  return (
    <>
${modals}
    </>
  );
}
`;
fs.writeFileSync('ToolCalendar.Api/ClientApp/src/documents/pages/DocDetail/components/DocModals.jsx', content);
console.log('Created DocModals.jsx');
