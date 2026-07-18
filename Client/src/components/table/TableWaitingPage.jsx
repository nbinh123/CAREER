import React from "react";
import { Clock3, Wifi, WifiOff } from "lucide-react";
import { useTable } from "../../context/TableContext";
import { useSocket } from "../../context/SocketContext";

// Cùng vai trò "màn chắn" như InvalidTablePage.jsx nên dùng chung ngôn ngữ
// thiết kế (icon tròn, font-display cho tiêu đề, text-steel cho mô tả,
// safe-top/safe-bottom cho notch điện thoại). Điểm khác biệt có chủ đích:
// - InvalidTablePage: nền tối (bg-ink) + chili — báo lỗi, cần gọi nhân viên.
// - TableWaitingPage: nền sáng (bg-paper) + turmeric — trạng thái tạm thời,
//   sẽ tự hết khi admin bật bàn, không cần khách phải làm gì thêm.
export default function TableWaitingPage() {
  const { table } = useTable();
  const { connected } = useSocket();

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center safe-top safe-bottom">
      <div className="w-16 h-16 rounded-full bg-turmeric/15 flex items-center justify-center mb-5">
        <Clock3 size={28} className="text-turmeric-dark" />
      </div>

      <h1 className="font-display text-xl font-semibold text-ink mb-2">
        {table?.tableLabel || "Bàn của bạn"} chưa được mở gọi món
      </h1>
      <p className="text-steel text-sm leading-relaxed max-w-xs mb-6">
        Vui lòng đợi nhân viên xác nhận tại quầy. Trang sẽ tự động chuyển
        sang thực đơn ngay khi bàn được kích hoạt — không cần tải lại trang.
      </p>

      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ticket-num rounded-full px-3 py-1.5 ${
          connected ? "bg-jade-light text-jade" : "bg-chili-light text-chili-dark"
        }`}
      >
        {connected ? (
          <>
            <Wifi size={12} /> Đã kết nối, đang chờ nhân viên
          </>
        ) : (
          <>
            <WifiOff size={12} /> Mất kết nối, đang thử lại...
          </>
        )}
      </span>
    </div>
  );
}