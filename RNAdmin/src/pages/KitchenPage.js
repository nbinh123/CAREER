// src/pages/KitchenPage.js
// [UI] Chuyển đổi KitchenPage.js gốc (real-time qua Socket.IO). Giữ nguyên
// 100% logic nghiệp vụ: join phòng "join_kitchen" lúc connect, nhận toàn bộ
// hàng chờ qua sự kiện "kitchen_state", đồng hồ chờ tự cập nhật mỗi 10s,
// 3 mức cảnh báo theo phút chờ (fresh <5' / warn 5-10' / urgent ≥10'),
// đánh dấu 1 món hoặc cả phiếu đã nấu xong qua "mark_item_ready", hiệu ứng
// mờ dần (doneFlash) ngay khi bấm — không chờ server xác nhận lại.
//
// Khác biệt platform:
//   - Bản gốc tự gọi `io(SOCKET_URL, {...})` lúc mount VÀ `socket.disconnect()`
//     lúc unmount — kết nối riêng, sống chết theo đúng vòng đời trang này.
//     Bản RN đã có sẵn `utils/socket.js`: 1 instance io() DÙNG CHUNG toàn
//     app (chính file đó đã ghi chú rõ dành cho "OrdersPage, KitchenPage,
//     chat..."), nên ở đây import thẳng instance đó thay vì tự tạo. Hệ quả:
//       + KHÔNG gọi socket.disconnect() lúc unmount — sẽ ảnh hưởng các
//         trang khác đang dùng chung kết nối; cleanup chỉ gỡ đúng 3 listener
//         trang này tự thêm (socket.off với cùng reference handler).
//       + Nếu vào trang này SAU KHI socket đã connect từ trước (vd điều
//         hướng từ 1 trang real-time khác), sự kiện "connect" sẽ không bắn
//         lại nữa → check `socket.connected` ngay khi effect chạy và tự
//         kích hoạt handleConnect() (setConnected + emit "join_kitchen")
//         thủ công nếu đã kết nối sẵn. Bản gốc không cần xử lý case này vì
//         luôn tự tạo kết nối mới từ đầu mỗi lần mount.
//     markReady/markAllReady theo đó cũng emit thẳng qua `socket` thay vì
//     qua `socketRef.current` (không cần ref nữa vì socket là singleton
//     import trực tiếp, không tạo trong component).
//   - CSS grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` (nhiều phiếu/
//     hàng trên màn rộng) → RN không có breakpoint theo bề ngang kiểu này
//     và màn di động (~380px) không đủ chỗ hiển thị 2-3 cột có ý nghĩa →
//     xếp dọc 1 cột, cùng cách các trang khác trong dự án đã xử lý (không
//     trang nào dùng grid nhiều cột responsive).
//   - `animate-pulse` (CSS keyframe, áp cho cả phiếu khi urgent) →
//     Reanimated withRepeat/withTiming trên opacity, dùng đúng thông số đã
//     thiết lập sẵn ở SkeletonCard trong Customers.js (700ms, sin easing)
//     để đồng nhất "nhịp nhấp nháy" giữa các trang trong toàn app.
//   - Toast: bản gốc `fixed top-4 right-4` → nổi đáy màn hình giữa,
//     Animated FadeInDown/FadeOutDown, đúng vị trí/kiểu dáng toast đã dùng
//     xuyên suốt dự án (LoginPage/RegisterPage/CashFlow/Customers) thay vì
//     góc trên phải (dễ bị tai thỏ/status bar che trên di động).
//   - emoji (item.emoji) hiển thị trực tiếp bằng Text, RN render emoji unicode
//     bình thường như bản gốc.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Check, ChefHat, Flame, Wifi, WifiOff } from "lucide-react-native";
import socket from "../utils/socket";
import colors from "../theme/tokens";

// ─── Hằng số [GIU-NGUYEN] ────────────────────────────────────────────────
const WARN_MINUTES = 5; // chờ quá mốc này → vàng, cần chú ý
const URGENT_MINUTES = 10; // chờ quá mốc này → đỏ nhấp nháy, ưu tiên nấu ngay

// ─── Helpers [GIU-NGUYEN] ────────────────────────────────────────────────
function urgencyOf(mins) {
  if (mins >= URGENT_MINUTES) return "urgent";
  if (mins >= WARN_MINUTES) return "warn";
  return "fresh";
}

// Server (qua sự kiện socket) có thể gửi sai định dạng — ép kiểu mảng
// tường minh ở đây để .map/.filter/.reduce phía dưới không bao giờ crash.
function safeQueue(data) {
  if (!Array.isArray(data)) return [];
  return data.map((t) => ({
    ...t,
    items: Array.isArray(t?.items) ? t.items : [],
  }));
}

const URGENCY_STYLE = {
  fresh: {
    card: "border-gray-100",
    bar: "bg-green-500",
    badge: "bg-green-50 text-green-600 border-green-100",
    timerText: "text-gray-400",
    pulse: false,
  },
  warn: {
    card: "border-amber-200",
    bar: "bg-amber-400",
    badge: "bg-amber-50 text-amber-600 border-amber-200",
    timerText: "text-amber-500",
    pulse: false,
  },
  urgent: {
    card: "border-red-300",
    bar: "bg-red-500",
    badge: "bg-red-50 text-red-600 border-red-200",
    timerText: "text-red-500",
    pulse: true,
  },
};

/* ── Wrap nhấp nháy (thay animate-pulse), chỉ bật khi enabled=true ──────── */
function PulseCard({ enabled, className, children }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!enabled) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [enabled, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: enabled ? opacity.value : 1 }));

  return (
    <Animated.View style={animStyle} className={className}>
      {children}
    </Animated.View>
  );
}

/* ── 1 món trong phiếu ───────────────────────────────────────────────────── */
function TicketItemRow({ item, mins, isFlashing, onMarkReady }) {
  const itemLevel = urgencyOf(mins);
  return (
    <View
      className="flex-row items-center rounded-xl px-2.5 py-2.5 bg-gray-50"
      style={{ gap: 10, opacity: isFlashing ? 0.4 : 1 }}
    >
      <Text style={{ fontSize: 22, lineHeight: 26 }}>{item.emoji}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text className="text-xs font-bold text-gray-700" numberOfLines={1}>
          {item.foodName} <Text className="text-gray-400">× {item.quantity}</Text>
        </Text>
        {!!item.note && (
          <Text className="text-[11px] font-semibold text-blue-600" numberOfLines={1}>
            {item.note}
          </Text>
        )}
        <Text className={`text-[11px] ${itemLevel === "urgent" ? "font-semibold text-red-500" : "text-gray-400"}`}>
          Chờ {mins} phút
        </Text>
      </View>
      <Pressable
        onPress={onMarkReady}
        disabled={isFlashing}
        style={{ opacity: isFlashing ? 0.4 : 1 }}
        className="w-8 h-8 rounded-lg bg-green-500 items-center justify-center"
      >
        <Check size={16} color={colors.white} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

/* ── 1 phiếu order = 1 bàn ───────────────────────────────────────────────── */
function TicketCard({ table, waitMinutes, doneFlash, onMarkReady, onMarkAllReady }) {
  const items = table.items || [];
  const oldestMins = items.length ? waitMinutes(items[0].confirmedAt) : 0;
  const level = urgencyOf(oldestMins);
  const style = URGENCY_STYLE[level];
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <PulseCard enabled={style.pulse} className={`bg-white rounded-2xl border-2 overflow-hidden ${style.card}`}>
      {/* Vạch màu trạng thái ở đỉnh phiếu */}
      <View style={{ height: 6 }} className={style.bar} />

      {/* Header phiếu */}
      <View className="px-4 pt-3 pb-2.5 flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          {level === "urgent" && <Flame size={16} color={colors.red[500]} />}
          <Text className="font-black text-gray-800 text-lg">{table.tableName}</Text>
        </View>
        <Text className={`text-sm font-bold px-2.5 py-1 rounded-lg border ${style.badge}`}>
          {oldestMins} phút
        </Text>
      </View>

      {/* Danh sách món */}
      <View className="px-3 pb-3" style={{ gap: 6 }}>
        {items.map((item, iIdx) => {
          const key = `${table.tableId}:${item.id ?? iIdx}`;
          return (
            <TicketItemRow
              key={key}
              item={item}
              mins={waitMinutes(item.confirmedAt)}
              isFlashing={doneFlash.has(key)}
              onMarkReady={() => onMarkReady(table.tableId, item.id, table.tableName, item.foodName)}
            />
          );
        })}
      </View>

      {/* Hoàn thành cả phiếu */}
      {items.length > 1 && (
        <Pressable
          onPress={() => onMarkAllReady(table)}
          className="w-full py-2.5 border-t border-gray-100 items-center"
        >
          <Text className="text-xs font-bold text-gray-400">
            Hoàn thành cả phiếu ({totalQty} món)
          </Text>
        </Pressable>
      )}
    </PulseCard>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function KitchenPage() {
  // ── State [GIU-NGUYEN] ──────────────────────────────────────────────
  const [connected, setConnected] = useState(socket.connected);
  const [queue, setQueue] = useState([]); // [{ tableId, tableName, items: [...] }]
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState(null); // { type, msg }
  const [doneFlash, setDoneFlash] = useState(() => new Set()); // key vừa bấm xong, để hiệu ứng mờ dần

  // ─── Toast helper ────────────────────────────────────────────────────
  const showToast = useCallback((type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ─── Socket setup ────────────────────────────────────────────────────
  useEffect(() => {
    function handleConnect() {
      setConnected(true);
      socket.emit("join_kitchen");
    }
    function handleDisconnect() {
      setConnected(false);
    }
    function handleKitchenState(data) {
      setQueue(safeQueue(data));
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("kitchen_state", handleKitchenState);

    // socket dùng chung toàn app — nếu đã connect từ trước khi vào trang
    // này thì sự kiện "connect" sẽ không bắn lại, tự kích hoạt thủ công.
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("kitchen_state", handleKitchenState);
      // KHÔNG socket.disconnect() — instance dùng chung, xem ghi chú đầu file.
    };
  }, []);

  // Đồng hồ chờ — cập nhật mỗi 10s để giờ chờ + màu cảnh báo luôn sát thực tế
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  const waitMinutes = useCallback(
    (confirmedAt) => {
      if (!confirmedAt) return 0;
      const ts = new Date(confirmedAt).getTime();
      if (isNaN(ts)) return 0;
      return Math.max(0, Math.floor((now - ts) / 60000));
    },
    [now]
  );

  // ─── Đánh dấu đã nấu xong ──────────────────────────────────────────
  const markReady = useCallback(
    (tableId, itemId, tableName, foodName) => {
      const key = `${tableId}:${itemId}`;
      setDoneFlash((prev) => new Set(prev).add(key));
      socket.emit("mark_item_ready", { tableId, itemId });
      showToast("success", `${foodName} — ${tableName} đã xong`);
    },
    [showToast]
  );

  const markAllReady = useCallback(
    (table) => {
      (table.items || []).forEach((item) => {
        socket.emit("mark_item_ready", { tableId: table.tableId, itemId: item.id });
      });
      showToast("success", `${table.tableName} — đã xong toàn bộ`);
    },
    [showToast]
  );

  const totalDishes = queue.reduce((s, t) => s + t.items.reduce((a, i) => a + (i.quantity || 0), 0), 0);
  const urgentCount = queue.filter((t) => t.items.some((i) => waitMinutes(i.confirmedAt) >= URGENT_MINUTES)).length;

  // ──────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
        {/* ── Header ────────────────────────────────────────────────── */}
        <View>
          <Text className="text-2xl font-black text-green-900">Nhà bếp</Text>
          <View className="flex-row flex-wrap items-center mt-1" style={{ gap: 8 }}>
            <Text className="text-gray-500 text-sm">
              {totalDishes} món / {queue.length} bàn đang chờ
            </Text>
            {urgentCount > 0 && (
              <Text className="text-red-500 font-bold text-sm">· {urgentCount} bàn cần ưu tiên</Text>
            )}
            <View
              className={`flex-row items-center px-2 py-0.5 rounded-full ${connected ? "bg-green-100" : "bg-red-100"}`}
              style={{ gap: 4 }}
            >
              {connected ? (
                <Wifi size={11} color={colors.green[700]} />
              ) : (
                <WifiOff size={11} color={colors.red[600]} />
              )}
              <Text className={`text-xs font-semibold ${connected ? "text-green-700" : "text-red-600"}`}>
                {connected ? "Real-time" : "Mất kết nối"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Danh sách phiếu order (thay grid nhiều cột) ─────────────── */}
        {queue.length === 0 ? (
          <View className="bg-white rounded-2xl border border-gray-100 py-20 items-center">
            <ChefHat size={40} color={colors.gray[300]} />
            <Text className="font-semibold text-gray-500 mt-3">Bếp đang trống</Text>
            <Text className="text-xs text-gray-400 mt-1">Món admin xác nhận sẽ hiện tại đây</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {queue.map((t, tIdx) => (
              <TicketCard
                key={t.tableId ?? tIdx}
                table={t}
                waitMinutes={waitMinutes}
                doneFlash={doneFlash}
                onMarkReady={markReady}
                onMarkAllReady={markAllReady}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {!!toast && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOutDown.duration(300)}
          style={{ position: "absolute", left: 0, right: 0, bottom: 20, alignItems: "center" }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 11,
              borderRadius: 100,
              backgroundColor: toast.type === "success" ? colors.green[600] : colors.red[600],
            }}
          >
            <Text style={{ color: colors.white, fontSize: 13, fontWeight: "800" }}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
