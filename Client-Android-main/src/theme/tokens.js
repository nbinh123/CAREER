// Bảng màu thô (hex) — dùng ở những chỗ NativeWind className KHÔNG áp dụng
// được, ví dụ prop `color` của icon (lucide-react-native), hoặc `tintColor`
// của ActivityIndicator. Với style thường (nền, viền, chữ...) cứ dùng
// className NativeWind như bảng bên dưới, không cần import file này.
//
// Nguồn: mục 5.1b kế hoạch — kế thừa NGUYÊN token đã định nghĩa trong
// tailwind.config.js của Client-Online (bản web). Đổi màu ở ĐÚNG 1 chỗ này
// (và tailwind.config.js gốc RN ở dưới) để đồng bộ 2 bên.
export const COLORS = {
  ink: "#221B14",
  inkSoft: "#332A1F",
  paper: "#FBF6EC",
  paperDim: "#F1EADA",
  chili: "#D6361F",
  chiliDark: "#B32B18",
  chiliLight: "#F0E1DB",
  turmeric: "#E8A93E",
  turmericDark: "#C98A24",
  turmericLight: "#FBEED2",
  jade: "#2E6F55",
  jadeLight: "#DCEBE3",
  steel: "#7A7267",
  steelLight: "#B9B2A4",
  // Màu đường viền đứt (dashed-divider trong index.css bản web) — dùng cho
  // DashedDivider.jsx vì borderColor không nhận className NativeWind theo
  // opacity giống web (border-ink/10 không tính ra đúng giá trị này).
  divider: "#D8CFBA",
};
