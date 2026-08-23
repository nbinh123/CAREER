import "./global.css";
import React, { useCallback, useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./src/config/queryClient";
import { useAppFonts } from "./src/theme/fonts";
import { navigationRef } from "./src/navigation/navigationRef";
import RootNavigator from "./src/navigation/RootNavigator";
import useFoodZustand from "./src/zustand/useFoodZustand";
import useIngredientZustand from "./src/zustand/useIngredientZustand";
import useAuthZustand from "./src/zustand/useAuthZustand";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useAppFonts();
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
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}