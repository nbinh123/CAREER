// Thang khoảng cách dùng chung cho toàn app, dựng theo tỉ lệ vàng (φ ≈
// 1.618) thay vì chọn số tuỳ tiện. Dùng dãy Fibonacci (8, 13, 21, 34, 55,
// 89...) vì tỉ số giữa 2 số liền kề tiệm cận φ (21/13 ≈ 1.615, 34/21 ≈
// 1.619...) mà vẫn ra số nguyên đẹp, dễ dùng trên lưới pixel của RN — thay
// vì φ^n lẻ số thập phân.
//
// Quy tắc dùng: mọi padding/margin/gap mới nên lấy từ đây thay vì hard-code,
// để nhịp khoảng cách nhất quán giữa các màn hình (đổi 1 chỗ, đồng bộ toàn
// app). Không cần đổi những chỗ cũ chưa đụng tới trong đợt sửa này.
export const SPACING = {
  xs: 8,
  sm: 13,
  md: 21,
  lg: 34,
  xl: 55,
  xxl: 89,
};

export const PHI = 1.618;

// ── Thanh tab dưới cùng (MainTabNavigator) ─────────────────────────────
// Icon 24 + label ~14 + khoảng cách giữa 2 thứ đó ≈ 46 chiều cao nội dung.
// Padding trên/dưới lấy đúng 1 cặp Fibonacci liền kề (13 & 21) để tỉ lệ
// dưới/trên ≈ φ — đáy rộng hơn đỉnh vì đó là vùng ngón tay chạm tới và cần
// né vùng cử chỉ điều hướng của Android, không phải chọn ngẫu nhiên.
export const TAB_BAR_CONTENT_HEIGHT = 46;
export const TAB_BAR_PADDING_TOP = SPACING.sm; // 13
export const TAB_BAR_PADDING_BOTTOM = SPACING.md; // 21
export const TAB_BAR_BASE_HEIGHT =
  TAB_BAR_CONTENT_HEIGHT + TAB_BAR_PADDING_TOP + TAB_BAR_PADDING_BOTTOM; // 80

// Dùng ở những component KHÔNG nằm trong cây Tab.Navigator (ví dụ
// ChatWidget — mount ở gốc app ngang hàng NavigationContainer, xem
// AppProviders.jsx) nhưng vẫn cần biết thanh tab dưới cùng đang chiếm bao
// nhiêu chỗ để không bị nó che, hoặc để không đè lên nó.
export function getTabBarHeight(insetBottom = 0) {
  return TAB_BAR_BASE_HEIGHT + insetBottom;
}

// Kích thước logo ở Header: icon trong tab bar là 24 — logo phóng theo φ
// (24 × 1.618 ≈ 38.8) làm tròn 40, vừa đủ nổi bật mà vẫn theo đúng nhịp tỉ
// lệ với phần còn lại của giao diện thay vì chọn số tuỳ ý.
export const HEADER_LOGO_SIZE = 40;
