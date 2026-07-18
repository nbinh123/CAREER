import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";

const TableContext = createContext(null);
const STORAGE_KEY = "qbm_table_session";

/**
 * TRƯỚC ĐÂY: xác thực bằng cặp ?table=<id>&token=<JWT ký bởi server>, coi
 * token là "vé vào cửa" duy nhất — vào được trang là gọi món được luôn.
 *
 * BÂY GIỜ: bỏ hẳn khái niệm token ở tầng này. TableContext chỉ còn 1 nhiệm
 * vụ: xác định khách đang ngồi ở BÀN NÀO (đọc từ ?table=<id> trên URL, hoặc
 * từ sessionStorage nếu khách đã từng vào đúng bàn này trong cùng tab).
 *
 * "Bàn này có được PHÉP gọi món hay chưa" KHÔNG còn là việc của
 * TableContext nữa — nó chuyển hẳn sang SocketContext (field `active`, lấy
 * realtime qua "tables_state" mỗi khi admin bật/tắt ở OrdersPage.jsx bên
 * admin). Lý do tách ra: trạng thái active có thể đổi bất cứ lúc nào ngay
 * cả khi khách đang đứng yên ở trang (admin khoá bàn giữa chừng) — nó cần
 * sống trong socket (nhận realtime), không phải trong 1 lần xác thực lúc
 * vào trang như token cũ. TableGuard.jsx là nơi kết hợp cả 2 nguồn này lại.
 *
 * => status ở đây chỉ còn trả lời "có xác định được tableId hay không":
 *    - "verifying": đang đọc URL/sessionStorage (gần như tức thời)
 *    - "valid": đã biết tableId
 *    - "invalid": không có ?table=<id> trên URL và cũng không có phiên nào
 *      lưu trước đó trong tab này (reason: "missing")
 */
export function TableProvider({ children }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying | valid | invalid
  const [table, setTable] = useState(null);
  const [reason, setReason] = useState(null);

  const resolveTable = useCallback(() => {
    setStatus("verifying");
    const qTable = searchParams.get("table");

    // Không có ?table= trên URL -> thử dùng phiên đã lưu trước đó trong tab này
    if (!qTable) {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.tableId) {
            setTable(parsed);
            setStatus("valid");
            return;
          }
        } catch {
          /* ignore, coi như không có phiên hợp lệ */
        }
      }
      setStatus("invalid");
      setReason("missing");
      return;
    }

    const sessionData = {
      tableId: qTable,
      tableLabel: `Bàn ${qTable}`,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    setTable(sessionData);
    setStatus("valid");

    // Rút gọn URL sau khi đã ghi nhớ bàn, giữ URL sạch khi khách chia sẻ link
    navigate(ROUTES.ORDER, { replace: true });
  }, [searchParams, navigate]);

  useEffect(() => {
    resolveTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ status, table, reason, retryVerification: resolveTable }),
    [status, table, reason, resolveTable]
  );

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
}

export function useTable() {
  const ctx = useContext(TableContext);
  if (!ctx) throw new Error("useTable phải dùng trong TableProvider");
  return ctx;
}