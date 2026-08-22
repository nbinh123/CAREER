// src/pages/ForbiddenPage.js
// [UI] Gộp components/ForbiddenPage.js + pages/403Page.js — 2 file bản gốc
// gần như trùng chức năng (đều chỉ hiện "không có quyền truy cập"), theo
// đúng gợi ý ở progress.md Giai đoạn 3 ("nếu trùng thì gộp"). Nhận thêm
// prop `reason` để hiện thông điệp phù hợp hơn tuỳ ngữ cảnh gọi tới từ
// ProtectedScreen (không đổi ý nghĩa nghiệp vụ, chỉ làm rõ hơn cho người
// dùng cuối).
import React from "react";
import { View, Text } from "react-native";
import { ShieldAlert } from "lucide-react-native";
import colors from "../theme/tokens";

const MESSAGES = {
  unauthenticated: "Vui lòng đăng nhập để tiếp tục.",
  "not-working": "Bạn đang ở trạng thái tạm dừng hoạt động.",
  forbidden: "Bạn không có quyền truy cập trang này.",
};

export default function ForbiddenPage({ reason = "forbidden" }) {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6">
      <View className="w-16 h-16 rounded-2xl bg-red-50 items-center justify-center mb-4">
        <ShieldAlert size={28} color={colors.red[500]} strokeWidth={2.2} />
      </View>
      <Text className="text-lg font-extrabold text-gray-800 mb-1">403 — Không có quyền truy cập</Text>
      <Text className="text-sm text-gray-500 text-center">
        {MESSAGES[reason] || MESSAGES.forbidden}
      </Text>
    </View>
  );
}
