import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle, X, Send } from "lucide-react-native";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { useActiveRoute } from "../../context/ActiveRouteContext";
import ChatBubble from "./ChatBubble";
import { COLORS } from "../../theme/tokens";
import { SPACING, TAB_BAR_BASE_HEIGHT } from "../../theme/layout";
import { ROUTES } from "../../constants/routes";

const SCREEN_EXTRA_CLEARANCE = {
  [ROUTES.CHECKOUT_SCREEN]: 180,
};

export default function ChatWidget() {
  const { messages, sendChatMessage, connected, chatHistoryReceived } = useSocket();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);
  const { routeName: activeRouteName } = useActiveRoute();

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages, open]);

  const handleSend = () => {
    const value = text.trim();
    if (!value) return;
    sendChatMessage(value);
    setText("");
  };

  const unreadFromAdmin = !open && messages.some((m) => m.from === "admin");
  const tabBarClearance = isAuthenticated ? TAB_BAR_BASE_HEIGHT : 0;

  // Vị trí cố định theo từng màn hình - không còn phụ thuộc vào số lượng
  // món trong giỏ, tránh việc nút bị "nhảy" lên và che nội dung phía dưới
  // (như đã xảy ra ở màn Thông tin giao hàng).
  const extraClearance = SCREEN_EXTRA_CLEARANCE[activeRouteName] ?? SPACING.sm;
  const triggerBottom = extraClearance + insets.bottom + tabBarClearance;

  return (
    <>
      {!open && (
        <View pointerEvents="box-none" className="absolute inset-x-0" style={{ bottom: 0 }}>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityLabel="Chat với nhà hàng"
            className="absolute right-4 items-center justify-center rounded-full bg-chili"
            style={{
              width: 52,
              height: 52,
              bottom: triggerBottom,
              opacity: 0.85,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.18,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <MessageCircle size={22} color={COLORS.paper} />
            {unreadFromAdmin && (
              <View
                className="absolute rounded-full bg-turmeric"
                style={{ top: 0, right: 0, width: 12, height: 12, borderWidth: 2, borderColor: COLORS.paper }}
              />
            )}
          </Pressable>
        </View>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        {/* KeyboardAvoidingView giờ bọc TOÀN BỘ nội dung (header + scroll + input),
            không chỉ riêng hàng input. Nhờ vậy khi bàn phím bật lên, cả khối co lại
            đúng cách và ô nhập luôn nổi ngay trên bàn phím, ở cả iOS lẫn Android. */}
        <KeyboardAvoidingView
          className="flex-1 bg-paper"
          style={{ marginTop: insets.top }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View className="flex-row items-center justify-between px-4 py-3.5 bg-ink">
            <View className="flex-row items-center gap-2">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: connected ? COLORS.jade : COLORS.steelLight }}
              />
              <View>
                <Text className="font-display font-medium text-sm text-paper">Nhân viên hỗ trợ</Text>
                <Text className="text-[11px] text-steel-light">
                  {connected ? "Đang trực tuyến" : "Đang kết nối..."}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => setOpen(false)} accessibilityLabel="Đóng chat" className="p-1.5">
              <X size={20} color={COLORS.paper} />
            </Pressable>
          </View>

          <ScrollView ref={scrollRef} className="flex-1 px-4 py-4" contentContainerStyle={{ gap: 12 }}>
            {chatHistoryReceived && messages.length === 0 && (
              <Text className="text-steel text-xs text-center py-6">
                Có câu hỏi về món ăn, đơn hàng hay giao nhận? Nhắn cho quán nhé.
              </Text>
            )}
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
          </ScrollView>

          <View
            className="flex-row items-center gap-3 px-4 pt-3 border-t border-paper-dim"
            style={{ paddingBottom: Math.max(14, insets.bottom) }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSend}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor={COLORS.steelLight}
              className="flex-1 rounded-full bg-paper-dim px-5 text-sm text-ink"
              style={{ height: 48, paddingVertical: 0 }}
            />
            <Pressable
              onPress={handleSend}
              accessibilityLabel="Gửi"
              className="items-center justify-center rounded-full bg-chili"
              style={{
                width: 48,
                height: 48,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Send size={20} color={COLORS.paper} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}