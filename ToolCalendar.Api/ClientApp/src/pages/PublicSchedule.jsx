import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

const DAYS_OF_WEEK = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function ScheduleBlock({ day }) {
  return (
    <div className="mb-6">
      <p className="text-[#0a3d8f] font-black text-sm mb-2 uppercase flex items-center gap-2">
        <span className="w-2 h-2 bg-[#cc0000] rounded-full"></span>
        {day.dayLabel}, {day.date}
      </p>
      <div className="space-y-3">
        {day.items.map((item, idx) => (
          <div 
            key={idx} 
            onClick={() => window.open(`/api/documents/${item.id}/file`, '_blank')}
            className="bg-white/60 p-3 rounded-lg border-l-4 border-gray-300 hover:border-[#cc0000] hover:bg-white cursor-pointer transition-all group shadow-sm"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-[#cc0000] font-bold text-[11px] px-2 py-0.5 bg-red-50 rounded">
                {item.docNumber}
              </span>
              <svg className="opacity-0 group-hover:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            </div>
            <p className="text-gray-700 text-xs leading-relaxed font-medium line-clamp-2 italic">
              "{item.content}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavBar() {
  const [activeNav, setActiveNav] = useState("VĂN BẢN ĐẾN HẠN");
  const navItems = [
    "TRANG CHỦ",
    "VĂN BẢN ĐẾN HẠN",
    "TÌM KIẾM",
  ];

  return (
    <nav className="bg-[#2c6e49] w-full shadow-md">
      <div className="max-w-6xl mx-auto flex items-center">
        {navItems.map((item) => (
          <button
            key={item}
            onClick={() => setActiveNav(item)}
            className={`
              px-6 py-3 text-xs font-bold tracking-wide transition-all uppercase
              ${activeNav === item
                ? "bg-[#1a4a30] text-white shadow-inner"
                : "text-white hover:bg-[#1a4a30]/50"
              }
            `}
          >
            {item}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Header() {
  return (
    <header className="bg-white border-b-4 border-[#c8102e]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center bg-[#c8102e] rounded-full shadow-lg border-2 border-[#f5c518]">
            <svg viewBox="0 0 100 100" className="w-10 h-10">
              <polygon points="50,10 61,35 88,35 66,53 74,78 50,62 26,78 34,53 12,35 39,35" fill="#f5c518" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0a3d8f] tracking-tighter uppercase leading-tight">
              Hệ thống Điều phối Công văn
            </h1>
            <p className="text-[#c8102e] font-bold text-sm tracking-widest uppercase italic">
              UBND phường CẨM PHÁ
            </p>
          </div>
        </div>
        <div className="text-right hidden md:block text-gray-500 text-[10px] font-bold uppercase tracking-widest">
          <p>Hệ thống giám sát thực thi công việc</p>
          <p>Dữ liệu thời gian thực</p>
        </div>
      </div>
    </header>
  );
}

export default function PublicSchedule() {
  const [scheduleData, setScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents/public-schedule")
      .then(res => res.json())
      .then(data => {
        setScheduleData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Lỗi tải dữ liệu:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c8102e] mx-auto mb-4"></div>
          <p className="text-gray-600 font-bold uppercase text-xs tracking-widest">Đang kết nối hệ thống...</p>
        </div>
      </div>
    );
  }

  const today = scheduleData.find(d => d.dayLabel.includes("Hôm nay")) || (scheduleData.length > 0 ? scheduleData[0] : null);
  const upcomingDays = scheduleData.filter(d => d !== today);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#f4f7f6] font-sans">
        <Header />
        <NavBar />

        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-2xl border-t-8 border-[#0a3d8f] overflow-hidden">
                <div className="bg-gray-50 px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black text-[#0a3d8f] uppercase tracking-tight mb-1">
                      Danh sách văn bản đến hạn
                    </h2>
                    <p className="text-[#cc0000] font-bold text-sm uppercase">
                      {today ? today.dayLabel + ", " + today.date : "Hôm nay"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                    </span>
                    <span className="text-[#cc0000] text-xs font-black uppercase tracking-widest">Live</span>
                  </div>
                </div>
                <div className="p-6">
                  {today && today.items.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {today.items.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => window.open(`/api/documents/${item.id}/file`, '_blank')}
                          className="bg-white border-2 border-gray-100 p-5 rounded-xl hover:border-[#0a3d8f] hover:shadow-xl cursor-pointer transition-all duration-300 relative group flex flex-col justify-between h-full"
                        >
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <span className="bg-[#0a3d8f] group-hover:bg-[#cc0000] text-white px-2 py-1 rounded text-[10px] font-black transition-colors">
                                {item.docNumber}
                              </span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                Hạn xử lý
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 font-bold leading-relaxed mb-4">
                              {item.content}
                            </p>
                          </div>
                          <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                            <span className="text-[10px] text-[#0a3d8f] font-black uppercase flex items-center gap-1">
                              Xem chi tiết PDF
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-gray-400 italic">
                      <p className="text-4xl mb-4">📄</p>
                      <p className="uppercase text-xs font-bold tracking-widest">Không có văn bản nào đến hạn trong ngày hôm nay</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden sticky top-4">
                <div className="bg-[#2c6e49] px-4 py-4">
                  <h3 className="text-white font-black text-center uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Sắp đến hạn xử lý
                  </h3>
                </div>
                <div className="p-5 bg-gray-50/50">
                  {upcomingDays.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingDays.map((day, idx) => (
                        <ScheduleBlock key={idx} day={day} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 text-[10px] uppercase font-bold italic py-10">
                      Chưa có văn bản dự kiến đến hạn tiếp theo
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-12 bg-gray-800 text-gray-400 py-8 px-4 text-center text-xs">
          <p className="mb-2">© 2026 Bản quyền thuộc về UBND phường Cẩm Phả</p>
          <p>Hệ thống được phát triển bởi LinkStrategy</p>
        </footer>
      </div>
    </TooltipProvider>
  );
}
