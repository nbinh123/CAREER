import React, { useRef } from "react";
import { Pressable, View, Text } from "react-native";
import { Check } from "lucide-react-native";
import FoodThumbnail from "../menu/FoodThumbnail";
import { COLORS } from "../../theme/tokens";

/**
 * Port từ src/components/fruit/FruitPickCard.jsx bản web. Khác biệt kỹ
 * thuật quan trọng: web truyền `event` (DOM event) cho onToggle để
 * FruitPage.jsx tự lấy `event.currentTarget.getBoundingClientRect()` tính
 * toạ độ bay. RN không có DOM event/getBoundingClientRect — component TỰ ĐO
 * toạ độ của chính nó bằng `measureInWindow` (API gắn trên mọi native view
 * ref) rồi trả thẳng { x, y, width, height } lên qua onToggle, thay vì trả
 * event thô. Nhờ vậy FruitScreen.jsx không cần biết gì về ref/DOM cả.
 */
export default function FruitPickCard({ item, selected, disabled, onToggle }) {
  const ref = useRef(null);
  const unavailable = !item.isAvailable;
  const blocked = unavailable || (disabled && !selected);

  const handlePress = () => {
    if (blocked) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      onToggle(item, { x, y, width, height });
    });
  };

  return (
    <Pressable
      ref={ref}
      onPress={handlePress}
      disabled={blocked}
      accessibilityState={{ selected, disabled: blocked }}
      className={`flex-1 aspect-square rounded-2xl overflow-hidden border ${
        selected ? "border-jade" : "border-ink/8"
      } ${blocked && !selected ? "opacity-40" : ""}`}
      style={selected ? { borderWidth: 2, borderColor: COLORS.jade } : undefined}
    >
      <FoodThumbnail src={item.imageUrl} alt={item.fruitName} className="absolute inset-0 w-full h-full" />

      {unavailable && (
        <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: "rgba(34,27,20,0.5)" }}>
          <View className="bg-ink px-1.5 py-0.5 rounded-full">
            <Text className="text-paper text-[9px] font-display font-medium">Hết</Text>
          </View>
        </View>
      )}

      {selected && (
        <View className="absolute top-1.5 right-1.5 items-center justify-center w-5 h-5 rounded-full bg-jade">
          <Check size={12} strokeWidth={3} color={COLORS.paper} />
        </View>
      )}

      <View className="absolute bottom-0 inset-x-0 px-2 py-1.5" style={{ backgroundColor: "rgba(34,27,20,0.55)" }}>
        <Text numberOfLines={1} className="font-display font-medium text-paper text-[13px] text-center">
          {item.fruitName}
        </Text>
      </View>
    </Pressable>
  );
}
