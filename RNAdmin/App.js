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

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useAppFonts();

  // [GIU-NGUYEN] Tương đương useEffect fetchData ban đầu trong App.js gốc:
  // load foods + ingredients ngay khi app khởi động, dùng chung toàn app.
  const getFoods = useFoodZustand((state) => state.getFoods);
  const getIngredients = useIngredientZustand((state) => state.getIngredients);

  useEffect(() => {
    getFoods();
    getIngredients();
  }, [getFoods, getIngredients]);

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
