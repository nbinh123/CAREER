import React from "react";
import { View, Image, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING, HEADER_LOGO_SIZE } from "../../theme/layout";

const logo = require("../../assets/logo.png");

/**
 * Header dùng chung cho các tab chính (hiện đang dùng ở MenuScreen — có thể
 * tái dùng cho FruitScreen/OrdersScreen/AccountScreen/CartScreen sau nếu
 * muốn đồng bộ toàn app, chỉ cần import + truyền title/subtitle).
 *
 * Trước đây CategoryTabs nằm ngay sát mép trên màn hình (dính status bar,
 * không có logo/tiêu đề) — component này vừa thêm logo, vừa tự cộng
 * insets.top nên nội dung không bao giờ bị tai thỏ/status bar che hay dính
 * sát viền trên, dùng đúng thang SPACING (tỉ lệ vàng) thay vì số tuỳ ý.
 */
export default function Header({ title, subtitle }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center bg-paper"
      style={{
        paddingTop: insets.top + SPACING.sm,
        paddingBottom: SPACING.sm,
        paddingHorizontal: SPACING.md,
        gap: SPACING.sm,
      }}
    >
      <Image
        source={logo}
        style={{ width: HEADER_LOGO_SIZE, height: HEADER_LOGO_SIZE, borderRadius: HEADER_LOGO_SIZE / 2 }}
        accessibilityLabel="Logo nhà hàng"
      />
      <View className="flex-shrink">
        <Text className="font-display font-semibold text-ink text-base">{title}</Text>
        {subtitle ? (
          <Text className="text-steel text-xs" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
