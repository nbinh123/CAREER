import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ChevronUp } from "lucide-react-native";
import { useCart } from "../../context/CartContext";
import { formatCurrency } from "../../utils/formatCurrency";
import { COLORS } from "../../theme/tokens";
import { ROUTES } from "../../constants/routes";

/**
 * Port từ src/components/cart/CartFloatingButton.jsx bản web, NHƯNG đổi
 * hành vi bấm: bản web mở CartDrawer (modal) vì không có trang giỏ hàng
 * riêng. Bản RN đã có SẴN tab "Giỏ hàng" riêng trong Main Tab Navigator
 * (mục 5.1 kế hoạch) nên bấm nút này giờ CHUYỂN TAB thay vì mở modal —
 * tránh có 2 con đường khác nhau (tab + modal) cùng dẫn tới giỏ hàng.
 *
 * Vẫn giữ nguyên vai trò "xem nhanh tổng tiền + số món mà không cần rời
 * trang Menu/Trái cây" — chỉ đổi đích đến.
 */
export default function CartFloatingButton() {
  const { totalCount, totalPrice } = useCart();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  if (totalCount === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 px-4"
      style={{ bottom: 12 + insets.bottom }}
    >
      <Pressable
        onPress={() => navigation.navigate(ROUTES.TAB_CART)}
        className="flex-row items-center justify-between bg-ink rounded-full pl-2 pr-4 py-2"
        style={{
          shadowColor: COLORS.ink,
          shadowOpacity: 0.18,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
          elevation: 6,
        }}
      >
        <View className="flex-row items-center gap-2">
          <View className="items-center justify-center w-9 h-9 rounded-full bg-chili">
            <Text className="font-mono font-semibold text-sm text-paper">{totalCount}</Text>
          </View>
          <Text className="font-display text-sm font-medium text-paper">Xem đơn của bạn</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text className="font-mono font-semibold text-sm text-turmeric">
            {formatCurrency(totalPrice)}
          </Text>
          <ChevronUp size={16} color={COLORS.turmeric} />
        </View>
      </Pressable>
    </View>
  );
}
