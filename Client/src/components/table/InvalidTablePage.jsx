import React from "react";
import { QrCode, PhoneCall } from "lucide-react";
import { useTable } from "../../context/TableContext";

const MESSAGES = {
  missing: {
    title: "Chưa xác định được bàn của bạn",
    desc: "Vui lòng quét mã QR đặt trên bàn để mở thực đơn. Không thể truy cập trực tiếp bằng đường dẫn.",
  },
  expired: {
    title: "Mã QR đã hết hiệu lực",
    desc: "Mã QR này không còn dùng được, có thể do đã hết thời gian hiệu lực. Vui lòng quét lại mã QR mới trên bàn hoặc gọi nhân viên hỗ trợ.",
  },
  default: {
    title: "Không thể xác thực bàn",
    desc: "Đã có lỗi khi xác thực mã bàn của bạn. Vui lòng quét lại mã QR hoặc gọi nhân viên hỗ trợ.",
  },
};

export default function InvalidTablePage() {
  const { reason } = useTable();
  const content = MESSAGES[reason] || MESSAGES.default;

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-6 text-center safe-top safe-bottom">
      <div className="w-16 h-16 rounded-full bg-turmeric/15 flex items-center justify-center mb-5">
        <QrCode size={28} className="text-turmeric" />
      </div>
      <h1 className="font-display text-xl font-semibold text-paper mb-2">{content.title}</h1>
      <p className="text-steel-light text-sm leading-relaxed max-w-xs mb-8">{content.desc}</p>

      <a
        href="tel:19000000"
        className="inline-flex items-center gap-2 rounded-full bg-chili text-paper px-5 py-3 font-display text-sm font-medium"
      >
        <PhoneCall size={16} />
        Gọi nhân viên hỗ trợ
      </a>
    </div>
  );
}
