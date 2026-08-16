import React from "react";
import { View, Text } from "react-native";
import { formatTime } from "../../utils/formatTime";

// Port từ src/components/chat/ChatBubble.jsx bản web.
export default function ChatBubble({ message }) {
  const isCustomer = message.from === "customer";
  return (
    <View className={`flex-row ${isCustomer ? "justify-end" : "justify-start"}`}>
      <View
        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
          isCustomer ? "bg-ink rounded-br-md" : "bg-paper-dim rounded-bl-md"
        }`}
      >
        <Text className={`text-sm leading-relaxed ${isCustomer ? "text-paper" : "text-ink"}`}>
          {message.text}
        </Text>
        <Text className={`text-[10px] mt-1 ${isCustomer ? "text-steel-light" : "text-steel"}`}>
          {formatTime(message.at)}
        </Text>
      </View>
    </View>
  );
}
