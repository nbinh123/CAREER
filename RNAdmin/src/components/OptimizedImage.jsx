import React, { useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import colors from "../theme/tokens";

/**
 * @param {string|null|undefined} uri - URL ảnh remote. Falsy → hiện fallback luôn.
 * @param {string} [name] - Tên item, dùng lấy chữ cái đầu làm fallback.
 * @param {object|object[]} [style] - Style áp cho cả ảnh lẫn fallback (kích thước, borderRadius...).
 * @param {"cover"|"contain"|"fill"|"none"|"scale-down"} [contentFit="cover"] - Tương đương resizeMode của Image cũ.
 * @param {string} [fallbackBackgroundColor] - Màu nền ô fallback.
 * @param {string} [fallbackTextColor] - Màu chữ cái đầu trong ô fallback.
 * @param {number} [transition=0] - Thời gian fade-in (ms) khi ảnh tải xong. Mặc định 0 để giữ nguyên hành vi hiển thị tức thì như Image cũ; truyền >0 nếu muốn hiệu ứng mờ dần.
 */
export default function OptimizedImage({
  uri,
  name,
  style,
  contentFit = "cover",
  fallbackBackgroundColor = colors.green[50],
  fallbackTextColor = colors.green[200],
  transition = 0,
  ...rest
}) {
  const [errored, setErrored] = useState(false);

  if (!uri || errored) {
    return (
      <View
        style={[
          { alignItems: "center", justifyContent: "center", backgroundColor: fallbackBackgroundColor },
          style,
        ]}
      >
        <Text style={{ fontSize: 34, fontWeight: "900", color: fallbackTextColor }}>
          {name?.[0]?.toUpperCase() ?? "?"}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="disk"
      transition={transition}
      onError={() => setErrored(true)}
      {...rest}
    />
  );
}
