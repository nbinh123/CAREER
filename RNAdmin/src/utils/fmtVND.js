// [GIU-NGUYEN] copy nguyên vẹn từ bản web — thuần JS, không đụng DOM.
const fmtVND = (n) => (n || 0).toLocaleString("vi-VN") + "₫";
export default fmtVND;
