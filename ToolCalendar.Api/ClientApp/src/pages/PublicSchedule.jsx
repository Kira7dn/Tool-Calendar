import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

const DAYS_OF_WEEK = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function ScheduleBlock({ day }) {
  return (
    <div className="mb-4">
      <p className="text-[#0066cc] font-bold text-sm mb-1 uppercase">
        {day.dayLabel}, ngày {day.date}:
      </p>
      <div className="space-y-2">
        {day.items.map((item, idx) => (
          <div key={idx} className="text-sm leading-snug border-l-2 border-[#d4edda] pl-2">
            <span className="text-[#cc0000] font-bold">{item.time} - </span>
            {item.docNumber && (
              <span className="text-[#cc0000] font-semibold">[{item.docNumber}] </span>
            )}
            <span className="text-gray-800"> {item.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavBar() {
  const [activeNav, setActiveNav] = useState("LỊCH CÔNG TÁC");
  const navItems = [
    "TRANG CHỦ",
    "LỊCH CÔNG TÁC",
    "VĂN BẢN",
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
          <div className="w-20 h-20 flex items-center justify-center bg-[#c8102e] rounded-full shadow-lg border-2 border-[#f5c518]">
             <svg viewBox="0 0 100 100" className="w-14 h-14">
              <polygon points="50,10 61,35 88,35 66,53 74,78 50,62 26,78 34,53 12,35 39,35" fill="#f5c518"/>
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-black text-[#0a3d8f] tracking-tighter uppercase leading-tight">
              Hệ thống Điều phối Công văn
            </h1>
            <p className="text-[#c8102e] font-bold text-lg tracking-widest uppercase italic">
              UBND phường CẨM PHÁ
            </p>
          </div>
        </div>
        <div className="text-right hidden md:block text-gray-500 text-xs font-bold">
            <p>Hệ thống giám sát thực thi công việc</p>
            <p>Phiên bản công cộng v1.0</p>
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
        console.error("Lỗi tải lịch:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c8102e] mx-auto mb-4"></div>
           <p className="text-gray-600 font-bold">Đang tải lịch công tác...</p>
        </div>
      </div>
    );
  }

  const today = scheduleData.find(d => d.dayLabel.includes("Hôm nay")) || (scheduleData.length > 0 ? scheduleData[0] : null);
  const upcomingDays = scheduleData.filter(d => d !== today);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#f8f9fa] font-sans">
        <Header />
        <NavBar />

        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cột trái - Lịch hôm nay */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-xl border-t-8 border-[#0a3d8f] overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                  <h2 className="text-2xl font-black text-[#0a3d8f] uppercase tracking-tight">
                    {today ? today.dayLabel : "Lịch công tác"}
                  </h2>
                  <span className="bg-[#c8102e] text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                    LIVE
                  </span>
                </div>
                <div className="p-8">
                  {today && today.items.length > 0 ? (
                    <div className="space-y-6">
                      {today.items.map((item, idx) => (
                        <div key={idx} className="flex gap-6 items-start group">
                          <div className="flex-shrink-0 w-24 text-center">
                             <span className="block text-xl font-black text-[#cc0000]">{item.time}</span>
                             <span className="text-[10px] text-gray-400 font-bold uppercase">Bắt đầu</span>
                          </div>
                          <div className="flex-1 bg-gray-50 p-6 rounded-lg border-l-4 border-[#cc0000] group-hover:bg-red-50 transition-colors">
                            {item.docNumber && (
                              <div className="inline-block bg-[#cc0000] text-white px-2 py-0.5 rounded text-[10px] font-bold mb-2">
                                {item.docNumber}
                              </div>
                            )}
                            <p className="text-lg text-gray-800 font-medium leading-relaxed italic">
                              "{item.content}"
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-gray-400 italic">
                      <p className="text-4xl mb-4">📅</p>
                      <p>Không có văn bản nào đến hạn trong ngày hôm nay.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cột phải - Lịch các ngày tới */}
            <div className="lg:col-span-1">
              <div className="bg-[#d4edda] rounded-xl shadow-lg border border-[#b8dbc6] overflow-hidden sticky top-4">
                <div className="bg-[#2c6e49] px-4 py-3">
                  <h3 className="text-white font-black text-center uppercase tracking-widest text-sm">
                    Dự kiến các ngày tới
                  </h3>
                </div>
                <div className="p-6">
                  {upcomingDays.length > 0 ? (
                    <div className="space-y-6">
                      {upcomingDays.map((day, idx) => (
                        <ScheduleBlock key={idx} day={day} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-[#2c6e49] text-xs italic">
                      Chưa có lịch dự kiến cho những ngày tiếp theo.
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
