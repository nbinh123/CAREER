import React from "react";
import { View, Text } from "react-native";
import { MapPin, Phone, StickyNote } from "lucide-react-native";
import OrderItemRow from "./OrderItemRow";
import OrderProgressTrack from "./OrderProgressTrack";
import DashedDivider from "../common/DashedDivider";
import { formatCurrency } from "../../utils/formatCurrency";
import { timeAgo } from "../../utils/formatTime";
import { ORDER_STATUS_META } from "../../constants/orderStatus";
import { COLORS } from "../../theme/tokens";

export default function OrderCard({ order }) {
  const meta = ORDER_STATUS_META[order.status] || { label: order.status };
  const shortCode = String(order.id).slice(-6).toUpperCase();

  return (
    <View className="bg-paper rounded-ticket border border-ink/8 px-4 py-2 mb-4">
      <View className="flex-row items-center justify-between pt-2 pb-1">
        <View>
          <Text className="font-display font-semibold text-ink text-sm">Đơn #{shortCode}</Text>
          <Text className="text-steel text-[11px] mt-0.5">{timeAgo(order.createdAt)}</Text>
        </View>
        <Text className="text-steel text-[11px] font-display font-medium">{meta.label}</Text>
      </View>

      <OrderProgressTrack status={order.status} />

      <DashedDivider className="mt-1" />

      <View className="pt-2">
        {order.items.map((item, idx) => (
          <OrderItemRow key={`${item.foodId}-${idx}`} item={item} isFirst={idx === 0} />
        ))}
      </View>

      <DashedDivider className="mt-1" />
      <View className="flex-row justify-between pt-3 pb-2">
        <Text className="font-display font-semibold text-ink text-sm">Tổng cộng</Text>
        <Text className="font-mono font-semibold text-chili-dark">{formatCurrency(order.totalPrice)}</Text>
      </View>

      <View className="gap-1.5 pb-3 pt-1">
        {order.address ? (
          <View className="flex-row items-start gap-1.5">
            <MapPin size={13} color={COLORS.steel} style={{ marginTop: 2 }} />
            <Text className="text-steel text-xs flex-shrink">{order.address}</Text>
          </View>
        ) : null}
        {order.phone ? (
          <View className="flex-row items-center gap-1.5">
            <Phone size={13} color={COLORS.steel} />
            <Text className="text-steel text-xs">{order.phone}</Text>
          </View>
        ) : null}
        {order.note ? (
          <View className="flex-row items-start gap-1.5">
            <StickyNote size={13} color={COLORS.steel} style={{ marginTop: 2 }} />
            <Text className="text-steel text-xs flex-shrink">{order.note}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}