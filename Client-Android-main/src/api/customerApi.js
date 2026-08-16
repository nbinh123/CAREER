import axiosClient from "./axiosClient";

// Các endpoint khách hàng tự phục vụ, theo đúng bảng API mục 3.3 của kế
// hoạch. Dùng ở CheckoutScreen để khách cập nhật hồ sơ (tên/địa chỉ) song
// song với việc đặt đơn — thay thế "Lưu thông tin cho lần sau" kiểu
// localStorage của CustomerContext bên bản web (bản mobile đã có tài khoản
// thật nên lưu thẳng lên server).
export async function getMyProfile() {
  const res = await axiosClient.get("/api/customers/me");
  return res.data;
}

export async function updateMyProfile(patch) {
  const res = await axiosClient.patch("/api/customers/me", patch);
  return res.data;
}

export async function getMyOrders() {
  const res = await axiosClient.get("/api/customers/me/orders");
  return res.data;
}
