import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Bell,
  Check,
  CheckCircle2,
  ChefHat,
  Flame,
  Lock,
  MessageCircle,
  Search,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import socket from "../utils/socket";
import fmtVND from "../utils/fmtVND";
import fmtDate from "../utils/fmtDate";
import { getData, postData } from "../utils/callAPI";
import colors from "../theme/tokens";

// ─── Hằng số [GIU-NGUYEN] ───────────────────────────────────────────────────
const TABLE_COUNT = 12;
const CHAT_TOOLTIP_DURATION = 8000; // tooltip tự ẩn sau 8s nếu admin không bấm vào
const ACTION_TOAST_DURATION = 3500;

const PAYMENT_OPTIONS = [
  ["CASH", "💵 Tiền mặt"],
  ["BANKING", "🏦 Chuyển khoản"],
  ["MOMO", "🟣 MoMo"],
  ["ZALOPAY", "🔵 ZaloPay"],
];
const PAYMENT_FILTER_OPTIONS = [["", "Tất cả PTTT"], ...PAYMENT_OPTIONS];
const STATUS_FILTER_OPTIONS = [
  ["", "Tất cả"],
  ["PENDING", "Chờ"],
  ["PROCESSING", "Đang làm"],
  ["COMPLETED", "Hoàn thành"],
  ["CANCELLED", "Đã hủy"],
];
const STATUS_META = {
  PENDING: { label: "Chờ", bgClass: "bg-orange-100", textClass: "text-orange-600" },
  PROCESSING: { label: "Đang làm", bgClass: "bg-blue-100", textClass: "text-blue-600" },
  COMPLETED: { label: "Hoàn thành", bgClass: "bg-green-100", textClass: "text-green-600" },
  CANCELLED: { label: "Đã hủy", bgClass: "bg-red-100", textClass: "text-red-600" },
};

const mkEmptyTable = (id) => ({
  id,
  name: `Bàn ${id}`,
  status: "empty",
  since: null,
  items: [],
  pendingItems: [],
  active: false, // mặc định khoá gọi món cho tới khi admin bật, khớp default ở DB
  chatEnabled: true, // mặc định mở tin nhắn, khớp default ở DB
  guestName: null,
  guestPhone: null,
  messages: [],
});

// fmtDate/fmtVND là util bên ngoài, không kiểm soát được throw gì với giá
// trị null/sai định dạng — bọc safeCall, đúng pattern OnlineOrdersPage.js.
function safeFmtDate(value) {
  if (!value) return "—";
  try {
    return fmtDate(value);
  } catch (err) {
    console.error("[fmtDate]", err);
    return "—";
  }
}
function safeFmtVND(value) {
  try {
    return fmtVND(Number(value) || 0);
  } catch (err) {
    console.error("[fmtVND]", err);
    return "0₫";
  }
}

// ─── Chuẩn hoá 1 bàn nhận từ server [GIU-NGUYEN, thuần JS] ─────────────────
function normalizeTable(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    active: raw.active ?? false,
    chatEnabled: raw.chatEnabled !== false,
    guestName: raw.guestName || null,
    guestPhone: raw.guestPhone || null,
    since: raw.since ? new Date(raw.since) : null,
    items: raw.items || [],
    pendingItems: raw.pendingItems || [],
    messages: raw.messages || [],
  };
}

// ─── Ngày tháng cho DateField [copy StoragePage.js/VoucherPage.js] ─────────
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const shortDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ (thay Button/Modal/StatusBadge dùng chung ở bản web)
════════════════════════════════════════════════════════════ */
const ACTION_VARIANTS = {
  primary: { box: "bg-green-500", text: "text-white" },
  secondary: { box: "bg-white border border-gray-200", text: "text-gray-600" },
  danger: { box: "bg-red-500", text: "text-white" },
};
function ActionBtn({ icon: Icon, label, onPress, variant = "secondary", disabled, loading, flex }) {
  const v = ACTION_VARIANTS[variant] ?? ACTION_VARIANTS.secondary;
  const iconColor = variant === "primary" || variant === "danger" ? colors.white : colors.gray[600];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.5 : 1, flex: flex ? 1 : undefined }}
      className={`flex-row items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl ${v.box}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        !!Icon && <Icon size={14} color={iconColor} />
      )}
      <Text className={`text-sm font-bold ${v.text}`}>{label}</Text>
    </Pressable>
  );
}

/* Overlay dùng chung cho mọi modal — tương đương e.stopPropagation() bên web. */
function ModalOverlay({ onClose, children }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(20,83,45,0.35)", alignItems: "center", justifyContent: "center", padding: 20 }}
      >
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 440 }}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
function ModalHeader({ title, onClose }) {
  return (
    <View className="px-5 pt-5 pb-4 flex-row items-center justify-between border-b border-gray-100">
      <Text className="text-base font-black text-green-900 flex-1 pr-3" numberOfLines={1}>
        {title}
      </Text>
      {!!onClose && (
        <Pressable onPress={onClose} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
          <X size={16} color={colors.gray[400]} />
        </Pressable>
      )}
    </View>
  );
}

function EmptyState({ icon: Icon, text, subtext }) {
  return (
    <View className="items-center py-14 px-6">
      <Icon size={32} color={colors.gray[300]} style={{ opacity: 0.6 }} />
      <Text className="text-sm text-gray-400 font-bold mt-2 text-center">{text}</Text>
      {!!subtext && <Text className="text-xs text-gray-300 mt-1 text-center">{subtext}</Text>}
    </View>
  );
}

/* Ô vuông tự vẽ thay <input type="checkbox"> — dùng cho chọn nhiều món
   đang chờ xác nhận, tông đỏ khớp khối "Cần xác nhận" bên dưới. */
function PendingCheckBox({ checked }) {
  return (
    <View
      className={`items-center justify-center rounded-md ${checked ? "bg-red-500" : "bg-white border border-gray-300"}`}
      style={{ width: 18, height: 18 }}
    >
      {checked && <Check size={12} color={colors.white} />}
    </View>
  );
}

function OrderStatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || "—", bgClass: "bg-gray-100", textClass: "text-gray-500" };
  return (
    <View className={`px-2.5 py-1 rounded-full ${meta.bgClass}`}>
      <Text className={`text-[11px] font-bold ${meta.textClass}`}>{meta.label}</Text>
    </View>
  );
}

/* Ô chọn ngày, thay <input type="date"> — copy nguyên cách StoragePage.js
   đã dựng (Platform-specific behavior cho Android/iOS). */
function DateField({ label, value, onChange }) {
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
    <View style={{ flex: 1, minWidth: 130, gap: 5 }}>
      <Text className="text-[11px] font-bold text-gray-400" style={{ letterSpacing: 0.3 }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setShow(true)}
        className="bg-white border border-gray-200 rounded-xl flex-row items-center justify-between"
        style={{ paddingHorizontal: 12, paddingVertical: 10 }}
      >
        <Text className="text-sm text-gray-800">{value ? shortDate(value) : "Chọn ngày"}</Text>
        <Text style={{ fontSize: 13 }}>📅</Text>
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
        <Pressable onPress={() => setShow(false)} className="items-center bg-green-600 rounded-lg" style={{ paddingVertical: 8 }}>
          <Text className="text-white text-xs font-bold">Xong</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ── 1 bàn trong lưới sơ đồ ─────────────────────────────────────────────── */
// [PERF] React.memo + nhận callback dạng "stable" (nhận id bên trong) thay vì
// nhận thẳng closure — nhờ đó khi component cha re-render vì lý do không liên
// quan (gõ chat, gõ search...), 12 TableCard không bị buộc re-render theo vì
// props (table, onPress, onToggleActive, onOpenChat) đều giữ nguyên reference.
const TableCard = React.memo(function TableCard({ table, isSelected, onPress, onToggleActive, onOpenChat }) {
  const tSub = table.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const hasPending = table.pendingItems?.length > 0;
  const hasUnreadChat = (table.messages || []).some((m) => m.from === "guest" && !m.read);

  // Closure tạo ở đây chỉ phát sinh khi bản thân TableCard này thực sự
  // re-render (vì table/isSelected đổi) — không ảnh hưởng các TableCard khác.
  const handlePress = useCallback(() => onPress(table.id), [onPress, table.id]);
  const handleSwitchToggle = useCallback(() => onToggleActive(table.id, table.active), [onToggleActive, table.id, table.active]);
  const handleOpenChat = useCallback(() => onOpenChat(table.id), [onOpenChat, table.id]);

  return (
    <View style={{ width: "31%" }}>
      <Pressable
        onPress={handlePress}
        style={{ opacity: table.active ? 1 : 0.6 }}
        className={`rounded-2xl px-2 pt-3 pb-8 items-center border-2 ${
          isSelected
            ? "border-green-500 bg-green-50"
            : table.status === "occupied"
            ? "border-orange-200 bg-orange-50"
            : "border-gray-100 bg-white"
        }`}
      >
        {hasPending && (
          <View
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              width: 15,
              height: 15,
              borderRadius: 8,
              backgroundColor: colors.red[500],
              borderWidth: 2,
              borderColor: colors.white,
            }}
          />
        )}
        <Text style={{ fontSize: 26, opacity: table.status === "empty" ? 0.25 : 1 }}>🪑</Text>
        <Text className="font-bold text-sm text-gray-700 mt-1" numberOfLines={1}>
          {table.name}
        </Text>
        {!!table.guestName && (
          <Text className="text-[10px] text-gray-400" numberOfLines={1}>
            {table.guestName}
          </Text>
        )}
        {table.status === "occupied" ? (
          <View className="items-center mt-1">
            <Text className="text-xs font-bold text-orange-600">
              {table.items.reduce((s, i) => s + i.quantity, 0)} món
            </Text>
            <Text className="text-xs text-orange-500">{safeFmtVND(tSub)}</Text>
          </View>
        ) : (
          <Text className="text-xs text-gray-400 mt-1">Trống</Text>
        )}
        {hasPending && (
          <Text className="text-[10px] text-red-500 font-bold mt-0.5 text-center">
            {table.pendingItems.length} món chờ
          </Text>
        )}
        {!table.active && (
          <View className="flex-row items-center mt-1" style={{ gap: 3 }}>
            <Lock size={9} color={colors.gray[400]} />
            <Text className="text-[10px] font-bold text-gray-400">Chưa mở</Text>
          </View>
        )}
      </Pressable>

      {/* Toggle mở/khoá gọi món — luôn hiện trên mobile, không cần hover
          (khác bản gốc: bản gốc chỉ hiện khi hover trên desktop). */}
      <View style={{ position: "absolute", top: 2, left: -4 }}>
        <Switch
          value={!!table.active}
          onValueChange={handleSwitchToggle}
          trackColor={{ false: colors.gray[200], true: colors.green[400] }}
          thumbColor={colors.white}
          style={{ transform: [{ scaleX: 0.62 }, { scaleY: 0.62 }] }}
        />
      </View>

      {/* Nút mở chat + chấm báo tin nhắn chưa đọc — góc dưới. */}
      <Pressable
        onPress={handleOpenChat}
        style={{
          position: "absolute",
          bottom: 4,
          alignSelf: "center",
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.gray[200],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MessageCircle size={13} color={table.chatEnabled === false ? colors.gray[300] : colors.gray[500]} />
        {hasUnreadChat && (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.red[500],
              borderWidth: 1.5,
              borderColor: colors.white,
            }}
          />
        )}
      </Pressable>
    </View>
  );
});

/* ── 1 đơn lịch sử = 1 card (thay <tr> bảng gốc) ─────────────────────────── */
// [PERF] React.memo + nhận "order" (ref ổn định trong mảng orders gốc) và
// gọi onSelect(order) từ bên trong, để cha có thể truyền 1 callback duy nhất,
// ổn định (useCallback), thay vì tạo 1 arrow function mới cho từng dòng lịch sử.
const OrderHistoryCard = React.memo(function OrderHistoryCard({ order, isLast, onSelect }) {
  const handlePress = useCallback(() => onSelect(order), [onSelect, order]);
  const itemsSummary = Array.isArray(order.items)
    ? order.items.slice(0, 3).map((i) => `${i.foodName || "Món"} ×${i.quantity ?? 1}`).join(", ") +
      (order.items.length > 3 ? ` +${order.items.length - 3} món khác` : "")
    : "";
  return (
    <Pressable
      onPress={handlePress}
      style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.gray[50] }}
      className="px-4 py-3.5"
    >
      <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
        <Text className="font-mono text-xs font-bold text-gray-500" numberOfLines={1} style={{ flex: 1 }}>
          {order._id}
        </Text>
        <OrderStatusBadge status={order.status} />
      </View>
      {!!itemsSummary && (
        <Text className="text-xs text-gray-600 mt-1.5" numberOfLines={2}>
          {itemsSummary}
        </Text>
      )}
      <View className="flex-row items-end justify-between mt-2">
        <View>
          <Text className="text-[11px] text-gray-400">{order.paymentMethod} · {order.createdBy || "Admin"}</Text>
          <Text className="text-[11px] text-gray-400">{safeFmtDate(order.createdAt)}</Text>
        </View>
        <Text className="font-black text-green-600 text-sm">{safeFmtVND(order.totalAmount)}</Text>
      </View>
    </Pressable>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function OrdersPage() {
  // ── State [GIU-NGUYEN] ───────────────────────────────────────────────────
  const [tables, setTables] = useState(() => Array.from({ length: TABLE_COUNT }, (_, i) => mkEmptyTable(i + 1)));
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState("tables"); // "tables" | "history"
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPending, setSelectedPending] = useState(() => new Set());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("CASH");
  const [orders, setOrders] = useState([]);
  // [PERF] Tách "giá trị đang gõ" (histSearchInput, cập nhật ngay để ô nhập
  // không bị giật) khỏi "giá trị dùng để lọc" (histSearch, debounce 350ms) —
  // tránh chạy lại filtHist.filter() trên toàn bộ orders sau mỗi phím gõ.
  const [histSearchInput, setHistSearchInput] = useState("");
  const [histSearch, setHistSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [actionToast, setActionToast] = useState(null); // { type: "success"|"error", msg }

  // ── Chat theo bàn ────────────────────────────────────────────────────────
  const [chatOpenTableId, setChatOpenTableId] = useState(null);
  const [chatDraft, setChatDraft] = useState("");
  const [tooltips, setTooltips] = useState({}); // { [tableId]: message }
  const [clearChatConfirmOpen, setClearChatConfirmOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);

  const socketRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);
  const tooltipTimers = useRef({});
  const chatOpenTableIdRef = useRef(null);
  const actionToastTimer = useRef(null);

  useEffect(() => {
    chatOpenTableIdRef.current = chatOpenTableId;
  }, [chatOpenTableId]);

  useEffect(() => () => clearTimeout(actionToastTimer.current), []);

  const showActionToast = useCallback((type, msg) => {
    setActionToast({ type, msg });
    clearTimeout(actionToastTimer.current);
    actionToastTimer.current = setTimeout(() => setActionToast(null), ACTION_TOAST_DURATION);
  }, []);

  // ─── Lấy lịch sử đơn [GIU-NGUYEN — xem ghi chú quirk ở đầu file] ─────────
  const fetchOrders = useCallback(async () => {
    const res = await getData({ url: "/orders" });
    if (res.success) setOrders(Array.isArray(res.data) ? res.data : []);
    else console.error("[fetchOrders]", res.message);
  }, []);

  // [PERF-FIX] Bản gốc dùng `if (orders.length === 0) fetchOrders()` với
  // dependency là `orders` — nếu quán chưa có đơn nào (data thật sự rỗng),
  // fetchOrders() trả về mảng [] mới (khác reference với state cũ) khiến
  // effect này chạy lại, gọi fetchOrders() lần nữa, cứ thế lặp vô hạn.
  // Sửa: chỉ fetch đúng 1 lần khi mount, dùng ref để chặn gọi lại.
  const hasFetchedOrdersRef = useRef(false);
  useEffect(() => {
    if (hasFetchedOrdersRef.current) return;
    hasFetchedOrdersRef.current = true;
    fetchOrders();
  }, [fetchOrders]);

  // ─── Socket setup [GIU-NGUYEN] ──────────────────────────────────────────
  useEffect(() => {
    socketRef.current = socket;
    const timers = tooltipTimers.current;

    const handleConnect = () => {
      setConnected(true);
      socket.emit("join_admin");
    };
    const handleDisconnect = () => setConnected(false);

    // [PERF] Server gửi lại TOÀN BỘ danh sách bàn mỗi lần "tables_state" bắn ra,
    // kể cả khi chỉ 1 bàn thay đổi. normalizeTable() luôn tạo object mới nên
    // nếu set thẳng, cả 12 TableCard đều nhận props mới (dù nội dung y hệt) và
    // re-render dù đã bọc React.memo. Ở đây so sánh với bàn cũ theo id, giữ
    // nguyên reference nếu nội dung không đổi để memo phát huy tác dụng.
    const handleTablesState = (serverTables) => {
      if (!Array.isArray(serverTables)) {
        setTables([]);
        return;
      }
      setTables((prevTables) => {
        const prevById = new Map(prevTables.map((t) => [t.id, t]));
        return serverTables
          .map((raw) => {
            const normalized = normalizeTable(raw);
            if (!normalized) return null;
            const prev = prevById.get(normalized.id);
            if (prev && JSON.stringify(prev) === JSON.stringify(normalized)) {
              return prev; // không đổi gì → giữ reference cũ
            }
            return normalized;
          })
          .filter(Boolean);
      });
    };

    const handleChatMessage = (payload) => {
      const { tableId, message } = payload || {};
      if (!message || message.from !== "guest") return;

      if (chatOpenTableIdRef.current === tableId) {
        socket.emit("mark_chat_read", { tableId });
        return;
      }

      setTooltips((prev) => ({ ...prev, [tableId]: message }));
      clearTimeout(tooltipTimers.current[tableId]);
      tooltipTimers.current[tableId] = setTimeout(() => {
        setTooltips((prev) => {
          if (prev[tableId]?.id !== message.id) return prev;
          const next = { ...prev };
          delete next[tableId];
          return next;
        });
      }, CHAT_TOOLTIP_DURATION);
    };

    if (socket.connected) handleConnect();

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("tables_state", handleTablesState);
    socket.on("chat_message", handleChatMessage);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("tables_state", handleTablesState);
      socket.off("chat_message", handleChatMessage);
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Đổi bàn đang chọn → bỏ chọn hết checkbox món chờ xác nhận của bàn cũ
  useEffect(() => {
    setSelectedPending(new Set());
  }, [selectedId]);

  // [PERF] Debounce ô tìm kiếm lịch sử đơn — chỉ cập nhật giá trị dùng để lọc
  // 350ms sau khi người dùng ngừng gõ, thay vì lọc lại toàn bộ `orders` ở
  // mỗi ký tự.
  useEffect(() => {
    const t = setTimeout(() => setHistSearch(histSearchInput), 350);
    return () => clearTimeout(t);
  }, [histSearchInput]);

  // Mở hộp thoại chat → cuộn xuống cuối + focus ô nhập. RN không có
  // scrollTop, dùng ref.scrollToEnd — xem ghi chú platform ở đầu file.
  useEffect(() => {
    if (chatOpenTableId == null) return;
    chatScrollRef.current?.scrollToEnd({ animated: false });
    const t = setTimeout(() => chatInputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [chatOpenTableId]);

  // ─── Derived values [GIU-NGUYEN] ────────────────────────────────────────
  const activeTable = selectedId != null ? tables.find((t) => t.id === selectedId) : null;
  const chatTable = chatOpenTableId != null ? tables.find((t) => t.id === chatOpenTableId) : null;
  const subtotal = activeTable?.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) ?? 0;
  const pendingSubtotal = activeTable?.pendingItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) ?? 0;
  const occupiedCount = tables.filter((t) => t.status === "occupied").length;

  const chatModalTitle = chatTable
    ? [chatTable.name, chatTable.guestName, chatTable.guestPhone].filter(Boolean).join(" - ")
    : "";

  // Tự cuộn xuống mỗi khi có tin nhắn mới trong bàn đang mở chat
  useEffect(() => {
    chatScrollRef.current?.scrollToEnd({ animated: true });
  }, [chatTable?.messages?.length]);

  // ─── Xác nhận món đang chờ & gửi bếp ────────────────────────────────────
  const togglePending = useCallback((itemId) => {
    setSelectedPending((prev) => {
      const next = new Set(prev);
      const key = String(itemId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAllPending = useCallback(() => {
    if (!activeTable) return;
    setSelectedPending((prev) =>
      prev.size === activeTable.pendingItems.length ? new Set() : new Set(activeTable.pendingItems.map((i) => String(i.id)))
    );
  }, [activeTable]);

  const confirmItems = useCallback(
    (pendingItemIds) => {
      if (!activeTable || !socketRef.current || pendingItemIds.length === 0) return;
      setConfirmLoading(true);
      socketRef.current.emit("confirm_items", { tableId: activeTable.id, pendingItemIds });
      setSelectedPending(new Set());
      showActionToast("success", `Đã xác nhận & gửi bếp cho ${activeTable.name}`);
      setTimeout(() => setConfirmLoading(false), 300);
    },
    [activeTable, showActionToast]
  );

  // [PERF] Chọn/bỏ chọn bàn — dùng functional update để KHÔNG cần phụ thuộc
  // `selectedId`, nhờ đó callback này giữ nguyên reference qua mọi render và
  // có thể truyền thẳng xuống từng TableCard đã bọc React.memo.
  const handleSelectTable = useCallback((tableId) => {
    setSelectedId((prev) => (prev === tableId ? null : tableId));
  }, []);

  // ─── Bật/tắt cho phép khách gọi món / gửi tin nhắn tại 1 bàn ────────────
  // [PERF] Nhận (tableId, currentActive) thay vì cả object "table" để callback
  // này hoàn toàn không phụ thuộc `tables` — giữ được identity ổn định qua mọi
  // render, cho phép truyền thẳng xuống TableCard mà không cần bọc arrow mới.
  const handleToggleActive = useCallback((tableId, currentActive) => {
    if (!socketRef.current) return;
    socketRef.current.emit("toggle_table_active", { tableId, active: !currentActive });
  }, []);
  const handleToggleChat = useCallback((table) => {
    if (!socketRef.current) return;
    const currentlyEnabled = table.chatEnabled !== false;
    socketRef.current.emit("toggle_table_chat", { tableId: table.id, chatEnabled: !currentlyEnabled });
  }, []);

  // ─── Chat theo bàn ───────────────────────────────────────────────────────
  const openChat = useCallback((tableId) => {
    setChatOpenTableId(tableId);
    setTooltips((prev) => {
      if (!(tableId in prev)) return prev;
      const next = { ...prev };
      delete next[tableId];
      return next;
    });
    clearTimeout(tooltipTimers.current[tableId]);
    socketRef.current?.emit("mark_chat_read", { tableId });
  }, []);
  const closeChat = useCallback(() => {
    setChatOpenTableId(null);
    setChatDraft("");
    setClearChatConfirmOpen(false);
  }, []);
  const sendChatReply = useCallback(() => {
    const value = chatDraft.trim();
    if (!value || chatOpenTableId == null || !socketRef.current) return;
    socketRef.current.emit("send_admin_chat_message", { tableId: chatOpenTableId, text: value });
    setChatDraft("");
  }, [chatDraft, chatOpenTableId]);
  const clearChatHistory = useCallback(() => {
    if (chatOpenTableId == null || !socketRef.current) return;
    socketRef.current.emit("clear_chat_messages", { tableId: chatOpenTableId });
    setClearChatConfirmOpen(false);
  }, [chatOpenTableId]);

  // ─── Thanh toán [GIU-NGUYEN logic — chỉ đổi fetch() → postData()] ───────
  const handleCheckout = useCallback(async () => {
    if (!activeTable || !activeTable.items.length) return;
    setCheckoutLoading(true);

    const mergedForOrder = new Map();
    activeTable.items.forEach((i) => {
      const noteKey = i.note || "";
      const key = `${i.foodId}::${noteKey}`;
      const existing = mergedForOrder.get(key);
      if (existing) existing.quantity += i.quantity;
      else mergedForOrder.set(key, { foodId: i.foodId, note: noteKey, quantity: i.quantity });
    });

    const payload = {
      items: Array.from(mergedForOrder.values()),
      discountAmount: 0,
      paymentMethod: payMethod,
      isPaid: true,
      note: "",
      createdBy: "Admin", // thay bằng userId khi có auth #fix — [GIU-NGUYEN], y hệt bản gốc
    };

    try {
      const res = await postData({ url: "/orders", data: payload });
      if (!res.success) throw new Error(res.message || `Lỗi lưu đơn (HTTP ${res.status})`);
      const saved = res.data;

      setOrders((p) => [saved.order, ...p]);
      socketRef.current?.emit("checkout_table", { tableId: activeTable.id });

      setCheckoutOpen(false);
      setSelectedId(null);
      showActionToast("success", `Thanh toán ${activeTable.name} thành công! 🎉`);
    } catch (err) {
      console.error("[Checkout]", err);
      showActionToast("error", `Thanh toán thất bại: ${err.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  }, [activeTable, payMethod, showActionToast]);

  // [PERF] Callback ổn định cho OrderHistoryCard (React.memo) — tránh tạo 1
  // arrow function mới cho mỗi dòng lịch sử ở mỗi lần render danh sách.
  const handleOpenOrderDetail = useCallback((order) => setDetailOrder(order), []);

  // ─── Lịch sử đơn — lọc [GIU-NGUYEN] ─────────────────────────────────────
  const filtHist = useMemo(() => {
    return orders.filter((o) => {
      const keyword = histSearch.trim().toLowerCase();
      const matchSearch =
        !keyword ||
        o._id?.toLowerCase().includes(keyword) ||
        o.items?.some((i) => i.foodName?.toLowerCase().includes(keyword)) ||
        o.createdBy?.toLowerCase().includes(keyword);

      const matchStatus = !statusFilter || o.status === statusFilter;
      const matchPayment = !paymentFilter || o.paymentMethod === paymentFilter;

      const createdDate = new Date(o.createdAt);
      const matchDateFrom = !dateFrom || createdDate >= new Date(dateFrom);
      const matchDateTo = !dateTo || createdDate <= new Date(dateTo + "T23:59:59");

      const amount = Number(o.totalAmount || 0);
      const matchMinAmount = !minAmount || amount >= Number(minAmount);
      const matchMaxAmount = !maxAmount || amount <= Number(maxAmount);

      return matchSearch && matchStatus && matchPayment && matchDateFrom && matchDateTo && matchMinAmount && matchMaxAmount;
    });
  }, [orders, histSearch, statusFilter, paymentFilter, dateFrom, dateTo, minAmount, maxAmount]);

  // ─── Nội dung chi tiết bàn — dùng chung cho Modal (RN chỉ có 1 biến thể,
  // xem ghi chú platform ở đầu file) ───────────────────────────────────────
  const renderTableDetailBody = () => {
    if (!activeTable) return null;
    return (
      <>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 14 }}>
          {!!activeTable.since && (
            <Text className="text-xs text-gray-400">
              {safeFmtDate(activeTable.since instanceof Date ? activeTable.since.toISOString() : activeTable.since)}
            </Text>
          )}

          {/* Món chờ xác nhận */}
          {activeTable.pendingItems.length > 0 && (
            <View className="rounded-xl border-2 border-red-200 bg-red-50 p-3" style={{ gap: 10 }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 5 }}>
                  <Bell size={13} color={colors.red[600]} />
                  <Text className="text-xs font-bold text-red-600 uppercase" style={{ letterSpacing: 0.4 }}>
                    Cần xác nhận
                  </Text>
                </View>
                <Pressable onPress={toggleSelectAllPending}>
                  <Text className="text-[11px] font-semibold text-red-500">
                    {selectedPending.size === activeTable.pendingItems.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </Text>
                </Pressable>
              </View>

              <View style={{ gap: 6 }}>
                {activeTable.pendingItems.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => togglePending(item.id)}
                    className="flex-row items-center bg-white rounded-lg p-2"
                    style={{ gap: 12 }}
                  >
                    <PendingCheckBox checked={selectedPending.has(String(item.id))} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text className="text-xs font-bold text-gray-700" numberOfLines={1}>
                        {item.foodName}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {safeFmtVND(item.unitPrice)} × {item.quantity}
                      </Text>
                      {!!item.note && <Text className="text-xs text-gray-500 mt-0.5">{item.note}</Text>}
                    </View>
                  </Pressable>
                ))}
              </View>

              <ActionBtn
                icon={Check}
                label={`Xác nhận đã chọn (${selectedPending.size}) & gửi bếp`}
                variant="danger"
                flex
                disabled={selectedPending.size === 0}
                loading={confirmLoading}
                onPress={() => confirmItems(Array.from(selectedPending))}
              />
              {activeTable.pendingItems.length > 1 && (
                <Pressable disabled={confirmLoading} onPress={() => confirmItems(activeTable.pendingItems.map((i) => String(i.id)))}>
                  <Text className="text-center text-xs font-semibold text-red-500">
                    Xác nhận tất cả ({activeTable.pendingItems.length} món)
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Món đã xác nhận */}
          {activeTable.items.length === 0 && activeTable.pendingItems.length === 0 ? (
            <EmptyState icon={ChefHat} text="Chưa có món nào" subtext="Khách gọi món sẽ hiện tại đây" />
          ) : (
            activeTable.items.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text className="text-xs text-gray-400 font-bold uppercase" style={{ letterSpacing: 0.4 }}>
                  Đã xác nhận
                </Text>
                {activeTable.items.map((item, idx) => (
                  <View key={item.id || idx} className="flex-row items-center bg-gray-50 rounded-xl p-3.5" style={{ gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text className="text-xs font-bold text-gray-700" numberOfLines={1}>
                        {item.foodName}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {safeFmtVND(item.unitPrice)} × {item.quantity}
                      </Text>
                      {!!item.note && <Text className="text-[11px] text-gray-400 mt-0.5">{item.note}</Text>}
                    </View>
                    {item.status === "ready" ? (
                      <View className="flex-row items-center bg-green-100 rounded-full px-2 py-1" style={{ gap: 4 }}>
                        <CheckCircle2 size={12} color={colors.green[600]} />
                        <Text className="text-[11px] font-bold text-green-600">Sẵn sàng</Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center bg-orange-100 rounded-full px-2 py-1" style={{ gap: 4 }}>
                        <Flame size={12} color="#ea580c" />
                        <Text className="text-[11px] font-bold text-orange-600">Đang nấu</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )
          )}
        </ScrollView>

        {/* Tổng & Thanh toán */}
        <View className="p-4 border-t border-gray-100 bg-green-50/50" style={{ gap: 4 }}>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-bold text-gray-700">Tổng cộng</Text>
            <Text className="text-xl font-black text-green-600">{safeFmtVND(subtotal)}</Text>
          </View>
          {pendingSubtotal > 0 && (
            <Text className="text-xs text-red-500 text-right">+ {safeFmtVND(pendingSubtotal)} đang chờ xác nhận</Text>
          )}
          <ActionBtn
            icon={Check}
            label="Thanh toán"
            variant="primary"
            disabled={!activeTable.items.length || activeTable.pendingItems.length > 0}
            onPress={() => setCheckoutOpen(true)}
          />
          {activeTable.pendingItems.length > 0 && (
            <Text className="text-[11px] text-center text-gray-400">Xác nhận hết món đang chờ trước khi thanh toán</Text>
          )}
        </View>
      </>
    );
  };

  // ──────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, position: "relative" }} className="bg-gray-50">
      {/* ── Toast tin nhắn mới từ khách — mép trên, xếp chồng theo bàn ────── */}
      {Object.keys(tooltips).length > 0 && (
        <View style={{ position: "absolute", top: 10, left: 12, right: 12, zIndex: 50, gap: 8 }} pointerEvents="box-none">
          {Object.entries(tooltips).map(([tableIdKey, msg]) => {
            const tableId = Number(tableIdKey);
            const t = tables.find((tb) => tb.id === tableId);
            return (
              <Animated.View key={tableIdKey} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(180)}>
                <Pressable onPress={() => openChat(tableId)} className="bg-white border border-green-200 rounded-xl shadow-lg px-3.5 py-2.5">
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <MessageCircle size={11} color={colors.green[600]} />
                    <Text className="text-[11px] font-bold text-green-600">{t?.name || `Bàn ${tableId}`} nhắn tin</Text>
                  </View>
                  <Text className="text-xs text-gray-700 mt-0.5" numberOfLines={2}>
                    {msg.text}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* ── Toast kết quả thao tác (thanh toán, xác nhận món...) ──────────── */}
      {!!actionToast && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOutDown.duration(300)}
          style={{ position: "absolute", left: 0, right: 0, bottom: 20, alignItems: "center", zIndex: 50 }}
        >
          <View className={`px-5 py-2.5 rounded-full ${actionToast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
            <Text className="text-white text-[13px] font-bold">{actionToast.msg}</Text>
          </View>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View>
          <Text className="text-2xl font-black text-green-900">Quản lý Order</Text>
          <View className="flex-row items-center flex-wrap mt-1" style={{ gap: 8 }}>
            <Text className="text-gray-500 text-sm">
              {occupiedCount}/{TABLE_COUNT} bàn đang có khách
            </Text>
            <View className={`flex-row items-center rounded-full px-2 py-0.5 ${connected ? "bg-green-100" : "bg-red-100"}`} style={{ gap: 4 }}>
              {connected ? <Wifi size={11} color={colors.green[700]} /> : <WifiOff size={11} color={colors.red[600]} />}
              <Text className={`text-xs font-semibold ${connected ? "text-green-700" : "text-red-600"}`}>
                {connected ? "Real-time" : "Mất kết nối"}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Tab: Sơ đồ bàn / Lịch sử đơn ─────────────────────────────────── */}
        <View className="flex-row" style={{ gap: 8 }}>
          {[["tables", "Sơ đồ bàn"], ["history", "Lịch sử đơn"]].map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} className={`px-4 py-2 rounded-xl ${tab === k ? "bg-green-500" : "bg-white border border-gray-200"}`}>
              <Text className={`text-sm font-bold ${tab === k ? "text-white" : "text-gray-600"}`}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "tables" ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {tables.map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  isSelected={t.id === selectedId}
                  onPress={handleSelectTable}
                  onToggleActive={handleToggleActive}
                  onOpenChat={openChat}
                />
              ))}
            </View>

            {/* Chú thích */}
            <View className="bg-white rounded-xl px-4 py-3 border border-gray-100" style={{ gap: 6 }}>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <View className="rounded" style={{ width: 10, height: 10, borderWidth: 2, borderColor: colors.gray[200] }} />
                <Text className="text-xs text-gray-500">Trống</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <View className="rounded" style={{ width: 10, height: 10, borderWidth: 2, borderColor: "#fed7aa", backgroundColor: "#fff7ed" }} />
                <Text className="text-xs text-gray-500">Có khách</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <View className="rounded" style={{ width: 10, height: 10, borderWidth: 2, borderColor: colors.green[500], backgroundColor: colors.green[50] }} />
                <Text className="text-xs text-gray-500">Đang chọn</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red[500] }} />
                <Text className="text-xs text-gray-500">Có món chờ xác nhận / tin nhắn chưa đọc</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Lock size={11} color={colors.gray[400]} />
                <Text className="text-xs text-gray-500">Chưa mở gọi món — bấm nút gạt góc trái bàn để bật</Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <MessageCircle size={11} color={colors.gray[400]} />
                <Text className="text-xs text-gray-500">Chat với bàn — nút tròn dưới mỗi bàn</Text>
              </View>
            </View>
          </View>
        ) : (
          /* ── Tab: Lịch sử đơn ────────────────────────────────────────────── */
          <View style={{ gap: 12 }}>
            <View className="bg-white rounded-2xl p-4 border border-gray-100" style={{ gap: 12 }}>
              <View style={{ position: "relative", justifyContent: "center" }}>
                <View style={{ position: "absolute", left: 14, zIndex: 1 }}>
                  <Search size={15} color={colors.gray[400]} />
                </View>
                <TextInput
                  value={histSearchInput}
                  onChangeText={setHistSearchInput}
                  placeholder="Tìm theo mã đơn, tên món..."
                  placeholderTextColor={colors.gray[300]}
                  className="bg-white border border-gray-200 rounded-xl text-sm text-gray-800"
                  style={{ paddingLeft: 38, paddingRight: 16, paddingVertical: 11 }}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {STATUS_FILTER_OPTIONS.map(([val, label]) => (
                  <Pressable
                    key={val || "all"}
                    onPress={() => setStatusFilter(val)}
                    className={`px-3.5 py-2 rounded-xl ${statusFilter === val ? "bg-green-500" : "bg-gray-50 border border-gray-200"}`}
                  >
                    <Text className={`text-xs font-bold ${statusFilter === val ? "text-white" : "text-gray-600"}`}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {PAYMENT_FILTER_OPTIONS.map(([val, label]) => (
                  <Pressable
                    key={val || "all"}
                    onPress={() => setPaymentFilter(val)}
                    className={`px-3.5 py-2 rounded-xl ${paymentFilter === val ? "bg-green-500" : "bg-gray-50 border border-gray-200"}`}
                  >
                    <Text className={`text-xs font-bold ${paymentFilter === val ? "text-white" : "text-gray-600"}`}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View className="flex-row" style={{ gap: 10 }}>
                <DateField label="TỪ NGÀY" value={dateFrom} onChange={setDateFrom} />
                <DateField label="ĐẾN NGÀY" value={dateTo} onChange={setDateTo} />
              </View>

              <View className="flex-row" style={{ gap: 10 }}>
                <TextInput
                  value={minAmount}
                  onChangeText={setMinAmount}
                  keyboardType="numeric"
                  placeholder="Tiền từ"
                  placeholderTextColor={colors.gray[300]}
                  className="flex-1 bg-white border border-gray-200 rounded-xl text-sm text-gray-800"
                  style={{ paddingHorizontal: 14, paddingVertical: 11 }}
                />
                <TextInput
                  value={maxAmount}
                  onChangeText={setMaxAmount}
                  keyboardType="numeric"
                  placeholder="Tiền đến"
                  placeholderTextColor={colors.gray[300]}
                  className="flex-1 bg-white border border-gray-200 rounded-xl text-sm text-gray-800"
                  style={{ paddingHorizontal: 14, paddingVertical: 11 }}
                />
              </View>
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {filtHist.length === 0 ? (
                <EmptyState icon={Search} text="Không có đơn nào phù hợp" />
              ) : (
                filtHist.slice(0, 50).map((ord, idx) => (
                  <OrderHistoryCard
                    key={ord._id}
                    order={ord}
                    isLast={idx === Math.min(filtHist.length, 50) - 1}
                    onSelect={handleOpenOrderDetail}
                  />
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Modal chi tiết bàn (thay panel cố định lg+ / Modal mobile gốc —
          RN chỉ giữ 1 biến thể Modal, xem ghi chú platform ở đầu file) ──── */}
      {!!activeTable && (
        <ModalOverlay onClose={() => setSelectedId(null)}>
          <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "80%" }}>
            <ModalHeader
              title={[activeTable.name, activeTable.guestName, activeTable.guestPhone].filter(Boolean).join(" - ")}
              onClose={() => setSelectedId(null)}
            />
            {renderTableDetailBody()}
          </View>
        </ModalOverlay>
      )}

      {/* ── Modal thanh toán ─────────────────────────────────────────────── */}
      {checkoutOpen && !!activeTable && (
        <ModalOverlay onClose={() => setCheckoutOpen(false)}>
          <View className="bg-white rounded-3xl overflow-hidden">
            <ModalHeader title={`Thanh toán — ${activeTable.name}`} onClose={() => setCheckoutOpen(false)} />
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} style={{ maxHeight: 480 }}>
              <View className="bg-green-50 rounded-xl p-4" style={{ gap: 8 }}>
                {activeTable.items.map((item, idx) => (
                  <View key={`${item.foodId}-${idx}`} className="flex-row justify-between">
                    <View style={{ flex: 1 }}>
                      <Text className="text-sm text-gray-700">
                        {item.foodName} × {item.quantity}
                      </Text>
                      {!!item.note && <Text className="text-[11px] text-gray-400">{item.note}</Text>}
                    </View>
                    <Text className="text-sm font-semibold">{safeFmtVND(item.unitPrice * item.quantity)}</Text>
                  </View>
                ))}
                <View className="flex-row justify-between items-center border-t border-green-200 pt-2 mt-1">
                  <Text className="font-bold text-gray-700">Tổng cộng</Text>
                  <Text className="font-black text-lg text-green-600">{safeFmtVND(subtotal)}</Text>
                </View>
              </View>

              <View>
                <Text className="text-xs font-bold text-gray-500 uppercase mb-3">Phương thức thanh toán</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {PAYMENT_OPTIONS.map(([m, l]) => (
                    <Pressable
                      key={m}
                      onPress={() => setPayMethod(m)}
                      style={{ width: "47%" }}
                      className={`py-3 rounded-xl items-center border-2 ${payMethod === m ? "border-green-500 bg-green-50" : "border-gray-200"}`}
                    >
                      <Text className={`text-sm font-bold ${payMethod === m ? "text-green-700" : "text-gray-600"}`}>{l}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="flex-row" style={{ gap: 8 }}>
                <ActionBtn label="Hủy" variant="secondary" flex onPress={() => setCheckoutOpen(false)} />
                <ActionBtn
                  icon={Check}
                  label={checkoutLoading ? "Đang xử lý…" : "Xác nhận thanh toán"}
                  variant="primary"
                  flex
                  loading={checkoutLoading}
                  disabled={checkoutLoading}
                  onPress={handleCheckout}
                />
              </View>
            </ScrollView>
          </View>
        </ModalOverlay>
      )}

      {/* ── Modal chat theo bàn ──────────────────────────────────────────── */}
      {!!chatTable && (
        <ModalOverlay onClose={closeChat}>
          <View className="bg-white rounded-3xl overflow-hidden" style={{ height: 460 }}>
            <ModalHeader title={chatModalTitle} onClose={closeChat} />
            {chatTable.messages?.length > 0 && (
              <View className="flex-row justify-end px-4 pt-2">
                <Pressable onPress={() => setClearChatConfirmOpen(true)} className="flex-row items-center" style={{ gap: 4 }}>
                  <Trash2 size={13} color={colors.gray[400]} />
                  <Text className="text-xs font-semibold text-gray-400">Xoá lịch sử</Text>
                </Pressable>
              </View>
            )}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <ScrollView ref={chatScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
                {(!chatTable.messages || chatTable.messages.length === 0) ? (
                  <Text className="text-gray-400 text-xs text-center" style={{ paddingVertical: 40 }}>
                    Chưa có tin nhắn nào với {chatTable.name}
                  </Text>
                ) : (
                  chatTable.messages.map((m, idx) => (
                    <View key={m.id || idx} style={{ flexDirection: "row", justifyContent: m.from === "admin" ? "flex-end" : "flex-start" }}>
                      <View
                        style={{ maxWidth: "75%" }}
                        className={`rounded-2xl px-3.5 py-2.5 ${m.from === "admin" ? "bg-green-500 rounded-br-md" : "bg-gray-100 rounded-bl-md"}`}
                      >
                        <Text className={`text-sm ${m.from === "admin" ? "text-white" : "text-gray-700"}`} style={{ lineHeight: 20 }}>
                          {m.text}
                        </Text>
                        <Text className={`text-[10px] mt-1 ${m.from === "admin" ? "text-green-100" : "text-gray-400"}`}>
                          {safeFmtDate(m.at instanceof Date ? m.at.toISOString() : m.at)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
              <View className="flex-row items-center border-t border-gray-100" style={{ gap: 8, padding: 12 }}>
                <TextInput
                  ref={chatInputRef}
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  onSubmitEditing={sendChatReply}
                  placeholder="Nhập tin nhắn trả lời..."
                  placeholderTextColor={colors.gray[300]}
                  className="flex-1 border border-gray-200 rounded-full text-sm text-gray-800"
                  style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                />
                <Pressable
                  onPress={sendChatReply}
                  disabled={!chatDraft.trim()}
                  style={{ opacity: chatDraft.trim() ? 1 : 0.4 }}
                  className="w-10 h-10 rounded-full bg-green-500 items-center justify-center"
                >
                  <Send size={16} color={colors.white} />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </ModalOverlay>
      )}

      {/* ── Modal xác nhận xoá lịch sử chat ──────────────────────────────── */}
      {clearChatConfirmOpen && (
        <ModalOverlay onClose={() => setClearChatConfirmOpen(false)}>
          <View className="bg-white rounded-3xl overflow-hidden">
            <ModalHeader title="Xoá lịch sử tin nhắn?" />
            <View style={{ padding: 20, gap: 16 }}>
              <Text className="text-sm text-gray-600" style={{ lineHeight: 20 }}>
                Toàn bộ tin nhắn giữa admin và{" "}
                <Text style={{ fontWeight: "800", color: colors.gray[800] }}>{chatTable?.name}</Text> sẽ bị xoá vĩnh viễn.
                Bạn có chắc chắn không?
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <ActionBtn label="Huỷ" variant="secondary" flex onPress={() => setClearChatConfirmOpen(false)} />
                <ActionBtn icon={Trash2} label="Xoá" variant="danger" flex onPress={clearChatHistory} />
              </View>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ── Modal chi tiết đơn (từ tab lịch sử) ──────────────────────────── */}
      {!!detailOrder && (
        <ModalOverlay onClose={() => setDetailOrder(null)}>
          <View className="bg-white rounded-3xl overflow-hidden">
            <ModalHeader title={detailOrder._id} onClose={() => setDetailOrder(null)} />
            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} style={{ maxHeight: 480 }}>
              <View className="flex-row items-center justify-between">
                <OrderStatusBadge status={detailOrder.status} />
                <Text className="text-xs text-gray-400">{safeFmtDate(detailOrder.createdAt)}</Text>
              </View>
              <View className="bg-gray-50 rounded-xl p-3" style={{ gap: 4 }}>
                {(detailOrder.items || []).map((item, idx) => (
                  <View key={idx} className="flex-row justify-between">
                    <Text className="text-sm text-gray-700">
                      {item.foodName} × {item.quantity}
                    </Text>
                    <Text className="text-sm font-semibold text-gray-600">{safeFmtVND(item.unitPrice * item.quantity)}</Text>
                  </View>
                ))}
              </View>
              <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                <Text className="text-xs text-gray-400">{detailOrder.paymentMethod} · {detailOrder.createdBy || "Admin"}</Text>
                <Text className="font-black text-lg text-green-600">{safeFmtVND(detailOrder.totalAmount)}</Text>
              </View>
            </ScrollView>
          </View>
        </ModalOverlay>
      )}
    </View>
  );
}