// src/components/PrimaryButton.js
// Nút submit dùng chung cho Login/Register (.lp-btn / .rp-btn trong bản
// gốc — gradient xanh, bo góc 14, spinner khi loading). Tách riêng vì cả 2
// trang auth đều dùng y hệt 1 kiểu nút.
import React from "react";
import { Pressable, Text, ActivityIndicator, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import colors from "../theme/tokens";

export default function PrimaryButton({ onPress, loading, disabled, label, loadingLabel, icon }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={{ marginTop: 8 }}>
      <LinearGradient
        colors={[colors.emerald[400], colors.emerald[600]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 14,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled || loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <>
            <ActivityIndicator color={colors.white} size="small" />
            <Text className="text-white font-black text-sm">{loadingLabel}</Text>
          </>
        ) : (
          <>
            <Text className="text-white font-black text-sm">{label}</Text>
            <View>{icon}</View>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}
