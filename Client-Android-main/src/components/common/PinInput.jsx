import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View, Pressable, TextInput } from "react-native";

// forwardRef + useImperativeHandle: ô nhập thật (TextInput) bị ẩn dưới 6 ô
// tròn chỉ để hiển thị (xem bên dưới), nên bản thân component này giữ
// riêng `inputRef` nội bộ — màn hình cha (LoginScreen/RegisterScreen)
// không thể gọi thẳng `.focus()` vào input ẩn đó nếu không expose ra
// ngoài. `useImperativeHandle` lộ đúng 2 hàm `focus`/`blur` cần thiết,
// dùng để tự chuyển focus xuống đây ngay khi người dùng gõ đủ 10 số điện
// thoại ở ô phía trên (xem chỗ gọi `passwordRef.current?.focus()` trong
// LoginScreen/RegisterScreen).
const PinInput = forwardRef(function PinInput(
  { length = 6, value, onChangeText, autoFocus = false, error = false },
  ref
) {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }));

  const cells = Array.from({ length }, (_, i) => i);

  return (
    <Pressable
      className="flex-row justify-between"
      onPress={() => inputRef.current?.focus()}
    >
      {cells.map((idx) => {
        const isFilled = idx < value.length;
        const isActive = idx === value.length;

        return (
          <View
            key={idx}
            className={`w-11 h-11 rounded-full items-center justify-center border ${
              error
                ? "border-chili"
                : isActive
                ? "border-chili-dark"
                : "border-ink/15"
            } ${isFilled ? "bg-ink" : "bg-white"}`}
          />
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) =>
          onChangeText(text.replace(/[^0-9]/g, "").slice(0, length))
        }
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        secureTextEntry
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
});

export default PinInput;