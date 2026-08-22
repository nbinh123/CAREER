import React, { useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import axios from "axios";
import { CircleAlert, UserPlus } from "lucide-react-native";
import useAuthZustand from "../zustand/useAuthZustand";
import { API_URL } from "../config/api";
import AuthBackground from "../components/AuthBackground";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../theme/tokens";

const endpoint = `${API_URL}/api/users/register`;

const ROLES = [
  { value: "staff", label: "👷 Nhân viên" },
  { value: "cashier", label: "💰 Thu ngân" },
  { value: "chef", label: "👨‍🍳 Đầu bếp" },
  { value: "manager", label: "📋 Quản lý" },
  { value: "admin", label: "🛡️ Admin" },
];

const FIELDS = [
  { key: "fullName", label: "Họ và tên", placeholder: "Nguyễn Văn A", keyboardType: "default", maxLength: undefined },
  { key: "phone", label: "Số điện thoại", placeholder: "0xxxxxxxxx", keyboardType: "number-pad", maxLength: 10 },
  { key: "citizenId", label: "Số CCCD", placeholder: "012345678901", keyboardType: "number-pad", maxLength: 12 },
  { key: "username", label: "Tên đăng nhập", placeholder: "Không bắt buộc", keyboardType: "default", maxLength: undefined },
];

export default function RegisterPage() {
  const accessToken = useAuthZustand((state) => state.accessToken);

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    phone: "",
    citizenId: "",
    role: "staff",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const validators = {
    fullName: (v) => (!v.trim() ? "Vui lòng nhập họ tên" : ""),
    phone: (v) => {
      if (!v) return "Vui lòng nhập số điện thoại";
      if (!/^\d+$/.test(v)) return "Chỉ chứa chữ số";
      if (v.length !== 10) return `Cần đủ 10 chữ số (hiện ${v.length})`;
      return "";
    },
    citizenId: (v) => {
      if (!v) return "Vui lòng nhập số CCCD";
      if (!/^\d+$/.test(v)) return "Chỉ chứa chữ số";
      if (v.length !== 12) return `CCCD cần đúng 12 số (hiện ${v.length})`;
      return "";
    },
    username: (v) => {
      if (!v) return "";
      if (v.length < 3) return "Tối thiểu 3 ký tự";
      if (!/^[a-zA-Z0-9_]+$/.test(v)) return "Chỉ dùng chữ, số, dấu _";
      return "";
    },
    role: () => "",
  };

  function validateAll() {
    const newErrors = {};
    Object.keys(validators).forEach((key) => {
      const err = validators[key](form[key]);
      if (err) newErrors[key] = err;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(key, raw) {
    let val = raw;
    if (key === "phone") val = raw.replace(/\D/g, "").slice(0, 10);
    if (key === "citizenId") val = raw.replace(/\D/g, "").slice(0, 12);

    setForm((prev) => ({ ...prev, [key]: val }));

    if (errors[key]) {
      const err = validators[key](val);
      setErrors((prev) => ({ ...prev, [key]: err }));
    }
  }

  async function handleSubmit() {
    if (loading) return;
    if (!validateAll()) return;

    setLoading(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone,
        citizenId: form.citizenId,
        role: form.role,
      };
      if (form.username.trim()) {
        payload.username = form.username.trim();
      }

      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const result = response.data;

      if (!result.success) {
        showToast("❌ " + (result.message || "Đăng ký thất bại"));
        return;
      }

      const defaultPwd = result.defaultPassword ?? form.citizenId.slice(-6);
      showToast(`✅ Tạo tài khoản thành công! Mật khẩu mặc định: ${defaultPwd}`);

      setForm({ fullName: "", username: "", phone: "", citizenId: "", role: "staff" });
      setErrors({});
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Lỗi server";
      showToast("❌ " + msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <AuthBackground>
          <View className="items-center mb-6">
            <View className="w-14 h-14 rounded-2xl bg-emerald-50 items-center justify-center mb-2">
              <UserPlus size={24} color={colors.emerald[600]} strokeWidth={2.2} />
            </View>
            <Text className="text-lg font-black text-emerald-900">Đăng ký nhân viên</Text>
            <Text className="text-[13px] font-medium text-emerald-300">Tạo tài khoản mới cho nhân viên</Text>
          </View>

          {FIELDS.map((f) => (
            <View key={f.key} className="mb-3.5">
              <Text className="text-xs font-extrabold text-emerald-800 tracking-wide mb-2 uppercase">
                {f.label} {f.key !== "username" && <Text className="text-red-400">*</Text>}
              </Text>
              <TextInput
                className={`bg-green-50 border-2 rounded-2xl px-3.5 py-3 text-[15px] font-semibold text-emerald-900 ${
                  errors[f.key] ? "border-red-300" : "border-green-200"
                }`}
                placeholder={f.placeholder}
                placeholderTextColor={colors.emerald[200]}
                value={form[f.key]}
                onChangeText={(t) => handleChange(f.key, t)}
                keyboardType={f.keyboardType}
                maxLength={f.maxLength}
                autoCapitalize={f.key === "fullName" ? "words" : "none"}
              />
              {!!errors[f.key] && (
                <View className="flex-row items-center gap-1.5 mt-1.5">
                  <CircleAlert size={12} color={colors.red[500]} />
                  <Text className="text-xs font-bold text-red-500">{errors[f.key]}</Text>
                </View>
              )}
            </View>
          ))}

          {/* role select → chip list */}
          <View className="mb-5">
            <Text className="text-xs font-extrabold text-emerald-800 tracking-wide mb-2 uppercase">
              Vai trò
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ROLES.map((r) => {
                const active = form.role === r.value;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => handleChange("role", r.value)}
                    className={`px-3.5 py-2 rounded-full border-2 ${
                      active ? "bg-emerald-500 border-emerald-500" : "bg-green-50 border-green-200"
                    }`}
                  >
                    <Text className={`text-sm font-bold ${active ? "text-white" : "text-emerald-700"}`}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <PrimaryButton
            onPress={handleSubmit}
            loading={loading}
            label="Tạo tài khoản"
            loadingLabel="Đang tạo…"
            icon={<UserPlus size={16} color={colors.white} strokeWidth={2.8} />}
          />
        </AuthBackground>
      </ScrollView>

      {toast && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOutDown.duration(300)}
          className="absolute left-0 right-0 bottom-8 items-center px-6"
        >
          <View className="bg-emerald-900 px-5 py-2.5 rounded-full">
            <Text className="text-emerald-300 text-[13px] font-extrabold text-center">{toast}</Text>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
