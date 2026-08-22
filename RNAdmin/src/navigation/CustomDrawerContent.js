import React, { useEffect } from "react";
import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import useAuthZustand from "../zustand/useAuthZustand";
import { NAV } from "./navConfig";
import colors from "../theme/tokens";

function PulseDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green[400] },
        style,
      ]}
    />
  );
}

export default function CustomDrawerContent(props) {
  const { navigation, state } = props;
  const insets = useSafeAreaInsets();
  const currentUser = useAuthZustand((s) => s.currentUser);

  const activeRouteName = state.routes[state.index]?.name;

  const visibleNav = NAV.filter((item) => item.roles.includes(currentUser?.role));

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Logo + tên quán */}
      <View className="p-5 border-b border-gray-100">
        <View className="w-16 h-16 rounded-md overflow-hidden bg-black items-center justify-center mb-2">
          <Image
            source={require("../../assets/logo.png")}
            className="w-full h-full"
            resizeMode="contain"
          />
        </View>
        <Text className="font-black text-green-900 text-sm">Nguyen Binh</Text>
        <Text className="text-xs text-gray-400">Quản lý quán ăn</Text>
      </View>

      {/* NAV */}
      <DrawerContentScrollView {...props} contentContainerStyle={{ padding: 12 }}>
        {visibleNav.map(({ screen, label, icon: Icon }) => {
          const isActive = activeRouteName === screen;
          return (
            <Pressable
              key={screen}
              onPress={() => navigation.navigate(screen)}
              className={`w-full flex-row items-center gap-3 px-3 py-2.5 rounded-xl mb-1 ${
                isActive ? "bg-green-500" : "active:bg-green-50"
              }`}
            >
              <Icon
                size={18}
                color={isActive ? colors.white : colors.gray[600]}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text
                className={`text-sm font-bold ${isActive ? "text-white" : "text-gray-600"}`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </DrawerContentScrollView>

      {/* Trạng thái kết nối realtime */}
      <View
        className="p-4 border-t border-gray-100 flex-row items-center gap-2"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <PulseDot />
        <Text className="text-xs text-gray-400">Kết nối thời gian thực</Text>
      </View>
    </View>
  );
}
