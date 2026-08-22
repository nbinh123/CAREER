import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { Phone, Eye, EyeOff, ArrowRight, CircleAlert } from "lucide-react-native";
import useAuthZustand from "../zustand/useAuthZustand";
import AuthBackground from "../components/AuthBackground";
import PrimaryButton from "../components/PrimaryButton";
import colors from "../theme/tokens";

const PIN_LENGTH = 6;

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(Array(PIN_LENGTH).fill(""));
  const pinRefs = useRef([]);

  const { login } = useAuthZustand();

  const [showPwd, setShowPwd] = useState(false);
  const [phoneErr, setPhoneErr] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  function validatePhone(val) {
    if (!val) return "Vui lòng nhập số điện thoại";
    if (!/^\d+$/.test(val)) return "Số điện thoại chỉ chứa chữ số";
    if (val.length !== 10) return `Cần đủ 10 chữ số (hiện ${val.length})`;
    return "";
  }

  function validatePwd(val) {
    if (!val || val.length < PIN_LENGTH) return "Vui lòng nhập đủ 6 số";
    return "";
  }

  function resetPin(focusFirst = true) {
    setPin(Array(PIN_LENGTH).fill(""));
    if (focusFirst) pinRefs.current[0]?.focus();
  }

  /* ── pin (mật khẩu) handlers ── */
  function handlePinChange(idx, rawText) {
    const digits = rawText.replace(/\D/g, "");

    // Dán nhiều số cùng lúc (paste) — rải từ vị trí idx trở đi.
    if (digits.length > 1) {
      setPin((prev) => {
        const next = [...prev];
        for (let i = 0; i < digits.length && idx + i < PIN_LENGTH; i++) {
          next[idx + i] = digits[i];
        }
        if (pwdErr) setPwdErr(validatePwd(next.join("")));
        const focusIdx = Math.min(idx + digits.length, PIN_LENGTH - 1);
        pinRefs.current[focusIdx]?.focus();
        return next;
      });
      return;
    }

    const digit = digits.slice(-1);
    setPin((prev) => {
      const next = [...prev];
      next[idx] = digit;
      if (pwdErr) setPwdErr(validatePwd(next.join("")));
      return next;
    });
    if (digit && idx < PIN_LENGTH - 1) {
      pinRefs.current[idx + 1]?.focus();
    }
  }

  function handlePinKeyPress(idx, e) {
    if (e.nativeEvent.key === "Backspace" && !pin[idx] && idx > 0) {
      setPin((prev) => {
        const next = [...prev];
        next[idx - 1] = "";
        return next;
      });
      pinRefs.current[idx - 1]?.focus();
    }
  }

  /* ── submit ── */
  async function handleSubmit() {
    const password = pin.join("");
    const pErr = validatePhone(phone);
    const wErr = validatePwd(password);
    setPhoneErr(pErr);
    setPwdErr(wErr);
    if (pErr || wErr) return;

    setLoading(true);
    try {
      const response = await login({ phone, password });

      if (response.success) {
        showToast("🎉 Đăng nhập thành công!");
        // RootNavigator tự chuyển màn khi isAuthenticated đổi thành true.
      } else {
        showToast("❌ " + (response.message || "Sai số điện thoại hoặc mật khẩu"));
        resetPin();
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Sai số điện thoại hoặc mật khẩu";
      showToast("❌ " + msg);
      resetPin();
    } finally {
      setLoading(false);
    }
  }

  function onPhoneChange(text) {
    const val = text.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    if (phoneErr) setPhoneErr(validatePhone(val));
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <AuthBackground>
          {/* logo */}
          <View className="items-center mb-7">
            <View className="w-[72px] h-[72px] bg-white rounded-2xl items-center justify-center mb-3 p-2 overflow-hidden">
              <Image
                source={require("../../assets/logo.png")}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
            <Text className="text-[22px] font-black text-emerald-900">Chiến thắng</Text>
            <Text className="text-[13px] font-medium text-emerald-300">Đăng nhập để tiếp tục</Text>
          </View>

          {/* phone field */}
          <View className="mb-4">
            <Text className="text-xs font-extrabold text-emerald-800 tracking-wide mb-2 uppercase">
              Số điện thoại
            </Text>
            <View className="relative flex-row items-center">
              <View className="absolute left-3.5 z-10">
                <Phone size={16} color={colors.emerald[300]} strokeWidth={2.5} />
              </View>
              <TextInput
                className={`flex-1 bg-green-50 border-2 rounded-2xl pl-11 pr-3.5 py-3 text-[15px] font-semibold text-emerald-900 ${
                  phoneErr ? "border-red-300" : "border-green-200"
                }`}
                keyboardType="number-pad"
                placeholder="0xxxxxxxxx"
                placeholderTextColor={colors.emerald[200]}
                value={phone}
                onChangeText={onPhoneChange}
                maxLength={10}
                autoFocus
              />
            </View>
            {!!phoneErr && (
              <View className="flex-row items-center gap-1.5 mt-1.5 justify-center">
                <CircleAlert size={12} color={colors.red[500]} />
                <Text className="text-xs font-bold text-red-500">{phoneErr}</Text>
              </View>
            )}
          </View>

          {/* password (6 ô PIN) */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs font-extrabold text-emerald-800 tracking-wide uppercase">
                Mật khẩu
              </Text>
              <Pressable
                onPress={() => setShowPwd((v) => !v)}
                className="flex-row items-center gap-1 px-2 py-1 rounded-full"
              >
                {showPwd ? (
                  <EyeOff size={13} color={colors.emerald[300]} strokeWidth={2.4} />
                ) : (
                  <Eye size={13} color={colors.emerald[300]} strokeWidth={2.4} />
                )}
                <Text className="text-emerald-300 text-[11px] font-extrabold uppercase">
                  {showPwd ? "Ẩn" : "Hiện"}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row justify-center gap-2.5">
              {pin.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => (pinRefs.current[idx] = el)}
                  className={`w-11 h-11 rounded-full text-center text-lg font-extrabold text-emerald-900 border-2 ${
                    pwdErr ? "border-red-300 bg-red-50" : digit ? "border-emerald-400 bg-emerald-50" : "border-green-200 bg-green-50"
                  }`}
                  keyboardType="number-pad"
                  maxLength={digit ? 1 : PIN_LENGTH}
                  value={digit}
                  secureTextEntry={!showPwd}
                  onChangeText={(t) => handlePinChange(idx, t)}
                  onKeyPress={(e) => handlePinKeyPress(idx, e)}
                />
              ))}
            </View>
            {!!pwdErr && (
              <View className="flex-row items-center gap-1.5 mt-1.5 justify-center">
                <CircleAlert size={12} color={colors.red[500]} />
                <Text className="text-xs font-bold text-red-500">{pwdErr}</Text>
              </View>
            )}
          </View>

          <PrimaryButton
            onPress={handleSubmit}
            loading={loading}
            label="Đăng nhập"
            loadingLabel="Đang đăng nhập…"
            icon={<ArrowRight size={16} color={colors.white} strokeWidth={2.8} />}
          />

          <Text className="text-center text-xs font-semibold text-emerald-300 mt-5">
            Quên mật khẩu? Liên hệ <Text className="text-emerald-500">quản trị viên</Text> để đặt lại
          </Text>
        </AuthBackground>
      </ScrollView>

      {toast && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOutDown.duration(300)}
          className="absolute left-0 right-0 bottom-8 items-center"
        >
          <View className="bg-emerald-900 px-5 py-2.5 rounded-full">
            <Text className="text-emerald-300 text-[13px] font-extrabold">{toast}</Text>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
