import React from "react";
import { View, Text, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import CartItem from "../components/cart/CartItem";
import Button from "../components/common/Button";
import DashedDivider from "../components/common/DashedDivider";
import { useCart } from "../context/CartContext";
import { formatCurrency } from "../utils/formatCurrency";
import { ROUTES } from "../constants/routes";

/**
 * Port phần "bước 1 - xem giỏ hàng" của src/components/cart/CartDrawer.jsx
 * bản web. Bản web gộp cả 2 bước (giỏ hàng + thông tin giao hàng) vào 1
 * modal chuyển bước nội bộ (`step` state); bản RN tách thành 2 SCREEN riêng
 * trong cùng 1 stack navigator của tab "Giỏ hàng" (CartScreen -> điều hướng
 * push sang CheckoutScreen) — khớp đúng cấu trúc "Giỏ hàng" là 1 tab riêng
 * đã chốt ở mục 5.1 kế hoạch, thay vì 1 modal nổi trên Menu.
 */
export default function CartScreen() {
  const { items, updateQty, totalPrice, totalCount } = useCart();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-paper">
      <View className="px-4 pt-4 pb-2">
        <Text className="font-display font-semibold text-lg text-ink">
          Đơn của bạn{totalCount ? ` · ${totalCount} món` : ""}
        </Text>
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-steel text-sm text-center">Giỏ hàng của bạn đang trống.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CartItem item={item} onUpdateQty={updateQty} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        />
      )}

      {items.length > 0 && (
        <View className="px-4 pt-4" style={{ paddingBottom: Math.max(24, insets.bottom) }}>
          <DashedDivider className="mb-4" />
          <Button fullWidth onPress={() => navigation.navigate(ROUTES.CHECKOUT_SCREEN)}>
            {`Tiếp tục · ${formatCurrency(totalPrice)}`}
          </Button>
        </View>
      )}
    </View>
  );
}
