import axiosClient from "./axiosClient";

// GET /api/foods -> trả về mảng Food document (đã gồm virtuals nhờ toJSON của schema)
// Nếu API của bạn bọc trong { data: [...] } hay { foods: [...] } thì đổi dòng return cho khớp.
export async function getFoods() {
  const res = await axiosClient.get("/api/foods");
  return res.data;
}
