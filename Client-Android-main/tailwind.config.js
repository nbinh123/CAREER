/**
 * NativeWind config cho toàn bộ app RN — dựng ở giai đoạn 4 cùng lúc setup
 * NativeWind (mục 5.1 kế hoạch). File này liệt kê lại ở đây để bạn ĐỐI CHIẾU
 * / MERGE với file tailwind.config.js thật đang có ở root dự án RN — KHÔNG
 * ghi đè trực tiếp nếu file gốc đã có thêm content path hoặc plugin khác.
 *
 * Token màu/border-radius copy nguyên từ tailwind.config.js của Client-Online
 * (bản web) theo đúng mục 5.1b. Font family dùng tên biến thể cụ thể vì RN
 * không tự suy ra "Space Grotesk 600" như web — phải nạp đúng từng weight
 * qua @expo-google-fonts/space-grotesk, @expo-google-fonts/inter,
 * @expo-google-fonts/ibm-plex-mono rồi expo-font mới dùng được các tên này.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#221B14", soft: "#332A1F" },
        paper: { DEFAULT: "#FBF6EC", dim: "#F1EADA" },
        chili: { DEFAULT: "#D6361F", dark: "#B32B18", light: "#F0E1DB" },
        turmeric: { DEFAULT: "#E8A93E", dark: "#C98A24", light: "#FBEED2" },
        jade: { DEFAULT: "#2E6F55", light: "#DCEBE3" },
        steel: { DEFAULT: "#7A7267", light: "#B9B2A4" },
      },
      fontFamily: {
        display: ["SpaceGrotesk_600SemiBold"],
        displayMedium: ["SpaceGrotesk_500Medium"],
        body: ["Inter_400Regular"],
        bodyMedium: ["Inter_500Medium"],
        bodySemibold: ["Inter_600SemiBold"],
        mono: ["IBMPlexMono_500Medium"],
      },
      borderRadius: {
        ticket: 18,
      },
    },
  },
  plugins: [],
};
