import React, { useState } from "react";
import { View, Image } from "react-native";
import { UtensilsCrossed } from "lucide-react-native";
import { COLORS } from "../../theme/tokens";

// Port từ src/components/menu/FoodThumbnail.jsx bản web. `className` ở đây
// PHẢI chứa kích thước (w-*, h-*) và bo góc (rounded-*) giống hệt cách gọi
// bên web — component chỉ thêm nền + canh giữa fallback, không tự đặt size.
export default function FoodThumbnail({ src, alt, className = "" }) {
  const [error, setError] = useState(false);
  const showFallback = !src || error;

  return (
    <View className={`bg-paper-dim items-center justify-center overflow-hidden ${className}`}>
      {showFallback ? (
        <UtensilsCrossed size={22} color={COLORS.steelLight} />
      ) : (
        <Image
          source={{ uri: src }}
          accessibilityLabel={alt}
          className="w-full h-full"
          resizeMode="cover"
          onError={() => setError(true)}
        />
      )}
    </View>
  );
}
