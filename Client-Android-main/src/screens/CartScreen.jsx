import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
} from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import CartItem from "../components/cart/CartItem";
import Button from "../components/common/Button";
import DashedDivider from "../components/common/DashedDivider";

import { useCart } from "../context/CartContext";
import { useSocket } from "../context/SocketContext";
import { formatCurrency } from "../utils/formatCurrency";
import { ROUTES } from "../constants/routes";

/**
 * Port phần "bước 1 - xem giỏ hàng" của CartDrawer.jsx bản web.
 *
 * Mobile có flow riêng:
 *   CartScreen -> CheckoutScreen
 *
 * Voucher được áp dụng ngay tại CartScreen.
 * Sau khi voucher được server xác thực thành công, thông tin voucher
 * được truyền sang CheckoutScreen thông qua route params.
 *
 * Lưu ý:
 * - Voucher được validate dựa trên items hiện tại trong giỏ.
 * - Khi giỏ hàng thay đổi, voucher hiện tại bị reset để tránh sử dụng
 *   kết quả validate cũ cho một giỏ hàng khác.
 */
export default function CartScreen() {
  const { items, updateQty, totalPrice, totalCount } = useCart();
  const { validateVoucher } = useSocket();

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherError, setVoucherError] = useState("");

  // Khi giỏ hàng thay đổi, voucher đã validate trước đó không còn được
  // đảm bảo hợp lệ với giỏ hàng mới -> reset voucher.
  useEffect(() => {
    setAppliedVoucher(null);
    setVoucherInput("");
    setVoucherError("");
  }, [items]);

  const handleApplyVoucher = async () => {
    const code = voucherInput.trim();

    if (!code) {
      setVoucherError("Vui lòng nhập mã voucher");
      return;
    }

    if (!items.length) {
      setVoucherError("Giỏ hàng đang trống");
      return;
    }

    setVoucherChecking(true);
    setVoucherError("");

    try {
      const result = await validateVoucher(code, items);

      setAppliedVoucher(result);
    } catch (err) {
      setAppliedVoucher(null);
      setVoucherError(
        err?.message || "Voucher không hợp lệ"
      );
    } finally {
      setVoucherChecking(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput("");
    setVoucherError("");
  };

  const checkoutTotal = appliedVoucher
    ? appliedVoucher.finalTotal
    : totalPrice;

  return (
    <View className="flex-1 bg-paper">
      <View className="px-4 pt-4 pb-2">
        <Text className="font-display font-semibold text-lg text-ink">
          Đơn của bạn{totalCount ? ` · ${totalCount} món` : ""}
        </Text>
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-steel text-sm text-center">
            Giỏ hàng của bạn đang trống.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onUpdateQty={updateQty}
              />
            )}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 16,
            }}
          />

          <View
            className="px-4 pt-4"
            style={{
              paddingBottom: Math.max(24, insets.bottom),
            }}
          >
            <DashedDivider className="mb-4" />

            {/* Voucher */}
            {!appliedVoucher ? (
              <View className="mb-3">
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={voucherInput}
                    onChangeText={(text) =>
                      setVoucherInput(text.toUpperCase())
                    }
                    placeholder="Nhập mã giảm giá"
                    placeholderTextColor="#8A8A8A"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-ink/10 text-sm bg-paper"
                  />

                  <Button
                    variant="outline"
                    onPress={handleApplyVoucher}
                    disabled={
                      voucherChecking ||
                      !voucherInput.trim()
                    }
                  >
                    {voucherChecking
                      ? "Đang kiểm tra..."
                      : "Áp dụng"}
                  </Button>
                </View>

                {voucherError ? (
                  <Text className="text-chili-dark text-xs mt-1.5">
                    {voucherError}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View className="flex-row items-center justify-between bg-paper-dim rounded-xl px-3 py-2 mb-3">
                <View className="flex-1">
                  <Text className="text-sm text-ink">
                    Đã áp mã
                  </Text>

                  <Text className="font-semibold">
                    {appliedVoucher.code}
                  </Text>

                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-steel line-through">
                      {formatCurrency(totalPrice)}
                    </Text>

                    <Text className="text-sm font-semibold text-green-600">
                      {formatCurrency(
                        appliedVoucher.finalTotal
                      )}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={handleRemoveVoucher}
                  className="p-1 rounded-full"
                  accessibilityRole="button"
                  accessibilityLabel="Bỏ mã voucher"
                >
                  <X size={16} color="#777" />
                </Pressable>
              </View>
            )}

            <Button
              fullWidth
              onPress={() =>
                navigation.navigate(
                  ROUTES.CHECKOUT_SCREEN,
                  {
                    voucher: appliedVoucher,
                  }
                )
              }
            >
              {`Tiếp tục · ${formatCurrency(checkoutTotal)}`}
            </Button>
          </View>
        </>
      )}
    </View>
  );
}