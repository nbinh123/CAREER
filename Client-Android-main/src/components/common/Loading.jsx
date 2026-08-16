import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";

// Port từ src/components/common/Loading.jsx bản web (3 chấm nhấp nháy so le
// nhịp). Web dùng CSS animation (@keyframes pulse-dot); RN dùng Animated API
// với 1 vòng lặp loop() cho mỗi chấm, lệch pha bằng delay riêng — giữ đúng
// timing gốc (chu kỳ 1.4s, lệch 180ms mỗi chấm).
function Dot({ color, delay }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);

  return (
    <Animated.View
      style={{ opacity, width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
    />
  );
}

export default function Loading({ label = "Đang tải..." }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <View className="flex-row gap-1.5">
        <Dot color="#D6361F" delay={0} />
        <Dot color="#E8A93E" delay={180} />
        <Dot color="#2E6F55" delay={360} />
      </View>
      <Text className="text-steel text-sm font-body">{label}</Text>
    </View>
  );
}
