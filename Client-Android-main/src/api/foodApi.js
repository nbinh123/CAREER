import axiosClient from "./axiosClient";

// Y hệt bản web — endpoint công khai, không đổi gì khi chuyển sang RN.
export async function getFoods() {
  const res = await axiosClient.get("/api/foods");
  return res.data;
}
