import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogOut, Phone, User as UserIcon } from "lucide-react-native";
import Button from "../components/common/Button";
import DashedDivider from "../components/common/DashedDivider";
import { useAuth } from "../context/AuthContext";
import { useGlobal } from "../context/GlobalContext";
import { COLORS } from "../theme/tokens";

// Tab "Tài khoản" thuộc phạm vi Giai đoạn 4 theo tài liệu gốc (hồ sơ, đổi
// mật khẩu, đăng xuất). Bản chạy độc lập này thêm 1 bản TỐI GIẢN — chỉ hiện
// thông tin + nút đăng xuất — để có đủ luồng dùng thử end-to-end. Có thể
// thay bằng màn Tài khoản đầy đủ hơn sau này mà không ảnh hưởng phần Giai
// đoạn 5 (Menu/Trái cây/Giỏ hàng/Đơn hàng/Chat).
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { customer, logout } = useAuth();
  const { restaurant, showToast } = useGlobal();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      showToast("Có lỗi khi đăng xuất, đã đăng xuất cục bộ.", "error");
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 24,
      }}
    >
      <Text className="font-display text-2xl text-ink mb-1">Tài khoản</Text>
      <Text className="font-body text-sm text-steel mb-8">{restaurant.name}</Text>

      <View className="bg-white rounded-ticket border border-ink/10 p-5 gap-4">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-chili-light items-center justify-center">
            <UserIcon size={18} color={COLORS.chili} strokeWidth={2} />
          </View>
          <View>
            <Text className="font-bodyMedium text-xs text-steel">Họ và tên</Text>
            <Text className="font-body text-ink">{customer?.fullName || "—"}</Text>
          </View>
        </View>

        <DashedDivider />

        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-jade-light items-center justify-center">
            <Phone size={18} color={COLORS.jade} strokeWidth={2} />
          </View>
          <View>
            <Text className="font-bodyMedium text-xs text-steel">Số điện thoại</Text>
            <Text className="font-body text-ink">{customer?.phone || "—"}</Text>
          </View>
        </View>
      </View>

      <Button
        className="mt-8"
        variant="outline"
        icon={LogOut}
        iconColor={COLORS.ink}
        fullWidth
        onPress={handleLogout}
      >
        Đăng xuất
      </Button>
    </ScrollView>
  );
}
