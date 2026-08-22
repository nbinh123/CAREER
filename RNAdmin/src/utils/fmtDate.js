// [GIU-NGUYEN] copy nguyên vẹn — Intl/Date API hoạt động giống hệt trên RN (Hermes).
const fmtDate = (s) =>
  new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
export default fmtDate;
