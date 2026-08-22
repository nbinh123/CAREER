
import { useEffect, useState } from "react";

/**
 * Trả về 1 bản sao "trễ" của `value`, chỉ cập nhật sau khi `value` ngừng
 * thay đổi trong khoảng `delayMs`. Mỗi lần `value` đổi trước khi hết
 * `delayMs`, timer cũ bị huỷ và tính lại từ đầu — đúng ngữ nghĩa debounce
 * tiêu chuẩn, giữ nguyên hành vi của 3 bản cài đặt thủ công hiện có.
 *
 * @param {*} value - Giá trị cần debounce (thường là chuỗi tìm kiếm).
 * @param {number} delayMs - Thời gian chờ, đơn vị ms (mặc định 400ms).
 */
export default function useDebounce(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
