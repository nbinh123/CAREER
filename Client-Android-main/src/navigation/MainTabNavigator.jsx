import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UtensilsCrossed, Cherry, ShoppingCart, Receipt, User } from "lucide-react-native";
import MenuScreen from "../screens/MenuScreen";
import FruitScreen from "../screens/FruitScreen";
import OrdersScreen from "../screens/OrdersScreen";
import AccountScreen from "../screens/AccountScreen";
import CartStackNavigator from "./CartStackNavigator";
import { useCart } from "../context/CartContext";
import { useSocket } from "../context/SocketContext";
import { ACTIVE_ORDER_STATUSES } from "../constants/orderStatus";
import { ROUTES } from "../constants/routes";
import { COLORS } from "../theme/tokens";
import { TAB_BAR_BASE_HEIGHT, TAB_BAR_PADDING_TOP, TAB_BAR_PADDING_BOTTOM } from "../theme/layout";

/**
 * ============================================================================
 * Bản CHẠY ĐỘC LẬP (không có sẵn dự án Giai đoạn 4): 5 tab đầy đủ — Menu,
 * Trái cây, Giỏ hàng, Đơn hàng, Tài khoản (AccountScreen bản tối giản, xem
 * ghi chú trong file đó). Cách lấy badge số lượng (giỏ hàng / đơn đang xử
 * lý) tương đương CartFloatingButton + đếm ACTIVE_ORDER_STATUSES ở
 * Footer.jsx bản web gốc.
 * ============================================================================
 */
const Tab = createBottomTabNavigator();

function TabIcon(Icon) {
  return ({ color, size }) => <Icon size={size} color={color} strokeWidth={2} />;
}

export default function MainTabNavigator() {
  const { totalCount } = useCart();
  const { orders } = useSocket();
  const activeOrderCount = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length;
  const insets = useSafeAreaInsets();

  // Trước đây không set height/padding riêng -> mặc định của
  // @react-navigation/bottom-tabs khá thấp, khiến nút chat nổi (ChatWidget,
  // mount ở gốc app nên không tự né được thanh tab) đè lên. Giờ set chiều
  // cao + padding rõ ràng theo thang SPACING (tỉ lệ vàng, xem theme/layout.js)
  // — vừa cao/thoáng hơn, vừa cho ChatWidget một con số cố định để tính
  // khoảng né đúng (xem TAB_BAR_BASE_HEIGHT dùng ở ChatWidget.jsx).
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.chili,
        tabBarInactiveTintColor: COLORS.steel,
        tabBarStyle: {
          backgroundColor: COLORS.paper,
          borderTopColor: "rgba(34,27,20,0.08)",
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingTop: TAB_BAR_PADDING_TOP,
          paddingBottom: TAB_BAR_PADDING_BOTTOM + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, marginTop: 2 },
      }}
    >
      <Tab.Screen
        name={ROUTES.TAB_MENU}
        component={MenuScreen}
        options={{ title: "Thực đơn", tabBarIcon: TabIcon(UtensilsCrossed) }}
      />
      <Tab.Screen
        name={ROUTES.TAB_FRUITS}
        component={FruitScreen}
        options={{ title: "Trái cây", tabBarIcon: TabIcon(Cherry) }}
      />
      <Tab.Screen
        name={ROUTES.TAB_CART}
        component={CartStackNavigator}
        options={{
          title: "Giỏ hàng",
          tabBarIcon: TabIcon(ShoppingCart),
          tabBarBadge: totalCount > 0 ? totalCount : undefined,
        }}
      />
      <Tab.Screen
        name={ROUTES.TAB_ORDERS}
        component={OrdersScreen}
        options={{
          title: "Đơn hàng",
          tabBarIcon: TabIcon(Receipt),
          tabBarBadge: activeOrderCount > 0 ? activeOrderCount : undefined,
        }}
      />
      <Tab.Screen
        name={ROUTES.TAB_ACCOUNT}
        component={AccountScreen}
        options={{ title: "Tài khoản", tabBarIcon: TabIcon(User) }}
      />
    </Tab.Navigator>
  );
}
