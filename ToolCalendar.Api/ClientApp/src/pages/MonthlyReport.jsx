import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Printer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToWord } from '@/lib/ReportExportLogic';

export function MonthlyReport({ onTabChange }) {
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/stats/monthly-report?month=${month}&year=${year}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setReportData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month, year]);

  const handleCellClick = (departmentName, count, statusFilter, sortFilter = 'newest') => {
    // Ignore click if user is selecting/highlighting text
    if (window.getSelection && window.getSelection().toString().length > 0) {
      return;
    }

    if (count > 0 && onTabChange) {
      const pad = (n) => String(n).padStart(2, '0');
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const firstDay = `${y}-${pad(m)}-01`;
      const lastDay = `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;

      onTabChange('search', { 
        search: departmentName, 
        status: statusFilter, 
        addFromDate: firstDay,
        addToDate: lastDay,
        sort: sortFilter 
      });
    }
  };

  const totalTotal = reportData.reduce((acc, curr) => acc + curr.total, 0);
  const totalOnTime = reportData.reduce((acc, curr) => acc + curr.onTime, 0);
  const totalOverdue = reportData.reduce((acc, curr) => acc + curr.overdue, 0);
  const totalProcessingOnTime = reportData.reduce((acc, curr) => acc + curr.processingOnTime, 0);
  const totalProcessingOverdue = reportData.reduce((acc, curr) => acc + curr.processingOverdue, 0);

  const handleExportWord = () => {
    exportToWord(reportData, month, year);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      {/* ── Toolbar (Không in ra) ── */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">Thống kê theo tháng:</span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Chọn tháng" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <SelectItem key={m} value={m.toString()}>Tháng {m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Chọn năm" />
            </SelectTrigger>
            <SelectContent>
              {['2024', '2025', '2026'].map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="size-4" />
            <span>In PDF</span>
          </Button>
          <Button onClick={handleExportWord} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <FileText className="size-4" />
            <span>Xuất Word (.docx)</span>
          </Button>
        </div>
      </div>

      {/* ── Vùng chứa trang A4 ── */}
      <div className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-8 flex justify-center rounded-xl print:bg-white print:p-0 print:overflow-visible relative">
        
        {/* CSS cho lúc in */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .a4-print-area, .a4-print-area * {
              visibility: visible;
            }
            .a4-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              box-shadow: none !important;
              padding: 0 !important;
            }
          }
        `}} />

        {/* Tờ giấy A4 */}
        <div className="a4-print-area bg-white shadow-xl max-w-[210mm] w-full min-h-[297mm] p-[3cm_2cm_2cm_3cm] flex flex-col font-serif text-[14px] leading-relaxed text-black print:shadow-none">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="text-center w-[40%]">
              <p className="uppercase font-bold text-[13px]">ỦY BAN NHÂN DÂN</p>
              <p className="uppercase font-bold text-[13px] border-b-[1.5px] border-black inline-block pb-1">PHƯỜNG CẨM PHẢ</p>
              <p className="mt-2 text-[14px]">Số: ..../BC-UBND</p>
            </div>
            <div className="text-center w-[60%]">
              <p className="uppercase font-bold text-[13px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="font-bold text-[14px] border-b-[1.5px] border-black inline-block pb-1">Độc lập - Tự do - Hạnh phúc</p>
              <p className="mt-2 italic text-[14px]">Cẩm Phả, ngày ... tháng ... năm {year}</p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="uppercase font-bold text-[16px] mb-1">BÁO CÁO</h1>
            <h2 className="font-bold text-[15px] mb-1">Tình hình tiếp nhận và xử lý văn bản đến</h2>
            <p className="italic text-[14px]">(Tháng {month} năm {year})</p>
          </div>

          {/* Intro */}
          <div className="mb-4 text-justify indent-8">
            <p>Thực hiện quy chế làm việc của Ủy ban nhân dân, Văn phòng HĐND & UBND báo cáo tình hình tiếp nhận và xử lý văn bản đến của các cơ quan, đơn vị trực thuộc trong tháng {month} năm {year} cụ thể như sau:</p>
          </div>

          {/* Table */}
          <table className="w-full border-collapse border border-black text-center text-[13px] mb-8">
            <thead>
              <tr>
                <th className="border border-black p-2 font-bold w-10" rowSpan="2">STT</th>
                <th className="border border-black p-2 font-bold" rowSpan="2">Đơn vị / Phòng ban</th>
                <th className="border border-black p-2 font-bold" rowSpan="2">Tổng nhận</th>
                <th className="border border-black p-2 font-bold" colSpan="2">Đã xử lý</th>
                <th className="border border-black p-2 font-bold" colSpan="2">Đang giải quyết</th>
              </tr>
              <tr>
                <th className="border border-black p-2 font-bold">Đúng hạn</th>
                <th className="border border-black p-2 font-bold">Quá hạn</th>
                <th className="border border-black p-2 font-bold">Trong hạn</th>
                <th className="border border-black p-2 font-bold">Quá hạn</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="border border-black p-4 text-center">Đang tải dữ liệu...</td>
                </tr>
              ) : reportData.map((row, index) => (
                <tr key={row.id}>
                  <td className="border border-black p-2">{index + 1}</td>
                  <td className="border border-black p-2 text-left">{row.name}</td>
                  <td 
                    className={`border border-black p-2 font-semibold ${row.total > 0 ? 'cursor-pointer hover:bg-slate-100 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick(row.name, row.total, '', 'newest')}
                  >
                    {row.total}
                  </td>
                  <td 
                    className={`border border-black p-2 ${row.onTime > 0 ? 'cursor-pointer hover:bg-slate-100 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick(row.name, row.onTime, 'completed_ontime', 'newest')}
                  >
                    {row.onTime}
                  </td>
                  <td 
                    className={`border border-black p-2 font-bold ${row.overdue > 0 ? 'text-red-600 print:text-black cursor-pointer hover:bg-red-50 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick(row.name, row.overdue, 'completed_overdue', 'newest')}
                  >
                    {row.overdue}
                  </td>
                  <td 
                    className={`border border-black p-2 ${row.processingOnTime > 0 ? 'cursor-pointer hover:bg-slate-100 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick(row.name, row.processingOnTime, 'processing_ontime', 'deadline_asc')}
                  >
                    {row.processingOnTime}
                  </td>
                  <td 
                    className={`border border-black p-2 ${row.processingOverdue > 0 ? 'text-orange-600 font-bold print:text-black cursor-pointer hover:bg-orange-50 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick(row.name, row.processingOverdue, 'overdue', 'deadline_asc')}
                  >
                    {row.processingOverdue}
                  </td>
                </tr>
              ))}
              {/* Row Total */}
              {!loading && reportData.length > 0 && (
                <tr className="font-bold bg-slate-50 print:bg-transparent">
                  <td className="border border-black p-2" colSpan="2">TỔNG CỘNG</td>
                  <td 
                    className={`border border-black p-2 ${totalTotal > 0 ? 'cursor-pointer hover:bg-slate-200 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick('', totalTotal, '', 'newest')}
                  >
                    {totalTotal}
                  </td>
                  <td 
                    className={`border border-black p-2 ${totalOnTime > 0 ? 'cursor-pointer hover:bg-slate-200 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick('', totalOnTime, 'completed_ontime', 'newest')}
                  >
                    {totalOnTime}
                  </td>
                  <td 
                    className={`border border-black p-2 text-red-600 print:text-black ${totalOverdue > 0 ? 'cursor-pointer hover:bg-red-100 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick('', totalOverdue, 'completed_overdue', 'newest')}
                  >
                    {totalOverdue}
                  </td>
                  <td 
                    className={`border border-black p-2 ${totalProcessingOnTime > 0 ? 'cursor-pointer hover:bg-slate-200 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick('', totalProcessingOnTime, 'processing_ontime', 'deadline_asc')}
                  >
                    {totalProcessingOnTime}
                  </td>
                  <td 
                    className={`border border-black p-2 ${totalProcessingOverdue > 0 ? 'text-orange-600 cursor-pointer hover:bg-orange-100 underline underline-offset-2' : ''}`}
                    onClick={() => handleCellClick('', totalProcessingOverdue, 'overdue', 'deadline_asc')}
                  >
                    {totalProcessingOverdue}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Footer Signatures */}
          <div className="flex justify-between items-start mt-4">
            <div className="w-[50%] text-[12px]">
              <p className="font-bold italic mb-1 text-[13px]">Nơi nhận:</p>
              <p>- UBND tỉnh Quảng Ninh (b/c);</p>
              <p>- Công an tỉnh (b/c);</p>
              <p>- TT. Đảng ủy, HĐND phường (b/c);</p>
              <p>- Chủ tịch, các PCT UBND;</p>
              <p>- Công an phường (biết);</p>
              <p>- Các phòng, đơn vị: VP HĐND và UBND, VHXH, KTHTĐT, TT PVHCC (biết);</p>
              <p>- Lưu: VT.</p>
            </div>
            <div className="w-[50%] text-center">
              <p className="font-bold mb-16">CHÁNH VĂN PHÒNG</p>
              {/* Khoảng trống để ký tên */}
              <p className="font-bold mt-20">(Đã ký)</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
