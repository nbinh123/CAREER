// src/navigation/AppHeader.js
// [UI] Chuyển từ phần <header> trong App.js gốc. Vì kiến trúc RN tách hẳn
// nhánh "chưa đăng nhập" (LoginPage riêng, không có header) khỏi nhánh
// "đã đăng nhập" (Drawer luôn có header này), phần nút "Đăng nhập" khi
// !isLoggedIn của bản gốc không còn cần thiết — người dùng chỉ thấy header
// này sau khi đã đăng nhập, y hệt hiệu ứng cuối cùng nhìn thấy trên web.
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Menu, Bell, UserPlus, LogOut } from "lucide-react-native";
import useAuthZustand from "../zustand/useAuthZustand";
import { NAV } from "./navConfig";
import colors from "../theme/tokens";

export default function AppHeader({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { currentUser, logout, stopWorking, beginWorking, isWorking } = useAuthZustand();

  const navItem = NAV.find((n) => n.screen === route.name);
  const title = navItem?.label ?? route.name;

  return (
    <View style={{ paddingTop: insets.top }} className="bg-white border-b border-gray-100">
      <View className="flex-row items-center gap-3 px-4 py-3">
        {/* Hamburger — mở Drawer, thay setMobileOpen(true) */}
        <Pressable
          onPress={() => navigation.openDrawer()}
          className="w-9 h-9 rounded-xl items-center justify-center active:bg-green-50"
        >
          <Menu size={20} color={colors.gray[500]} />
        </Pressable>

        {/* Breadcrumb */}
        <View className="flex-row items-center gap-2">
          <Text className="text-gray-300">/</Text>
          <Text className="font-bold text-gray-700 text-sm">{title}</Text>
        </View>

        {/* Right actions */}
        <View className="flex-row items-center gap-2 ml-auto">
          {/* Trạng thái hoạt động / tạm dừng */}
          <Pressable
            onPress={() => (isWorking ? stopWorking() : beginWorking())}
            className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200"
          >
            <Bell size={13} color={colors.emerald[700]} strokeWidth={2.5} />
            <Text className="text-xs font-bold text-emerald-700">
              {isWorking ? "Đang hoạt động" : "Đã tạm dừng"}
            </Text>
          </Pressable>

          {/* Đăng ký nhân viên — chỉ admin */}
          {currentUser?.role === "admin" && (
            <Pressable
              onPress={() => navigation.getParent()?.navigate("Register")}
              className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 items-center justify-center"
            >
              <UserPlus size={15} color={colors.emerald[700]} strokeWidth={2.5} />
            </Pressable>
          )}

          {/* Avatar + tên */}
          <View className="flex-row items-center gap-2">
            <View style={styles.avatar}>
              <Text className="text-white text-sm font-black">
                {currentUser?.name?.[0]?.toUpperCase() ?? "U"}
              </Text>
            </View>
          </View>

          {/* Đăng xuất */}
          <Pressable
            onPress={logout}
            className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center"
          >
            <LogOut size={16} color={colors.red[500]} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.emerald[500],
  },
});
