import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle, X, Send } from "lucide-react-native";
import { useSocket } from "../../context/SocketContext";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import ChatBubble from "./ChatBubble";
import { COLORS } from "../../theme/tokens";
import { SPACING, TAB_BAR_BASE_HEIGHT } from "../../theme/layout";

/**
 * Port từ src/components/chat/ChatWidget.jsx bản web. Khác biệt kỹ thuật:
 *   - Cửa sổ chat: web hiện overlay <div> cố định; RN dùng <Modal
 *     transparent animationType="slide"> — vừa có animation trượt lên có
 *     sẵn, vừa tự xử lý đúng z-index trên mọi màn hình mà không cần lo
 *     component này đang lồng ở đâu trong navigator.
 *   - Nút mở chat (bong bóng nổi): PHẢI mount đúng 1 lần ở gốc app (ngang
 *     hàng SocketProvider, phía TRÊN Tab.Navigator) để hiện được ở MỌI tab,
 *     giống hệt vai trò global của nó bên web (nằm ngoài <Routes>).
 *
 * Tránh đè lên CartFloatingButton: bản web tính theo việc thanh "Xem đơn"
 * có đang hiện hay không (`totalCount > 0`). Bản RN giữ nguyên phép tính
 * này để đơn giản, dù CartFloatingButton giờ chỉ thực sự hiện ở tab
 * Menu/Trái cây (không phải mọi tab) — chấp nhận dư khoảng trống nhỏ ở các
 * tab khác đổi lấy việc không phải đồng bộ state giữa 2 nơi.
 */
export default function ChatWidget() {
  const { messages, sendChatMessage, connected, chatHistoryReceived } = useSocket();
  const { totalCount } = useCart();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

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
  // Bug cũ: chỉ cộng insets.bottom (vùng an toàn của máy) mà quên mất chính
  // thanh tab dưới cùng — vì ChatWidget mount NGOÀI Tab.Navigator (ở
  // AppProviders.jsx) nên toạ độ `bottom` của nó tính theo TOÀN màn hình,
  // không tự động "né" thanh tab như các nút nổi khác nằm trong từng
  // screen (vd CartFloatingButton). Kết quả: nút chat trôi xuống đè lên
  // thanh tab. Cộng thêm TAB_BAR_BASE_HEIGHT khi đang ở Main Tab Navigator
  // (isAuthenticated) để nút luôn nổi phía TRÊN thanh tab; khi ở Auth Stack
  // (đăng nhập/đăng ký) không có thanh tab nên giữ nguyên như cũ.
  const tabBarClearance = isAuthenticated ? TAB_BAR_BASE_HEIGHT : 0;
  const triggerBottom = (totalCount > 0 ? 76 : SPACING.sm) + insets.bottom + tabBarClearance;

  return (
    <>
      {!open && (
        <View pointerEvents="box-none" className="absolute inset-x-0" style={{ bottom: 0 }}>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityLabel="Chat với nhà hàng"
            className="absolute right-4 items-center justify-center rounded-full bg-chili"
            style={{ width: 52, height: 52, bottom: triggerBottom }}
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
        <View className="flex-1 bg-paper" style={{ marginTop: insets.top }}>
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

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View
              className="flex-row items-center gap-2 px-3 pt-3"
              style={{ paddingBottom: Math.max(12, insets.bottom) }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                onSubmitEditing={handleSend}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor={COLORS.steelLight}
                className="flex-1 rounded-full bg-paper-dim px-4 py-2.5 text-sm text-ink"
              />
              <Pressable
                onPress={handleSend}
                accessibilityLabel="Gửi"
                className="w-10 h-10 items-center justify-center rounded-full bg-chili"
              >
                <Send size={16} color={COLORS.paper} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}
