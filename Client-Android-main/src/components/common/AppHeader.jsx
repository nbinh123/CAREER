import React, { useEffect, useRef, useState } from "react";
import { View, Image, Text, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING, HEADER_LOGO_SIZE } from "../../theme/layout";
import { useGlobal } from "../../context/GlobalContext";
import { useActiveRoute } from "../../context/ActiveRouteContext";

const logo = require("../../assets/logo.png");

// Khớp với tên ROUTE LÁ (leaf) đang active, không phải lúc nào cũng là tên
// Tab.Screen (ROUTES.TAB_*): Menu/Fruits/Orders/Account không có stack con
// nên lá == chính tab đó, nhưng tab "Giỏ hàng" bọc CartStackNavigator (xem
// MainTabNavigator.jsx) nên lá thực tế là "CartScreen" (chưa push) hoặc
// "CheckoutScreen" (đã push) — cả 2 đều map về cùng tiêu đề "Giỏ hàng" để
// tiêu đề chung không biến mất khi khách sang bước thanh toán.
const TAB_TITLES = {
  MenuTab: "Thực đơn",
  FruitsTab: "Trái cây",
  CartTab: "Giỏ hàng",
  CartScreen: "Giỏ hàng",
  CheckoutScreen: "Giỏ hàng",
  OrdersTab: "Đơn hàng",
  AccountTab: "Tài khoản",
};

/**
 * Trước đây MỖI screen (Menu/Fruit/Orders) tự dựng 1 <Header title="..."/>
 * riêng, còn AccountScreen lại tự vẽ tiêu đề theo kiểu khác hẳn — dẫn tới
 * tiêu đề mỗi trang một kiểu, một vị trí (không đồng bộ), và lúc chuyển tab
 * có lúc thấy thoáng 2 header chồng nhau (bug "dư logo" ở MenuScreen).
 *
 * AppHeader thay thế TẤT CẢ các bản đó bằng 1 instance DUY NHẤT, mount ở
 * RootNavigator.jsx (ngang hàng Tab.Navigator, không unmount khi đổi tab)
 * — gồm 2 hàng:
 *   1. Thương hiệu (logo + tên quán + slogan từ GlobalContext) — không đổi.
 *   2. Tiêu đề trang — đổi chữ theo tab đang active, crossfade mượt thay vì
 *      remount giật cục.
 *
 * Vì AppHeader nằm NGOÀI Tab.Navigator, nó không thể dùng thẳng
 * `useNavigationState`/`useNavigation` (2 hook đó cần nằm TRONG 1 Navigator
 * — dùng sai chỗ này từng gây lỗi "Couldn't get the navigation state. Is
 * your component inside a navigator?"). Thay vào đó đọc route hiện tại qua
 * `useActiveRoute()` — 1 context được NavigationRoot.jsx cập nhật từ
 * `NavigationContainer`'s `onStateChange`, không phụ thuộc việc component
 * gọi hook có nằm trong Navigator hay không.
 */
export default function AppHeader() {
  const insets = useSafeAreaInsets();
  const { restaurant } = useGlobal();
  const { routeName } = useActiveRoute();
  const title = TAB_TITLES[routeName] ?? null;

  const [displayTitle, setDisplayTitle] = useState(title);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (title === displayTitle) return;
    Animated.timing(opacity, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setDisplayTitle(title);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  return (
    <View className="bg-paper border-b border-ink/5" style={{ paddingTop: insets.top }}>
      <View
        className="flex-row items-center"
        style={{
          paddingHorizontal: SPACING.md,
          paddingTop: SPACING.sm,
          paddingBottom: SPACING.xs,
          gap: SPACING.sm,
        }}
      >
        <Image
          source={logo}
          style={{ width: HEADER_LOGO_SIZE, height: HEADER_LOGO_SIZE, borderRadius: HEADER_LOGO_SIZE / 2 }}
          accessibilityLabel="Logo nhà hàng"
        />
        <View className="flex-shrink">
          <Text className="font-display font-semibold text-ink text-base" numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text className="text-steel text-xs" numberOfLines={1}>
            {restaurant.tagline}
          </Text>
        </View>
      </View>

      {displayTitle ? (
        <Animated.View style={{ opacity, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm }}>
          <Text className="font-display font-semibold text-ink text-lg">{displayTitle}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
