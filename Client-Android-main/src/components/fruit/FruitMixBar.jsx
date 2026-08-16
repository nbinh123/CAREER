import React from "react";
import { View, Text, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Minus, Plus, PartyPopper } from "lucide-react-native";
import Button from "../common/Button";
import { formatCurrency } from "../../utils/formatCurrency";
import { COLORS } from "../../theme/tokens";

// Port từ src/components/fruit/FruitMixBar.jsx bản web. `registerSlotRef`
// giữ nguyên signature (index, node) — bên RN, `node` là ref của View 3 ô
// slot, dùng để FruitScreen.jsx đo toạ độ đích bằng measureInWindow khi cần
// bay hiệu ứng (xem FruitPickCard.jsx và FruitScreen.jsx).
export default function FruitMixBar({
  selected,
  onRemove,
  quantity,
  onQuantityChange,
  matchedCombo,
  registerSlotRef,
  ready,
  totalPrice,
  onAddToCart,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-paper rounded-t-ticket border-t border-ink/8 px-4 pt-3"
      style={{
        paddingBottom: Math.max(12, insets.bottom),
        shadowColor: COLORS.ink,
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
        elevation: 8,
      }}
    >
      <View className="flex-row items-center justify-between mb-2.5">
        <Text className="font-display font-semibold text-ink text-sm">
          Combo của bạn · {selected.length}/3
        </Text>
        {matchedCombo && (
          <View className="flex-row items-center gap-1 bg-jade-light px-2 py-1 rounded-full">
            <PartyPopper size={12} color={COLORS.jade} />
            <Text className="text-[11px] font-display font-medium text-jade">Đã có sẵn trong thực đơn</Text>
          </View>
        )}
      </View>

      <View className="flex-row gap-2">
        {[0, 1, 2].map((slot) => {
          const item = selected[slot];
          return (
            <Pressable
              key={slot}
              ref={(node) => registerSlotRef?.(slot, node)}
              onPress={() => item && onRemove(item)}
              className={`flex-1 h-14 rounded-xl overflow-hidden items-center justify-center px-2 ${
                item ? "bg-jade-light" : "bg-paper-dim"
              }`}
              style={
                item
                  ? { borderWidth: 1, borderColor: "rgba(46,111,85,0.4)" }
                  : { borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(34,27,20,0.15)" }
              }
            >
              {item ? (
                <>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      resizeMode="cover"
                      className="absolute inset-0 w-full h-full"
                    />
                  ) : null}
                  {/* Lớp phủ jade-light mờ để ảnh nền không lấn chữ — vẫn thấy
                      rõ đây là loại trái cây nào, đúng ý "hình nền mờ". */}
                  <View className="absolute inset-0" style={{ backgroundColor: "rgba(220,235,227,0.8)" }} />
                  <Text numberOfLines={1} className="font-display text-xs font-medium text-ink">
                    {item.fruitName}
                  </Text>
                </>
              ) : (
                <Text className="text-steel-light text-[11px]">Chọn loại {slot + 1}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center gap-3 mt-3">
        <View className="flex-row items-center gap-1.5 bg-paper-dim rounded-full px-1.5 py-1.5">
          <Pressable
            onPress={() => onQuantityChange(Math.max(1, quantity - 1))}
            accessibilityLabel="Giảm số lượng"
            className="w-7 h-7 rounded-full bg-paper items-center justify-center"
          >
            <Minus size={13} color={COLORS.ink} />
          </Pressable>
          <Text className="font-mono w-5 text-center font-semibold text-sm">{quantity}</Text>
          <Pressable
            onPress={() => onQuantityChange(quantity + 1)}
            accessibilityLabel="Tăng số lượng"
            className="w-7 h-7 rounded-full bg-ink items-center justify-center"
          >
            <Plus size={13} color={COLORS.paper} />
          </Pressable>
        </View>

        <View className="flex-1">
          <Button onPress={onAddToCart} disabled={!ready}>
            {`Thêm vào giỏ · ${formatCurrency(totalPrice)}`}
          </Button>
        </View>
      </View>
    </View>
  );
}
