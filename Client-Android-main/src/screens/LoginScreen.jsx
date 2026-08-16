import React, { useRef, useState } from "react";
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
import PinInput from "../components/common/PinInput";
import { useAuth } from "../context/AuthContext";
import { useGlobal } from "../context/GlobalContext";
import { ROUTES } from "../constants/routes";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { login } = useAuth();
  const { restaurant, showToast } = useGlobal();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef(null);

  // Không ép người dùng chỉ được gõ số (giữ nguyên hành vi cũ của ô này),
  // chỉ ĐẾM riêng số chữ số để biết khi nào đã gõ đủ 10 số điện thoại —
  // đúng lúc đó mới tự chuyển focus xuống 6 ô mật khẩu, không cần người
  // dùng tự bấm vào. Dùng "===  10" (không phải ">=") để chỉ bắn đúng 1
  // lần tại thời điểm số thứ 10 vừa được gõ, không lặp lại mỗi lần
  // onChangeText bắn ra sau đó.
  const handlePhoneChange = (text) => {
    setPhone(text);
    const digitCount = text.replace(/[^0-9]/g, "").length;
    if (digitCount === 10) {
      passwordRef.current?.focus();
    }
  };

  const validate = () => {
    const next = {};
    if (!phone.trim()) next.phone = "Vui lòng nhập số điện thoại.";
    if (password.length !== 6) next.password = "Vui lòng nhập đủ 6 số.";
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
              onChangeText={handlePhoneChange}
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              autoCapitalize="none"
              maxLength={10}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
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
            <PinInput
              ref={passwordRef}
              length={6}
              value={password}
              onChangeText={setPassword}
              error={!!errors.password}
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