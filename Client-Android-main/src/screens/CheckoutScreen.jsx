import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import CheckoutFields from "../components/checkout/CheckoutFields";
import Button from "../components/common/Button";
import DashedDivider from "../components/common/DashedDivider";

import { useCart } from "../context/CartContext";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { useGlobal } from "../context/GlobalContext";
import { updateMyProfile } from "../api/customerApi";
import { formatCurrency } from "../utils/formatCurrency";
import { ROUTES } from "../constants/routes";

const PHONE_RE = /^(0|\+84)\d{9,10}$/;

/**
 * Port phần "bước 2 - thông tin giao hàng" của CartDrawer.jsx bản web.
 *
 * Mobile:
 *   - Form lấy thông tin từ hồ sơ tài khoản.
 *   - Voucher được áp dụng ở CartScreen.
 *   - CheckoutScreen nhận voucher thông qua route params.
 *   - Khi đặt hàng, chỉ truyền voucher.code cho server.
 *
 * Server vẫn phải tự kiểm tra/recalculate voucher khi tạo order.
 * Không tin finalTotal do client gửi lên.
 */
export default function CheckoutScreen() {
  const { items, totalPrice, clearCart } = useCart();
  const { placeOrder } = useSocket();
  const { customer, updateProfile } = useAuth();
  const { showToast } = useGlobal();

  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // Voucher được truyền từ CartScreen.
  const appliedVoucher = route.params?.voucher || null;

  const finalTotal = appliedVoucher
    ? appliedVoucher.finalTotal
    : totalPrice;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    note: "",
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  // Điền sẵn từ hồ sơ tài khoản mỗi khi vào màn hình.
  useEffect(() => {
    setForm({
      name: customer?.fullName || "",
      phone: customer?.phone || "",
      address: Array.isArray(customer?.addresses)
        ? customer.addresses[0] || ""
        : customer?.addresses || "",
      note: "",
    });

    setSavedProfile(false);
  }, [customer]);

  const validate = () => {
    const next = {};

    if (!form.name.trim()) {
      next.name = "Vui lòng nhập tên người nhận.";
    }

    // Phone lấy từ tài khoản và không cho sửa ở CheckoutFields.
    if (!form.phone.trim()) {
      next.phone =
        "Tài khoản chưa có số điện thoại hợp lệ, vui lòng cập nhật hồ sơ.";
    } else if (!PHONE_RE.test(form.phone.trim())) {
      next.phone =
        "Số điện thoại tài khoản không hợp lệ, vui lòng cập nhật hồ sơ.";
    }

    setErrors(next);

    return Object.keys(next).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validate()) return;

    setSavingProfile(true);

    try {
      await (updateProfile
        ? updateProfile({
            fullName: form.name,
            addresses: [form.address],
          })
        : updateMyProfile({
            fullName: form.name,
            addresses: [form.address],
          }));

      showToast("Đã lưu thông tin vào hồ sơ.");

      setSavedProfile(true);

      setTimeout(() => {
        setSavedProfile(false);
      }, 1800);
    } catch {
      showToast("Lưu hồ sơ thất bại, vui lòng thử lại.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (!items.length) {
      showToast("Giỏ hàng đang trống.");
      return;
    }

    setSubmitting(true);

    try {
      // SĐT luôn lấy từ customer.phone của tài khoản.
      //
      // Voucher chỉ truyền code.
      // Server phải tự validate/recalculate voucher khi tạo order.
      await placeOrder(
        items,
        {
          ...form,
          phone: customer?.phone || form.phone,
        },
        appliedVoucher?.code
      );

      clearCart();

      showToast("Đã gửi đơn, đang chờ quán xác nhận!");

      // Quay Cart tab về màn gốc rồi chuyển sang tab Đơn hàng.
      navigation.popToTop();
      navigation
        .getParent()
        ?.navigate(ROUTES.TAB_ORDERS);
    } catch (err) {
      showToast(
        err?.message ||
          "Gửi đơn thất bại, vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{
          paddingBottom: 24,
        }}
      >
        <Text className="font-display font-semibold text-lg text-ink mb-4">
          Thông tin giao hàng
        </Text>

        <CheckoutFields
          value={form}
          onChange={setForm}
          errors={errors}
          onSaveProfile={handleSaveProfile}
          savingProfile={savingProfile}
          savedProfile={savedProfile}
        />
      </ScrollView>

      <View
        className="px-4 pt-4"
        style={{
          paddingBottom: Math.max(24, insets.bottom),
        }}
      >
        <DashedDivider className="mb-4" />

        {/* Tổng tiền */}
        {appliedVoucher ? (
          <View className="mb-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-steel">
                Tạm tính
              </Text>

              <Text className="text-sm text-steel line-through">
                {formatCurrency(totalPrice)}
              </Text>
            </View>

            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-sm text-steel">
                Giảm giá ({appliedVoucher.code})
              </Text>

              <Text className="text-sm font-semibold text-green-600">
                -{formatCurrency(
                  appliedVoucher.discountAmount
                )}
              </Text>
            </View>

            <View className="flex-row justify-between items-center mt-2">
              <Text className="font-semibold text-ink">
                Thành tiền
              </Text>

              <Text className="font-semibold text-chili-dark">
                {formatCurrency(finalTotal)}
              </Text>
            </View>
          </View>
        ) : null}

        <Button
          fullWidth
          onPress={handleSubmit}
          loading={submitting}
        >
          {submitting
            ? "Đang gửi..."
            : `Đặt hàng · ${formatCurrency(finalTotal)}`}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}