import React from "react";
import { View } from "react-native";
import { COLORS } from "../../theme/tokens";

// Thay cho class .dashed-divider dùng khắp bản web (index.css:
// `border-top: 1.5px dashed #d8cfba`). NativeWind không map opacity màu
// dashed chuẩn xác qua className border-dashed nên tách riêng 1 component
// nhỏ, style trực tiếp — dùng lại được ở mọi nơi thay cho className
// "dashed-divider" bên web.
export default function DashedDivider({ className = "" }) {
  return (
    <View
      className={className}
      style={{ borderTopWidth: 1.5, borderStyle: "dashed", borderTopColor: COLORS.divider }}
    />
  );
}
