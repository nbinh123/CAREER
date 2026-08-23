// src/pages/charts/sub_components/TabToggle.js
// [UI] <button> → Pressable, hover className bỏ (không có hover trên RN),
// giữ nguyên state active (bg-white + shadow) y hệt bản gốc.
import React from "react";
import { View, Text, Pressable } from "react-native";

function TabToggle({ value, onChange, options }) {
  return (
    <View className="flex-row gap-0.5 bg-gray-100 rounded-lg p-0.5">
      {options.map(([k, l]) => {
        const active = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            className={`px-3 py-1 rounded-md ${active ? "bg-white" : ""}`}
            style={active ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null}
          >
            <Text className={`text-xs font-bold ${active ? "text-green-700" : "text-gray-400"}`}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default React.memo(TabToggle);
