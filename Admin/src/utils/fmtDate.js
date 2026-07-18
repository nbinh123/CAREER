const fmtDate = s => new Date(s).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
export default fmtDate;