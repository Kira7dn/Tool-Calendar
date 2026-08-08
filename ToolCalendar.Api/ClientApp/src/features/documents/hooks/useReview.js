/* eslint-disable */
import { toast } from 'sonner'
import { ROLES } from '@/constants/roles'

export function useReview() {
  const [docs, setDocs] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])

  const [formData, setFormData] = useState({
    soVanBan: '',
    coQuanChuQuan: '',
    trichYeu: '',
    thoiHan: '',
    departmentId: '',
    assignedTo: '',
  })
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchReferenceData = useCallback(async () => {
    try {
      const headers = {}
      const [deptRes, userRes] = await Promise.all([
        fetch('/api/admin/departments', { headers }),
        fetch('/api/users', { headers }),
      ])
      if (deptRes.ok) setDepartments(await deptRes.json())
      if (userRes.ok) {
        const userData = await userRes.json()
        setUsers(userData.filter((u) => u.role === ROLES.CAN_BO || u.role === ROLES.ADMIN))
      }
    } catch (error) {
      console.error('Failed to fetch reference data:', error)
    }
  }, [])

  const fetchReviewDocs = useCallback(async () => {
    setIsLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/documents?status=Chưa xử lý&size=50')
      if (response.ok) {
        const data = await response.json()
        setDocs(data.data || [])
      } else {
        throw new Error('API fetch failed')
      }
    } catch (error) {
      console.error('Failed to fetch review docs:', error)
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReviewDocs()
    fetchReferenceData()
  }, [fetchReviewDocs, fetchReferenceData])

  useEffect(() => {
    if (docs.length > 0 && docs[currentIndex]) {
      const doc = docs[currentIndex]
      setFormData({
        soVanBan: doc.soVanBan || '',
        coQuanChuQuan: doc.coQuanChuQuan || '',
        trichYeu: doc.trichYeu || '',
        thoiHan: doc.thoiHan ? doc.thoiHan.split('T')[0] : '',
        departmentId: doc.departmentId || '',
        assignedTo: doc.assignedTo || '',
      })
    }
  }, [currentIndex, docs])

  const handleSave = async () => {
    const doc = docs[currentIndex]
    setIsSaving(true)
    try {
      const headers = { 'Content-Type': 'application/json' }

      const response = await fetch(`/api/documents/${doc.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...doc,
          ...formData,
          thoiHan: formData.thoiHan ? `${formData.thoiHan}T00:00:00` : null,
          status: 'Đã rà soát',
        }),
      })

      if (response.ok) {
        if (formData.departmentId || formData.assignedTo) {
          await fetch(`/api/documents/${doc.id}/assign`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              departmentIds: formData.departmentId ? [parseInt(formData.departmentId)] : [],
              userIds: formData.assignedTo ? [parseInt(formData.assignedTo)] : [],
            }),
          })
        }

        const newDocs = [...docs]
        newDocs.splice(currentIndex, 1)
        setDocs(newDocs)
        if (currentIndex >= newDocs.length && newDocs.length > 0) {
          setCurrentIndex(newDocs.length - 1)
        }
      }
    } catch (error) {
      console.error('Failed to save review:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    const doc = docs[currentIndex]
    try {
      const response = await fetch(`/api/documents/bulk-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([doc.id]),
      })
      if (response.ok) {
        toast.success('Đã xóa văn bản thành công')
        const newDocs = [...docs]
        newDocs.splice(currentIndex, 1)
        setDocs(newDocs)
      } else {
        toast.error('Lỗi khi xóa văn bản')
      }
    } catch (e) {
      toast.error('Có lỗi xảy ra khi xóa')
    } finally {
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
    }
  }

  return {
    docs,
    setDocs,
    currentIndex,
    setCurrentIndex,
    isLoading,
    error,
    isSaving,
    departments,
    users,
    formData,
    setFormData,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    isDeleting,
    handleSave,
    handleDelete,
    fetchReviewDocs,
  }
}
