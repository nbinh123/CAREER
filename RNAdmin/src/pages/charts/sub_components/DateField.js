// src/pages/charts/sub_components/DateField.js
// [UI] Thay <input type="date"> — dùng lại đúng khuôn mẫu DateField đã có ở
// StoragePage.js (Pressable mở @react-native-community/datetimepicker, xử lý
// khác nhau Android/iOS). Tách ra đây làm dùng chung cho Chart03 vì
// StoragePage.js không export component đó ra ngoài file.
import React, { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const shortDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function DateField({ label, value, onChange, accentClassName = "text-purple-500" }) {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(`${value}T00:00:00`) : new Date();

  const handleChange = (event, selected) => {
    if (Platform.OS === "android") {
      setShow(false);
      if (event.type === "set" && selected) onChange(toISODate(selected));
      return;
    }
    if (selected) onChange(toISODate(selected));
  };

  return (
    <View style={{ gap: 3 }}>
      <Text className={`text-xs font-medium ${accentClassName}`}>{label}</Text>
      <Pressable
        onPress={() => setShow(true)}
        className="border border-gray-200 rounded-lg px-2 py-1"
      >
        <Text className="text-xs text-gray-700">{value ? shortDate(value) : "Chọn ngày"}</Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
        />
      )}
      {show && Platform.OS === "ios" && (
        <Pressable onPress={() => setShow(false)} className="items-center bg-purple-600 rounded-lg" style={{ paddingVertical: 6, marginTop: 2 }}>
          <Text className="text-white text-xs font-bold">Xong</Text>
        </Pressable>
      )}
    </View>
  );
}
