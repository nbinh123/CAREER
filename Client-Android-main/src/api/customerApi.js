import axiosClient from "./axiosClient";

// Các endpoint khách hàng tự phục vụ, theo đúng bảng API mục 3.3 của kế
// hoạch. Dùng ở CheckoutScreen để khách cập nhật hồ sơ (tên/địa chỉ) song
// song với việc đặt đơn — thay thế "Lưu thông tin cho lần sau" kiểu
// localStorage của CustomerContext bên bản web (bản mobile đã có tài khoản
// thật nên lưu thẳng lên server).
// BUGFIX: /api/customers/me (cả GET và PATCH) bọc dữ liệu khách hàng trong
// field "customer" giống response của login/register — không phải object
// phẳng. Chuẩn hoá tại đây để bất kỳ chỗ nào gọi 2 hàm này cũng nhận đúng
// object có fullName/phone, không lặp lại bug "tab Tài khoản trống".
function normalizeCustomer(raw) {
  if (raw && typeof raw === "object" && raw.customer && typeof raw.customer === "object") {
    return raw.customer;
  }
  return raw;
}

export async function getMyProfile() {
  const res = await axiosClient.get("/api/customers/me");
  return normalizeCustomer(res.data);
}

export async function updateMyProfile(patch) {
  const res = await axiosClient.patch("/api/customers/me", patch);
  return normalizeCustomer(res.data);
}

export async function getMyOrders() {
  const res = await axiosClient.get("/api/customers/me/orders");
  return res.data;
}