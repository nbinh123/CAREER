// src/components/AuthBackground.js
// [UI] Nền dùng chung cho LoginPage + RegisterPage (2 trang CSS-in-JS thuần
// trong bản gốc, style gần như giống hệt nhau — tách thành 1 component
// dùng chung đúng theo gợi ý ở progress.md mục 3.3, tránh trùng lặp).
//
// Quy đổi từ CSS gốc:
//   .lp-dots (radial-gradient dot pattern)      → react-native-svg <Pattern>
//   .lp-blob-1/2/3 (blur(80px) + @keyframes float) → View tròn màu + Reanimated
//     (float bằng translateY/scale). Lưu ý: KHÔNG áp dụng blur thật (Gaussian
//     blur mạnh trên native tốn hiệu năng và không có filter CSS tương đương
//     trực tiếp) — dùng opacity thấp để tạo hiệu ứng "mảng màu mềm" tương tự,
//     đủ dùng cho mục đích trang trí nền. Có thể nâng cấp bằng expo-blur nếu
//     cần đúng pixel-for-pixel với bản web.
//   .lp-card (backdrop-filter blur(18px), bo góc 28, shadow nhiều lớp) →
//     expo-blur <BlurView> làm nền kính mờ + View bo góc + shadow RN.
import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Defs, Pattern, Circle, Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  FadeInDown,
} from "react-native-reanimated";
import colors from "../theme/tokens";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function Blob({ size, color, style, delay = 0 }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [t, delay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: t.value * -28 },
      { scale: 1 + t.value * 0.04 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.45,
        },
        style,
        animStyle,
      ]}
    />
  );
}

function DotGrid() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="lp-dots" patternUnits="userSpaceOnUse" width={28} height={28}>
          <Circle cx={1.5} cy={1.5} r={1.2} fill="#86efac66" />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="url(#lp-dots)" />
    </Svg>
  );
}

export default function AuthBackground({ children }) {
  return (
    <View style={styles.root}>
      <DotGrid />
      <Blob size={420} color={colors.green[200]} style={{ top: -120, left: -100 }} delay={0} />
      <Blob size={320} color={colors.emerald[200]} style={{ bottom: -80, right: -80 }} delay={600} />
      <Blob size={200} color={colors.emerald[100]} style={{ top: "40%", left: "55%" }} delay={1200} />

      <Animated.View entering={FadeInDown.duration(450).springify()} style={styles.cardWrap}>
        <BlurView intensity={40} tint="light" style={styles.card}>
          {children}
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.green[50],
    alignItems: "center",
    justifyContent: "center",
  },
  cardWrap: {
    width: "100%",
    maxWidth: 420,
    marginHorizontal: 24,
  },
  card: {
    borderRadius: 28,
    padding: 28,
    paddingTop: 36,
    borderWidth: 1.5,
    borderColor: "rgba(187,247,208,0.6)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.55)",
    shadowColor: colors.emerald[600],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
});
