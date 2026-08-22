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

/**
 * apiFetch(path) — giữ đúng chữ ký của bản gốc (path dạng "/weekly?offset=0")
 * để toàn bộ call-site trong AnalystPage.js và Chart01-10 không phải sửa gì.
 */
export async function apiFetch(path) {
  const [pathname, queryString] = path.split("?");
  const params = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
  return unwrap(await getData({ url: `${PREFIX}${pathname}`, params }));
}

/** apiPatch(path, data) — dùng cho Chart10 (cập nhật Kp/Ki/Kd), thay cho raw fetch PATCH ở bản gốc. */
export async function apiPatch(path, data) {
  return unwrap(await patchData({ url: `${PREFIX}${path}`, data }));
}
