// categoryId trong Food schema hiện chỉ là 1 string tự do (không phải ref tới
// Category collection), nên FE tự giữ bảng nhãn hiển thị tương ứng ở đây.
// Khi có API /api/categories riêng, thay bằng dữ liệu fetch từ đó.
export const CATEGORIES = [
  { id: "khai-vi", label: "Khai vị" },
  { id: "mon-chinh", label: "Món chính" },
  { id: "canh-lau", label: "Canh & Lẩu" },
  { id: "com-mi", label: "Cơm & Mì" },
  { id: "do-uong", label: "Đồ uống" },
  { id: "trang-mieng", label: "Tráng miệng" },
];
