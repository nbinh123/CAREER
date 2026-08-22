// src/theme/fonts.js
// [NEN-MONG 0.10 / 1.10] Bản gốc load Nunito qua @import Google Fonts CSS
// trực tiếp trong App.js (400/500/600/700/800/900). Trên Expo dùng
// @expo-google-fonts/nunito + expo-font, load 1 lần ở App.js root bằng
// useFonts(), giữ Splash Screen hiện tới khi load xong (xem App.js).
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from "@expo-google-fonts/nunito";

export function useAppFonts() {
  return useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
}

// Map tương đương "font-weight" CSS -> tên font family đã load, để dùng
// trong style={{ fontFamily: fonts.bold }} ở những nơi NativeWind className
// không tiện set weight cụ thể (VD Nunito_800ExtraBold không có class
// Tailwind font-extrabold mặc định trỏ đúng font family custom).
export const fonts = {
  regular: "Nunito_400Regular",
  medium: "Nunito_500Medium",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
  black: "Nunito_900Black",
};
