/* eslint-disable */
import React from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'
import { Button } from './button'

/**
 * DataTable - Reusable Table Component with built-in scrolling and pagination
 *
 * @param {Array} columns - Array of column definitions: { header: string, accessor?: string, cell?: (row) => JSX, width?: string, align?: string, className?: string, cellClassName?: string }
 * @param {Array} data - Array of row data
 * @param {boolean} isLoading - Loading state
 * @param {string} emptyMessage - Message to display when data is empty
 * @param {string} minWidth - Minimum width of the table to trigger horizontal scroll (e.g., "1000px")
 * @param {boolean|Error} error - Error state
 * @param {React.ReactNode} errorContent - Custom error content to display
 * @param {Object} pagination - Pagination config { page, totalPages, totalCount, pageSize, onPageChange, onPageSizeChange, pageSizeOptions }
 */
export function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  emptyMessage = 'Không có dữ liệu',
  error = false,
  errorContent = null,
  minWidth = '1000px',
  pagination,
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full relative">
      <div className="flex-1 overflow-auto min-h-0 custom-scrollbar">
        <Table
          className="w-full table-fixed"
          wrapperClassName="overflow-visible"
          style={{ minWidth }}
        >
          <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b">
            <TableRow className="hover:bg-transparent border-none">
              {columns.map((col, index) => (
                <TableHead
                  key={index}
                  className={`font-bold text-foreground ${col.width || ''} ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                        ? 'text-right'
                        : ''
                  } ${col.className || ''}`}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="relative">
            {isLoading ? (
              // Skeleton loading can be added here
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-[240px] text-center p-0 align-middle"
                >
                  <div className="flex flex-col items-center justify-center gap-3 opacity-50">
                    <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm font-bold animate-pulse">Đang tải dữ liệu...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-[240px] text-center p-0 align-middle"
                >
                  {errorContent || (
                    <div className="flex flex-col items-center justify-center gap-3 opacity-80 text-destructive">
                      <p className="text-sm font-bold">Đã xảy ra lỗi khi tải dữ liệu.</p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : data && data.length > 0 ? (
              data.map((row, rowIndex) => (
                <TableRow key={row.id || rowIndex} className="group transition-colors h-[64px]">
                  {columns.map((col, colIndex) => (
                    <TableCell
                      key={colIndex}
                      className={`${
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'right'
                            ? 'text-right'
                            : ''
                      } ${col.cellClassName || ''}`}
                    >
                      {col.cell ? col.cell(row, rowIndex) : row[col.accessor]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-[240px] text-center p-0 align-middle"
                >
                  <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                    <Search className="size-16" />
                    <p className="text-sm font-bold">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="p-4 border-t border-border flex items-center justify-between bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-6">
            <p className="text-xs text-muted-foreground font-medium">
              Trang <span className="text-foreground">{pagination.page}</span> /{' '}
              <span className="text-foreground">{pagination.totalPages || 1}</span>
              <span className="mx-2 text-muted-foreground/30">|</span>Tổng{' '}
              <span className="text-foreground font-bold">{pagination.totalCount || 0}</span>
            </p>
            {pagination.onPageSizeChange && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                  Hiển thị:
                </span>
                <select
                  className="h-7 px-2 text-[11px] font-bold bg-background border rounded-md outline-none focus:ring-1 ring-primary/30"
                  value={pagination.pageSize || 10}
                  onChange={(e) => {
                    pagination.onPageSizeChange(Number(e.target.value))
                    if (pagination.onPageChange) {
                      pagination.onPageChange(1) // Reset to page 1 when size changes
                    }
                  }}
                >
                  {(pagination.pageSizeOptions || [10, 15, 20, 25]).map((size) => (
                    <option key={size} value={size}>
                      {size} dòng
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                pagination.onPageChange && pagination.onPageChange(pagination.page - 1)
              }
              className="h-8 text-xs font-semibold px-4"
            >
              <ChevronLeft className="size-4 mr-1" /> Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() =>
                pagination.onPageChange && pagination.onPageChange(pagination.page + 1)
              }
              className="h-8 text-xs font-semibold px-4"
            >
              Sau <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
