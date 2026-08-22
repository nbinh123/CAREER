// App.js — điểm vào ứng dụng.
// [NEN-MONG 1.10] Tương đương phần khởi tạo trong App.js gốc (BrowserRouter
// + <style> import Google Fonts + scrollbar CSS). Trên Expo:
//   - Load font Nunito qua useAppFonts() (@expo-google-fonts/nunito).
//   - Giữ Splash Screen hiển thị tới khi font load xong (preventAutoHideAsync
//     + hideAsync), tránh hiện tượng "flash" chữ với font hệ thống rồi mới
//     chuyển sang Nunito.
//   - NavigationContainer bọc RootNavigator, gắn navigationRef (dùng ở
//     callAPI.js để redirect khi 401 — xem src/navigation/navigationRef.js).
//   - GestureHandlerRootView + SafeAreaProvider là 2 wrapper bắt buộc của
//     react-native-gesture-handler / react-native-safe-area-context, cần
//     thiết cho Drawer Navigator hoạt động đúng.
import "./global.css";
import React, { useCallback, useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";

import { useAppFonts } from "./src/theme/fonts";
import { navigationRef } from "./src/navigation/navigationRef";
import RootNavigator from "./src/navigation/RootNavigator";
import useFoodZustand from "./src/zustand/useFoodZustand";
import useIngredientZustand from "./src/zustand/useIngredientZustand";
import useAuthZustand from "./src/zustand/useAuthZustand";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useAppFonts();

  // [GIU-NGUYEN] Tương đương useEffect fetchData ban đầu trong App.js gốc:
  // load foods + ingredients ngay khi app khởi động, dùng chung toàn app.
  // [TỐI ƯU - global] Trước đây 2 lệnh gọi này bắn đi vô điều kiện, kể cả
  // trước khi đăng nhập. Hệ quả:
  //   1. Với thiết bị chưa đăng nhập: bắn 2 request thừa vào endpoint cần
  //      auth, chắc chắn nhận 401.
  //   2. Nghiêm trọng hơn với người dùng ĐÃ đăng nhập từ phiên trước:
  //      zustand persist rehydrate accessToken từ AsyncStorage là bất đồng
  //      bộ, trong khi effect này chạy ngay ở lần render đầu. Nếu request
  //      bắn đi trước khi rehydrate xong, accessToken vẫn null → 401 →
  //      interceptor của callAPI.js gọi clearAuth() → đăng xuất oan một
  //      phiên đăng nhập hợp lệ, hoàn toàn không phải lỗi tái hiện dễ thấy.
  // Gate theo isAuthenticated giải quyết cả 2: request chỉ bắn khi store đã
  // xác nhận có phiên đăng nhập (đã rehydrate xong hoặc vừa login thành
  // công). Hành vi cho người dùng đã đăng nhập giữ nguyên 100% — getFoods/
  // getIngredients vẫn tự bỏ qua nếu dữ liệu đã có sẵn trong store.
  const getFoods = useFoodZustand((state) => state.getFoods);
  const getIngredients = useIngredientZustand((state) => state.getIngredients);
  const isAuthenticated = useAuthZustand((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    getFoods();
    getIngredients();
  }, [isAuthenticated, getFoods, getIngredients]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NavigationContainer ref={navigationRef}>
          <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
            <RootNavigator />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
