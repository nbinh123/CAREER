import "./global.css";
import React from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { ActiveRouteProvider } from "./src/context/ActiveRouteContext";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from "@expo-google-fonts/space-grotesk";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";

import { AuthProvider } from "./src/context/AuthContext";
import AppProviders from "./src/AppProviders";
import NavigationRoot from "./src/navigation/NavigationRoot";
import Loading from "./src/components/common/Loading";

// Gắn theo đúng thứ tự mô tả trong HUONG_DAN_TICH_HOP.md:
//   AuthProvider (đăng nhập/token) > AppProviders (Global/Cart/Socket +
//   Toast/ChatWidget global) > NavigationRoot (NavigationContainer +
//   ActiveRouteProvider, xem navigation/NavigationRoot.jsx) > RootNavigator
//   (Auth Stack <-> Main Tab Navigator tuỳ isAuthenticated).
export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    IBMPlexMono_500Medium,
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 bg-paper">
          <Loading label="Đang tải..." />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-paper">
        <AuthProvider>
          <ActiveRouteProvider>
            <AppProviders>
              <NavigationRoot />
            </AppProviders>
          </ActiveRouteProvider>
        </AuthProvider>
        <StatusBar style="dark" />
      </View>
    </SafeAreaProvider>
  );
}
