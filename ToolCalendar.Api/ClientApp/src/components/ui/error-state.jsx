/* eslint-disable react/prop-types */
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button } from './button'

export function ErrorState({
  title = 'Không thể tải dữ liệu',
  message = 'Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
  onRetry,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center min-h-[200px] h-full ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[400px] mb-6">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground font-bold rounded-xl"
        >
          <RefreshCcw className="w-4 h-4 mr-2" /> Thử lại
        </Button>
      )}
    </div>
  )
}
