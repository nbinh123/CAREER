import React from "react";
import { View, Text, Pressable } from "react-native";
import { Sparkles } from "lucide-react-native";
import FoodThumbnail from "../menu/FoodThumbnail";
import { formatCurrency } from "../../utils/formatCurrency";
import { FRUIT_COMBO_PRICE } from "../../utils/fruit";
import { COLORS } from "../../theme/tokens";

// Port từ src/components/fruit/ComboSuggestions.jsx bản web — thuần trình
// bày, không có gì đặc thù nền tảng ngoài đổi <div>/<button> sang View/Pressable.
export default function ComboSuggestions({
  combos,
  onPick,
  title = "Gợi ý combo có sẵn với lựa chọn của bạn",
}) {
  if (!combos || combos.length === 0) return null;

  return (
    <View className="px-4 pb-2">
      <View className="flex-row items-center gap-1.5 mb-2.5">
        <Sparkles size={13} color={COLORS.turmericDark} />
        <Text className="text-xs font-display font-medium text-turmeric-dark">{title}</Text>
      </View>
      <View className="gap-2.5">
        {combos.map((combo) => (
          <Pressable
            key={combo.id || combo._id}
            onPress={() => onPick(combo)}
            className="flex-row items-center gap-3 rounded-2xl border border-turmeric/40 bg-turmeric-light/60 p-2.5"
          >
            <FoodThumbnail src={combo.imageUrl} alt={combo.foodName} className="w-14 h-14 rounded-xl flex-shrink-0" />
            <View className="flex-1 min-w-0">
              <Text numberOfLines={2} className="font-display font-medium text-ink text-[12.5px] leading-snug">
                {combo.foodName}
              </Text>
              <Text className="font-mono text-chili-dark text-[12px] font-semibold mt-1">
                {formatCurrency(FRUIT_COMBO_PRICE)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
