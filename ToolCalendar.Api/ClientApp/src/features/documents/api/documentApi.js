export const documentApi = {
  uploadFile: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Lỗi tải lên')
    }
    return res.json()
  },

  getDocument: async (docId) => {
    const res = await fetch(`/api/documents/${docId}`)
    if (!res.ok) throw new Error('Không thể lấy thông tin văn bản')
    return res.json()
  },

  updateDocument: async (docId, data) => {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Cập nhật thất bại')
    return res.json()
  },

  bulkDelete: async (ids) => {
    const res = await fetch('/api/documents/bulk-delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
    })
    if (!res.ok) throw new Error('Xóa thất bại')
    return res.json()
  },

  reactToComment: async (docId, commentId, reactionType) => {
    const res = await fetch(`/api/documents/${docId}/comments/${commentId}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reactionType }),
    })
    if (!res.ok) throw new Error('Không thể thả cảm xúc')
    return res.json()
  },

  getReferenceData: async () => {
    const [deptRes, userRes] = await Promise.all([
      fetch('/api/admin/departments'),
      fetch('/api/users'),
    ])
    const departments = deptRes.ok ? await deptRes.json() : []
    const users = userRes.ok ? await userRes.json() : []
    return { departments, users }
  },
}
