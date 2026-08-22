// src/pages/charts/helpers/apiHelpers.js
// [UI] Bản gốc tự gọi raw fetch() + gắn Bearer token thủ công. Logic thật đã
// chuyển sang service/AnalystService.js (đi qua callAPI.js, nhất quán với
// toàn app — xem ghi chú ở đó). File này chỉ re-export lại để AnalystPage.js
// và Chart01-10 giữ nguyên đường import "./charts/helpers/apiHelpers" và
// chữ ký apiFetch(path) y hệt bản gốc, không phải sửa từng chart.
export { apiFetch, apiPatch } from "../../../service/AnalystService";
