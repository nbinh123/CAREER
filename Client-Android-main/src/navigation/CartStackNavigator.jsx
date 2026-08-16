import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CartScreen from "../screens/CartScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import { ROUTES } from "../constants/routes";
import { COLORS } from "../theme/tokens";

const Stack = createNativeStackNavigator();

// Stack riêng cho tab "Giỏ hàng" — CartScreen là màn gốc, CheckoutScreen
// được push lên khi khách bấm "Tiếp tục" (thay cho step nội bộ của
// CartDrawer.jsx bản web). Gắn navigator này làm `component` của Tab.Screen
// "Giỏ hàng" trong Main Tab Navigator đã dựng ở giai đoạn 4.
export default function CartStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.paper },
        headerTintColor: COLORS.ink,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name={ROUTES.CART_SCREEN} component={CartScreen} options={{ title: "Giỏ hàng" }} />
      <Stack.Screen
        name={ROUTES.CHECKOUT_SCREEN}
        component={CheckoutScreen}
        options={{ title: "Thông tin giao hàng" }}
      />
    </Stack.Navigator>
  );
}
