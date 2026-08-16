import React from "react";
import { ScrollView, Pressable, Text } from "react-native";
import { SPACING } from "../../theme/layout";

// Port từ src/components/menu/CategoryTabs.jsx bản web. Web dùng
// `sticky top-[64px]` để dính dưới Header khi cuộn trang — RN không có
// sticky trong ScrollView thường; nếu muốn giữ hành vi dính y hệt, đặt
// component này NGOÀI ScrollView của danh sách món (làm header cố định của
// screen) thay vì cuộn cùng — xem cách dùng ở MenuScreen.jsx.
//
// Trước đây paddingHorizontal 16 khiến tab đầu/cuối gần như dính sát mép
// màn hình (chữ bị cắt ngay viền khi cuộn) — đổi sang SPACING.md (21) để
// luôn còn khoảng thở 2 bên, và gap giữa các tab tăng theo SPACING.sm (13)
// cho thoáng hơn, đúng thang tỉ lệ vàng dùng chung toàn app.
//
// ── Lịch sử bug chiều cao khu vực tab (đọc để không lặp lại) ───────────
// Cả 3 lỗi liên tiếp gặp phải (chữ "Lẩu"/"Mì cay" vỡ/tràn xuống mép pill;
// rồi cả hàng tab trôi giữa 1 khoảng trống lớn; rồi khoảng trống lại xuất
// hiện giữa hàng tab và nội dung bên dưới) đều CÙNG một gốc: để Android tự
// suy ra ("auto") chiều cao của khu vực tab dựa trên đo nội dung con, thay
// vì khoá cứng bằng số cụ thể. Mỗi lần chỉ cố định MỘT lớp (chỉ pill, hoặc
// chỉ bỏ 1 thuộc tính) thì lớp còn lại (ScrollView bọc ngoài) vẫn tự đoán
// và có thể giãn lệch. Lần này khoá cứng CẢ HAI lớp cùng lúc bằng số học
// rõ ràng, không còn lớp nào phải tự đo nữa:
//   - Pill (Pressable): height cố định PILL_HEIGHT, tự canh giữa chữ bên
//     trong bằng alignItems/justifyContent (không dùng paddingVertical để
//     "đẻ" ra chiều cao như trước).
//   - Khối bọc ngoài (ScrollView): height cố định TABS_HEIGHT = đúng bằng
//     PILL_HEIGHT + phần đệm trên/dưới (SPACING.sm mỗi bên) — tính sẵn
//     bằng công thức, không để Android tự đo từ nội dung con nữa. Đây là
//     điểm còn thiếu ở lần sửa trước, khiến khối ScrollView vẫn có thể tự
//     giãn ra dù bên trong pill đã cố định.
const PILL_HEIGHT = 44; // đủ chỗ cho text-sm (14px, lineHeight 22) + dư khoảng thở cho dấu tiếng Việt, đồng thời đạt mức tối thiểu vùng chạm chuẩn (44dp) trên Android.
const TABS_HEIGHT = PILL_HEIGHT + SPACING.sm * 2; // 44 + 13*2 = 70 — khoá cứng chiều cao cả khối, không để ScrollView tự đo từ nội dung con.

export default function CategoryTabs({ categories, activeId, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="bg-paper border-b border-ink/5"
      style={{ height: TABS_HEIGHT, flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        gap: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
      }}
    >
      {categories.map((cat) => {
        const active = cat.id === activeId;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onChange(cat.id)}
            className={`rounded-full px-5 items-center justify-center ${active ? "bg-ink" : "bg-paper-dim"}`}
            style={{ height: PILL_HEIGHT, flexShrink: 0 }}
          >
            <Text
              numberOfLines={1}
              className={`font-display font-medium text-sm ${active ? "text-paper" : "text-steel"}`}
              style={{ lineHeight: 22 }}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}