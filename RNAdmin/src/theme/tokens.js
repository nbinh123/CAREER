// src/theme/tokens.js
// [NEN-MONG 1.11] Bảng màu dùng lặp lại nhiều nơi trong bản gốc (Tailwind
// green-50..900, emerald-, red-50/100/500/600, amber-500, blue-500, rose-500,
// gray-...). Với NativeWind, phần lớn UI vẫn dùng thẳng className
// ("bg-green-500", "text-emerald-700"...) y hệt bản web — palette mặc định
// của Tailwind đã khớp 100% vì tailwind.config.js gốc không customize theme.
//
// File này chỉ cần cho những chỗ KHÔNG thể dùng className (props nhận thẳng
// màu: LinearGradient colors=[...], react-native-svg stroke/fill, Reanimated
// interpolateColor...). Giá trị hex lấy đúng từ Tailwind v3 palette để đảm
// bảo đồng nhất tuyệt đối với các className đang dùng song song.
export const colors = {
  green: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    900: "#064e3b",
  },
  red: {
    50: "#fef2f2",
    100: "#fee2e2",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
  },
  amber: { 500: "#f59e0b" },
  blue: { 500: "#3b82f6" },
  rose: { 500: "#f43f5e" },
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
  white: "#ffffff",
  black: "#000000",
};

export default colors;
