import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import Button from "../components/common/Button";
import { useAuth } from "../context/AuthContext";
import { useGlobal } from "../context/GlobalContext";
import { COLORS } from "../theme/tokens";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { register } = useAuth();
  const { showToast } = useGlobal();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    if (!fullName.trim()) next.fullName = "Vui lòng nhập họ tên.";
    if (!phone.trim()) next.phone = "Vui lòng nhập số điện thoại.";
    if (!password || password.length < 6)
      next.password = "Mật khẩu cần tối thiểu 6 ký tự.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(phone.trim(), password, fullName.trim());
    } catch (err) {
      const message =
        err?.response?.data?.message || "Không đăng ký được, vui lòng thử lại.";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text onPress={() => navigation.goBack()} className="mb-6">
          <ArrowLeft size={22} color={COLORS.ink} strokeWidth={2} />
        </Text>

        <Text className="font-display text-2xl text-ink mb-1">Tạo tài khoản</Text>
        <Text className="font-body text-sm text-steel mb-8">
          Đăng ký nhanh để đặt món và theo dõi đơn hàng.
        </Text>

        <View className="gap-4">
          <View>
            <Text className="font-bodyMedium text-xs text-steel mb-1.5">Họ và tên</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nguyễn Văn A"
              className={`font-body text-ink bg-white rounded-2xl px-4 py-3 border ${
                errors.fullName ? "border-chili" : "border-ink/10"
              }`}
            />
            {errors.fullName ? (
              <Text className="font-body text-xs text-chili mt-1">{errors.fullName}</Text>
            ) : null}
          </View>

          <View>
            <Text className="font-bodyMedium text-xs text-steel mb-1.5">
              Số điện thoại
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              autoCapitalize="none"
              className={`font-body text-ink bg-white rounded-2xl px-4 py-3 border ${
                errors.phone ? "border-chili" : "border-ink/10"
              }`}
            />
            {errors.phone ? (
              <Text className="font-body text-xs text-chili mt-1">{errors.phone}</Text>
            ) : null}
          </View>

          <View>
            <Text className="font-bodyMedium text-xs text-steel mb-1.5">Mật khẩu</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Tối thiểu 6 ký tự"
              secureTextEntry
              autoCapitalize="none"
              className={`font-body text-ink bg-white rounded-2xl px-4 py-3 border ${
                errors.password ? "border-chili" : "border-ink/10"
              }`}
            />
            {errors.password ? (
              <Text className="font-body text-xs text-chili mt-1">{errors.password}</Text>
            ) : null}
          </View>
        </View>

        <Button className="mt-8" fullWidth loading={submitting} onPress={handleSubmit}>
          Đăng ký
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
