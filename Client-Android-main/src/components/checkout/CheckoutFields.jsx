import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { BookmarkPlus, BookmarkCheck } from "lucide-react-native";
import { COLORS } from "../../theme/tokens";

/**
 * Port từ src/components/checkout/CheckoutFields.jsx bản web, với 1 thay đổi
 * theo đúng mục 5.3 kế hoạch: khách mobile đã có TÀI KHOẢN thật (không còn
 * "khách ẩn danh" như web), nên:
 *
 *   - `value` được CheckoutScreen tự động điền sẵn từ hồ sơ tài khoản
 *     (useAuth().customer) khi vào màn hình, thay vì đọc localStorage.
 *   - Nút "Lưu thông tin cho lần sau" (onSave/saved ở bản web, ghi vào
 *     CustomerContext + localStorage) đổi thành `onSaveProfile`/`savingProfile`
 *     — gọi PATCH /api/customers/me (api/customerApi.js) để lưu thẳng lên
 *     tài khoản, dùng chung cho mọi thiết bị khách đăng nhập sau này.
 *
 * `errors` vẫn chỉ validate 2 trường bắt buộc (tên, SĐT) giống hệt bản web.
 */
const inputBase =
  "w-full rounded-2xl bg-paper-dim border border-ink/10 px-4 py-3 text-sm text-ink";

export default function CheckoutFields({
  value,
  onChange,
  errors = {},
  onSaveProfile,
  savingProfile = false,
  savedProfile = false,
}) {
  const set = (field) => (text) => onChange({ ...value, [field]: text });

  return (
    <View className="gap-4">
      <View>
        <Text className="text-xs font-display font-medium text-steel mb-1.5">Tên người nhận *</Text>
        <TextInput
          value={value.name}
          onChangeText={set("name")}
          placeholder="Nguyễn Văn A"
          placeholderTextColor={COLORS.steelLight}
          className={inputBase}
        />
        {errors.name && <Text className="text-[11px] text-chili mt-1">{errors.name}</Text>}
      </View>

      <View>
        <Text className="text-xs font-display font-medium text-steel mb-1.5">Số điện thoại *</Text>
        <TextInput
          value={value.phone}
          onChangeText={set("phone")}
          placeholder="09xx xxx xxx"
          placeholderTextColor={COLORS.steelLight}
          keyboardType="phone-pad"
          className={inputBase}
        />
        {errors.phone && <Text className="text-[11px] text-chili mt-1">{errors.phone}</Text>}
      </View>

      <View>
        <Text className="text-xs font-display font-medium text-steel mb-1.5">Địa chỉ giao hàng</Text>
        <TextInput
          value={value.address}
          onChangeText={set("address")}
          placeholder="Số nhà, đường, phường/xã..."
          placeholderTextColor={COLORS.steelLight}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          className={`${inputBase} min-h-[64px]`}
        />
      </View>

      <View>
        <Text className="text-xs font-display font-medium text-steel mb-1.5">Ghi chú</Text>
        <TextInput
          value={value.note}
          onChangeText={set("note")}
          placeholder="Ví dụ: giao trước 12h, không hành..."
          placeholderTextColor={COLORS.steelLight}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          className={`${inputBase} min-h-[64px]`}
        />
      </View>

      {onSaveProfile && (
        <Pressable
          onPress={onSaveProfile}
          disabled={savingProfile}
          className={`flex-row items-center justify-center gap-1.5 py-2.5 rounded-full border ${
            savedProfile ? "border-jade/40 bg-jade-light" : "border-ink/15"
          } ${savingProfile ? "opacity-50" : ""}`}
        >
          {savedProfile ? (
            <BookmarkCheck size={14} color={COLORS.jade} />
          ) : (
            <BookmarkPlus size={14} color={COLORS.steel} />
          )}
          <Text
            className={`text-xs font-display font-medium ${savedProfile ? "text-jade" : "text-steel"}`}
          >
            {savingProfile
              ? "Đang lưu..."
              : savedProfile
              ? "Đã lưu vào hồ sơ"
              : "Lưu địa chỉ này vào hồ sơ"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
