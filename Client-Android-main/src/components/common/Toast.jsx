import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2 } from "lucide-react-native";
import { useGlobal } from "../../context/GlobalContext";
import { COLORS } from "../../theme/tokens";

// Port từ src/components/common/Toast.jsx bản web. Web định vị bằng
// `fixed inset-x-0 bottom-24` so với viewport trình duyệt; RN không có
// "fixed" thật sự nên component này PHẢI được mount 1 lần gần gốc cây (cùng
// cấp SocketProvider/App shell, phía TRÊN Tab.Navigator) để absolute tính
// theo toàn màn hình chứ không theo 1 screen con nào.
//
// bottom offset cộng thêm insets.bottom (safe area) + khoảng chừa cho tab
// bar — 72 là ước lượng chiều cao tab bar mặc định của React Navigation,
// chỉnh lại nếu tab bar thực tế của bạn cao hơn/thấp hơn.
export default function Toast() {
  const { toast } = useGlobal();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [toast, opacity]);

  if (!toast) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 items-center px-4"
      style={{ bottom: 72 + insets.bottom }}
    >
      <Animated.View
        style={{ opacity }}
        className="flex-row items-center gap-2 bg-ink rounded-full px-4 py-2.5 max-w-sm"
      >
        <CheckCircle2 size={16} color={COLORS.turmeric} />
        <Text className="text-paper text-sm font-body flex-shrink">{toast.message}</Text>
      </Animated.View>
    </View>
  );
}
