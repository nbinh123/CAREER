import React from "react";
import { View, Text } from "react-native";
import { formatCurrency } from "../../utils/formatCurrency";
import DashedDivider from "../common/DashedDivider";

// Port từ src/components/order/OrderItemRow.jsx bản web.
export default function OrderItemRow({ item, isFirst }) {
  return (
    <View>
      {!isFirst && <DashedDivider />}
      <View className="py-2.5">
        <Text className="font-display font-medium text-ink text-sm">
          {item.quantity}× {item.foodName}
        </Text>
        <Text className="font-mono text-steel text-xs mt-0.5">
          {formatCurrency(item.unitPrice)} / món · {formatCurrency(item.unitPrice * item.quantity)}
        </Text>
      </View>
    </View>
  );
}
