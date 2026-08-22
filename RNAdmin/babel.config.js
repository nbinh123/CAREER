// [LƯU Ý QUAN TRỌNG] react-native-reanimated v4 (dùng trong project này) tách
// toàn bộ cơ chế worklet ra gói react-native-worklets riêng — babel plugin
// ĐÚNG cho v4 là "react-native-worklets/plugin", KHÔNG còn là
// "react-native-reanimated/plugin" như v3. Dùng nhầm plugin cũ sẽ không báo
// lỗi rõ ràng, chỉ khiến mọi animation (pulse dot, blob nền Login/Register,
// toast fade...) im lặng không chạy. Yêu cầu bắt buộc đi kèm: app phải bật
// New Architecture (Fabric) — mặc định đã bật trên Expo SDK 54+.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-worklets/plugin"],
  };
};
