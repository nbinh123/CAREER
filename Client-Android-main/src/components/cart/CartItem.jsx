import React from "react";
import { View, Text, Pressable } from "react-native";
import { Minus, Plus, Trash2 } from "lucide-react-native";
import { formatCurrency } from "../../utils/formatCurrency";
import DashedDivider from "../common/DashedDivider";
import { COLORS } from "../../theme/tokens";

// Port từ src/components/cart/CartItem.jsx bản web.
export default function CartItem({ item, onUpdateQty }) {
  return (
    <View>
      <DashedDivider />
      <View className="flex-row items-start justify-between py-3">
        <View className="flex-1 min-w-0 pr-3">
          <Text className="font-display font-medium text-ink text-sm">{item.name}</Text>
          <Text className="font-mono text-chili-dark text-sm font-medium mt-1">
            {formatCurrency(item.price)}
          </Text>
        </View>

        <View className="flex-row items-center gap-2 bg-paper-dim rounded-full px-1 py-1">
          <Pressable
            onPress={() => onUpdateQty(item.id, item.qty - 1)}
            accessibilityLabel="Giảm"
            className="w-7 h-7 items-center justify-center rounded-full bg-paper"
          >
            {item.qty === 1 ? (
              <Trash2 size={13} color={COLORS.chili} />
            ) : (
              <Minus size={13} color={COLORS.ink} />
            )}
          </Pressable>
          <Text className="font-mono w-4 text-center text-sm">{item.qty}</Text>
          <Pressable
            onPress={() => onUpdateQty(item.id, item.qty + 1)}
            accessibilityLabel="Tăng"
            className="w-7 h-7 items-center justify-center rounded-full bg-ink"
          >
            <Plus size={13} color={COLORS.paper} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
