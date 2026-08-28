import React from "react";
import { View, Text, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Receipt } from "lucide-react-native";
import OrderCard from "../components/order/OrderCard";
import Loading from "../components/common/Loading";
import { useSocket } from "../context/SocketContext";
import { COLORS } from "../theme/tokens";

// Port từ src/pages/OrdersPage.jsx bản web. Không có gì đổi về mặt dữ liệu —
// `orders` vẫn tới từ SocketContext, chỉ khác là SocketContext (RN) join
// phòng qua token xác thực thay vì customerId ẩn danh (xem context đó).
export default function OrdersScreen() {
  const { orders, stateReceived } = useSocket();
  const insets = useSafeAreaInsets();

  if (!stateReceived) {
    return <Loading label="Đang tải đơn hàng..." />;
  }

  return (
    <View className="flex-1 bg-paper">
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Receipt size={32} color={COLORS.steelLight} style={{ marginBottom: 12 }} />
            <Text className="text-steel text-sm">Bạn chưa đặt đơn nào.</Text>
          </View>
        }
      />
    </View>
  );
}
