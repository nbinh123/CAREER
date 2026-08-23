import { getData, patchData } from "../utils/callAPI";

const PREFIX = "/analyst";

const unwrap = (res) => {
  if (!res.success) {
    const err = new Error(res.message || "Analyst API lỗi");
    err.status = res.status;
    throw err;
  }
  // Backend trả { success, data, message } — res.data ở đây là body axios
  // (đã qua handleResponse của callAPI.js), nên dữ liệu thật nằm ở .data.data.
  const body = res.data;
  if (body && body.success === false) throw new Error(body.message || "Analyst API lỗi");
  return body?.data;
};

// [PERF-FIX] Dedupe request GET trùng path đang bắn đồng thời. Thực tế ở lần
// mount đầu AnalystPage: Chart01 gọi cứng "/chart-data?tf=day", Chart04/05
// mặc định tf4=tf5="day", và Chart08 khi tfCustomer="hour" cũng map sang
// tf="day" (xem AnalystPage.js) — tức 4 effect độc lập cùng gọi apiFetch với
// ĐÚNG 1 path "/chart-data?tf=day" trong cùng 1 tick, tạo 4 request HTTP y
// hệt nhau bắn song song, cộng dồn vào các endpoint khác thành 11 request
// cùng lúc. Cache theo key = path, dùng chung 1 Promise cho các lệnh gọi
// trùng đang "in-flight"; tự xoá khỏi cache khi request đó kết thúc (dù
// thành công hay lỗi) nên lần gọi sau — không đồng thời, ví dụ tick 60s kế
// tiếp hoặc khi người dùng đổi timeframe — vẫn luôn lấy dữ liệu mới, không
// bị cache "dính" vĩnh viễn.
const inFlight = new Map();

/**
 * apiFetch(path) — giữ đúng chữ ký của bản gốc (path dạng "/weekly?offset=0")
 * để toàn bộ call-site trong AnalystPage.js và Chart01-10 không phải sửa gì.
 */
export function apiFetch(path) {
  const cached = inFlight.get(path);
  if (cached) return cached;

  const [pathname, queryString] = path.split("?");
  const params = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};

  const promise = getData({ url: `${PREFIX}${pathname}`, params })
    .then(unwrap)
    .finally(() => inFlight.delete(path));

  inFlight.set(path, promise);
  return promise;
}

/** apiPatch(path, data) — dùng cho Chart10 (cập nhật Kp/Ki/Kd), thay cho raw fetch PATCH ở bản gốc. */
export async function apiPatch(path, data) {
  return unwrap(await patchData({ url: `${PREFIX}${path}`, data }));
}
