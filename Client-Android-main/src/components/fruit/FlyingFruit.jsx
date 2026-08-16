import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import FoodThumbnail from "../menu/FoodThumbnail";

const FLIGHT_DURATION_MS = 420;

/**
 * Port từ src/components/fruit/FlyingFruit.jsx bản web. Web nội suy CSS
 * top/left/width/height bằng transition (trình duyệt tự tính). RN không có
 * transition CSS nên dùng Animated.Value chạy 0 -> 1 rồi TỰ nội suy
 * (interpolate) mọi thuộc tính hình học từ `from` sang `to` cùng lúc.
 *
 * `flight` = { key, item, from: {x,y,width,height}, to: {x,y,width,height} }
 * — toạ độ tuyệt đối trên CỬA SỔ (từ measureInWindow, xem FruitPickCard.jsx
 * và FruitScreen.jsx), nên component này luôn dùng position: "absolute"
 * gắn vào 1 View bọc toàn màn hình (không phải theo screen cuộn).
 */
export default function FlyingFruit({ flight }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: FLIGHT_DURATION_MS,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      useNativeDriver: false, // nội suy top/left/width/height không dùng được native driver
    }).start();
  }, [flight.key, t]);

  const { from, to } = flight;

  const top = t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  const left = t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const width = t.interpolate({ inputRange: [0, 1], outputRange: [from.width, to.width] });
  const height = t.interpolate({ inputRange: [0, 1], outputRange: [from.height, to.height] });
  const opacity = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "10deg"] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        opacity,
        borderRadius: 999,
        overflow: "hidden",
        transform: [{ scale }, { rotate }],
      }}
    >
      <FoodThumbnail src={flight.item.imageUrl} alt={flight.item.fruitName} className="w-full h-full" />
    </Animated.View>
  );
}
