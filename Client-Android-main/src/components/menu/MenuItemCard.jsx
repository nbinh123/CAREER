import React from "react";
import { View, Text, Pressable } from "react-native";
import { Plus, Flame } from "lucide-react-native";
import { formatCurrency } from "../../utils/formatCurrency";
import FoodThumbnail from "./FoodThumbnail";
import DashedDivider from "../common/DashedDivider";
import { COLORS } from "../../theme/tokens";

// Port từ src/components/menu/MenuItemCard.jsx bản web. Web dùng 1 <div>
// với 2 vùng bấm lồng nhau (ảnh mở modal, nút + thêm nhanh) — RN không cho
// Pressable lồng Pressable đáng tin cậy (sự kiện chạm có thể bị nuốt tuỳ
// nền tảng), nên tách 2 vùng bấm thành 2 Pressable ANH EM thay vì lồng nhau.
export default function MenuItemCard({ item, isBestSeller, onOpen, onQuickAdd }) {
  const unavailable = !item.isAvailable;

  return (
    <View className={`${unavailable ? "opacity-60" : ""}`}>
      <DashedDivider />
      <View className="flex-row gap-3 py-4 px-4">
        <Pressable onPress={() => onOpen(item)} className="relative flex-shrink-0">
          <FoodThumbnail src={item.imageUrl} alt={item.foodName} className="w-24 h-24 rounded-2xl" />
          {isBestSeller && !unavailable && (
            <View className="absolute top-1 left-1 flex-row items-center gap-0.5 bg-chili px-1.5 py-0.5 rounded-full">
              <Flame size={10} color={COLORS.paper} />
              <Text className="text-paper text-[10px] font-display font-semibold">Bán chạy</Text>
            </View>
          )}
          {unavailable && (
            <View className="absolute inset-0 items-center justify-center bg-ink/40 rounded-2xl">
              <View className="bg-ink px-2 py-1 rounded-full">
                <Text className="text-paper text-[10px] font-display font-medium">Hết hàng</Text>
              </View>
            </View>
          )}
        </Pressable>

        <Pressable onPress={() => onOpen(item)} className="flex-1 min-w-0">
          <Text className="font-display font-semibold text-ink text-[15px] leading-snug">
            {item.foodName}
          </Text>
          <Text numberOfLines={2} className="text-steel text-xs mt-1 leading-relaxed">
            {item.description}
          </Text>
          <View className="flex-row items-center justify-between mt-2.5">
            <Text className="font-mono text-chili-dark font-semibold text-[15px]">
              {formatCurrency(item.originalPrice)}
            </Text>
            {unavailable ? (
              <Text className="text-[11px] text-steel font-display px-2">Tạm hết</Text>
            ) : (
              <Pressable
                onPress={() => onQuickAdd(item)}
                accessibilityLabel={`Thêm ${item.foodName}`}
                className="items-center justify-center w-8 h-8 rounded-full bg-ink"
              >
                <Plus size={16} strokeWidth={2.5} color={COLORS.paper} />
              </Pressable>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
