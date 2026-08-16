import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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
 * Port phần "bước 2 - thông tin giao hàng" của CartDrawer.jsx bản web, với
 * khác biệt cốt lõi theo mục 5.3 kế hoạch: form được điền sẵn từ HỒ SƠ TÀI
 * KHOẢN (useAuth().customer — tên/SĐT/địa chỉ đã đăng ký) thay vì từ
 * CustomerContext ẩn danh + localStorage như bản web, vì khách mobile bắt
 * buộc đã đăng nhập bằng tài khoản thật.
 *
 * "Lưu thông tin cho lần sau" giờ là hành động PATCH /api/customers/me thật
 * sự (api/customerApi.js) thay vì ghi localStorage.
 */
export default function CheckoutScreen() {
  const { items, totalPrice, clearCart } = useCart();
  const { placeOrder } = useSocket();
  const { customer, updateProfile } = useAuth();
  const { showToast } = useGlobal();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  // Điền sẵn từ hồ sơ tài khoản mỗi khi vào màn hình — tương đương việc bản
  // web điền sẵn từ `profile` (CustomerContext) mỗi khi mở CartDrawer.
  useEffect(() => {
    setForm({
      name: customer?.fullName || "",
      phone: customer?.phone || "",
      address: Array.isArray(customer?.addresses) ? customer.addresses[0] || "" : customer?.addresses || "",
      note: "",
    });
    setSavedProfile(false);
  }, [customer]);

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Vui lòng nhập tên người nhận.";
    // Phone giờ khoá theo tài khoản (không cho gõ tay ở CheckoutFields), nên
    // 2 lỗi dưới đây chỉ còn xảy ra nếu hồ sơ tài khoản thiếu/sai SĐT — báo
    // đúng nguyên nhân thay vì bảo "vui lòng nhập" (khách không gõ được nữa).
    if (!form.phone.trim()) next.phone = "Tài khoản chưa có số điện thoại hợp lệ, vui lòng cập nhật hồ sơ.";
    else if (!PHONE_RE.test(form.phone.trim())) next.phone = "Số điện thoại tài khoản không hợp lệ, vui lòng cập nhật hồ sơ.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validate()) return;
    setSavingProfile(true);
    try {
      // updateProfile (từ AuthContext, xem ghi chú THAM KHẢO/DỰ PHÒNG ở đầu
      // file đó) gọi PATCH /api/customers/me rồi tự cập nhật `customer` —
      // nếu AuthContext thật của bạn ở giai đoạn 4 không có hàm này, đổi
      // dòng dưới sang gọi thẳng updateMyProfile(...) từ api/customerApi.js.
      await (updateProfile
        ? updateProfile({ fullName: form.name, addresses: [form.address] })
        : updateMyProfile({ fullName: form.name, addresses: [form.address] }));
      showToast("Đã lưu thông tin vào hồ sơ.");
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 1800);
    } catch {
      showToast("Lưu hồ sơ thất bại, vui lòng thử lại.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Chốt lại 1 lần nữa ngay tại điểm gửi đơn: SĐT nhận đơn LUÔN LUÔN lấy
      // từ customer.phone (tài khoản đang đăng nhập/đăng nhập nhanh), không
      // dùng form.phone dù ô đó đã bị khoá không cho sửa ở CheckoutFields —
      // để chắc chắn không có đường nào gửi lệch SĐT khỏi tài khoản, kể cả
      // nếu sau này có ai đó vô tình mở lại quyền sửa ô này.
      await placeOrder(items, { ...form, phone: customer?.phone || form.phone });
      clearCart();
      showToast("Đã gửi đơn, đang chờ quán xác nhận!");
      // Quay Cart tab về màn gốc rồi mới chuyển sang tab Đơn hàng — tránh
      // lần sau mở tab Giỏ hàng bị kẹt lại ở CheckoutScreen với giỏ trống.
      navigation.popToTop();
      navigation.getParent()?.navigate(ROUTES.TAB_ORDERS);
    } catch (err) {
      showToast("Gửi đơn thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="font-display font-semibold text-lg text-ink mb-4">Thông tin giao hàng</Text>
        <CheckoutFields
          value={form}
          onChange={setForm}
          errors={errors}
          onSaveProfile={handleSaveProfile}
          savingProfile={savingProfile}
          savedProfile={savedProfile}
        />
      </ScrollView>

      <View className="px-4 pt-4" style={{ paddingBottom: Math.max(24, insets.bottom) }}>
        <DashedDivider className="mb-4" />
        <Button fullWidth onPress={handleSubmit} loading={submitting}>
          {submitting ? "Đang gửi..." : `Đặt hàng · ${formatCurrency(totalPrice)}`}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}