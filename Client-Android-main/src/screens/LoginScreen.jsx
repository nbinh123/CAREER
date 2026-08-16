import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Button from "../components/common/Button";
import { useAuth } from "../context/AuthContext";
import { useGlobal } from "../context/GlobalContext";
import { ROUTES } from "../constants/routes";

// Auth Stack không nằm trong bộ file Giai đoạn 5 gốc (giả định đã có sẵn từ
// Giai đoạn 4). Vì bản chạy độc lập này chưa có dự án Giai đoạn 4, màn hình
// Đăng nhập/Đăng ký được viết mới ở đây, dùng đúng useAuth().login/register
// theo shape mà AuthContext (tham khảo) cung cấp.
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { login } = useAuth();
  const { restaurant, showToast } = useGlobal();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    if (!phone.trim()) next.phone = "Vui lòng nhập số điện thoại.";
    if (!password) next.password = "Vui lòng nhập mật khẩu.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      const message =
        err?.response?.data?.message || "Số điện thoại hoặc mật khẩu không đúng.";
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
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
          justifyContent: "center",
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-10">
          <Image
            source={require("../assets/logo.png")}
            className="w-16 h-16 mb-4"
            resizeMode="contain"
          />
          <Text className="font-display text-2xl text-ink text-center">
            {restaurant.name}
          </Text>
          <Text className="font-body text-sm text-steel text-center mt-1">
            {restaurant.tagline}
          </Text>
        </View>

        <Text className="font-display text-xl text-ink mb-6">Đăng nhập</Text>

        <View className="gap-4">
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
              placeholder="••••••••"
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

        <Button
          className="mt-8"
          fullWidth
          loading={submitting}
          onPress={handleSubmit}
        >
          Đăng nhập
        </Button>

        <View className="flex-row justify-center mt-6 gap-1">
          <Text className="font-body text-sm text-steel">Chưa có tài khoản?</Text>
          <Text
            className="font-bodySemibold text-sm text-chili"
            onPress={() => navigation.navigate(ROUTES.AUTH_REGISTER)}
          >
            Đăng ký ngay
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
