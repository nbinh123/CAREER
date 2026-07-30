import React from "react";
import { Outlet } from "react-router-dom";
import { useTable } from "../../context/TableContext";
import { useSocket } from "../../context/SocketContext";
import { useGuest } from "../../context/GuestContext";
import Loading from "../common/Loading";
import InvalidTablePage from "./InvalidTablePage";
import TableWaitingPage from "./TableWaitingPage";
import GuestInfoPage from "./GuestInfoPage";

export default function TableGuard() {
  const { status } = useTable();
  const { connected, stateReceived, tableKnown, tableActive } = useSocket();
  const { hasGuest } = useGuest();

  // Bước 1: chưa xác định được tableId từ URL/sessionStorage
  if (status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loading label="Đang xác thực mã bàn..." />
      </div>
    );
  }

  // Không có ?table=<id> hợp lệ trên URL và cũng không có phiên cũ
  if (status === "invalid") {
    return <InvalidTablePage />;
  }

  // Bước 2: đã biết tableId, đang chờ server xác nhận bàn này thật sự tồn
  // tại + trạng thái active của nó (round-trip qua socket)
  if (!connected || !stateReceived) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loading label="Đang kết nối tới bàn của bạn..." />
      </div>
    );
  }

  // Server đã trả lời nhưng không tìm thấy bàn với số này trong DB (vd URL
  // bị sửa tay thành số bàn không tồn tại)
  if (!tableKnown) {
    return <InvalidTablePage />;
  }

  // Bước 3: bàn có thật, nhưng khách chưa nhập tên + SĐT — bắt nhập trước
  // khi vào thực đơn, để admin biết đang phục vụ/chat với ai ở bàn này.
  // Chỉ hỏi 1 lần mỗi phiên (lưu ở sessionStorage qua GuestContext), và sẽ
  // hỏi lại nếu bàn vừa được thanh toán (khách mới ngồi vào).
  if (!hasGuest) {
    return <GuestInfoPage />;
  }

  // Bàn có thật nhưng admin chưa bật cho gọi món — chờ ở đây, tự động vào
  // ngay khi admin bật (component tự re-render vì tableActive đổi realtime)
  if (!tableActive) {
    return <TableWaitingPage />;
  }

  return <Outlet />;
}