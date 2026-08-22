import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import {
    ArrowRight,
    Bell,
    Check,
    MapPin,
    MessageCircle,
    Phone,
    Search,
    Send,
    ShoppingBag,
    Wifi,
    WifiOff,
    X,
    XCircle,
} from "lucide-react-native";
import socket from "../utils/socket";
import fmtVND from "../utils/fmtVND";
import fmtDate from "../utils/fmtDate";
import { postData } from "../utils/callAPI";
import colors from "../theme/tokens";

// ─── Hằng số [GIU-NGUYEN] ───────────────────────────────────────────────────
const NEW_ORDER_TOAST_DURATION = 6000; // mỗi toast đơn mới tự ẩn sau 6s (độc lập với các toast khác)
const MAX_VISIBLE_ORDER_TOASTS = 3; // đơn mới về liên tiếp — chỉ hiện tối đa 3 toast, dư ra gộp vào dòng tổng
const NEW_CHAT_TOAST_DURATION = 6000; // toast tin nhắn mới tự ẩn sau 6s
const ACTION_TOAST_DURATION = 3500; // toast kết quả thao tác (thanh toán...) tự ẩn sau 3.5s

const PAYMENT_OPTIONS = [
    ["CASH", "💵 Tiền mặt"],
    ["BANKING", "🏦 Chuyển khoản"],
    ["MOMO", "🟣 MoMo"],
    ["ZALOPAY", "🔵 ZaloPay"],
];

const ACTIVE_COLUMNS = [
    { status: "pending", label: "Chờ xác nhận" },
    { status: "confirmed", label: "Đã xác nhận" },
    { status: "preparing", label: "Đang làm" },
    { status: "delivering", label: "Đang giao" },
];

// Trạng thái kế tiếp + nhãn nút hành động cho từng trạng thái hiện tại. [GIU-NGUYEN]
const NEXT_STATUS = { pending: "confirmed", confirmed: "preparing", preparing: "delivering", delivering: "completed" };
const NEXT_LABEL = { pending: "Xác nhận", confirmed: "Bắt đầu làm", preparing: "Giao hàng", delivering: "Hoàn thành" };

const STATUS_META = {
    pending: { label: "Chờ xác nhận", bgClass: "bg-orange-100", textClass: "text-orange-600" },
    confirmed: { label: "Đã xác nhận", bgClass: "bg-blue-100", textClass: "text-blue-600" },
    preparing: { label: "Đang làm", bgClass: "bg-purple-100", textClass: "text-purple-600" },
    delivering: { label: "Đang giao", bgClass: "bg-cyan-100", textClass: "text-cyan-600" },
    completed: { label: "Hoàn thành", bgClass: "bg-green-100", textClass: "text-green-600" },
    cancelled: { label: "Đã huỷ", bgClass: "bg-red-100", textClass: "text-red-600" },
};

function OnlineStatusBadge({ status }) {
    const meta = STATUS_META[status] || STATUS_META.pending;
    return (
        <View className={`px-2.5 py-1 rounded-full ${meta.bgClass}`}>
            <Text className={`text-[11px] font-bold ${meta.textClass}`}>{meta.label}</Text>
        </View>
    );
}

// Rút gọn customerId (UUID dài) để hiện tạm khi chưa biết tên khách. [GIU-NGUYEN]
function shortCustomerLabel(customerId) {
    return `Khách #${(customerId || "").slice(0, 8)}`;
}

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

// ─── Chuẩn hoá dữ liệu từ server [GIU-NGUYEN, thuần JS, không đụng DOM] ────
function normalizeOnlineOrder(raw) {
    if (!raw || typeof raw !== "object") return null;
    const items = Array.isArray(raw.items)
        ? raw.items.map((i) => ({
            foodId: i?.foodId ?? null,
            foodName: i?.foodName ?? "Món (không rõ tên)",
            quantity: Number(i?.quantity) || 0,
            unitPrice: Number(i?.unitPrice) || 0,
        }))
        : [];
    return {
        id: raw.id ?? raw._id ?? "",
        customerId: raw.customerId ?? null,
        status: raw.status ?? "pending",
        customerName: raw.customerName || "Khách hàng",
        phone: raw.phone ?? "",
        address: raw.address ?? "",
        note: raw.note ?? "",
        items,
        totalPrice: Number(raw.totalPrice) || 0,
        createdAt: raw.createdAt ?? null,
        completedAt: raw.completedAt ?? null,
        cancelReason: raw.cancelReason ?? "",
    };
}
function normalizeChatThread(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
        customerId: raw.customerId ?? null,
        customerName: raw.customerName ?? "",
        phone: raw.phone ?? "",
        lastMessage: raw.lastMessage ?? "",
        lastAt: raw.lastAt ?? null,
        unreadCount: Number(raw.unreadCount) || 0,
    };
}
function normalizeChatMessage(raw) {
    if (!raw || typeof raw !== "object") return null;
    return {
        id: raw.id ?? null,
        from: raw.from === "admin" ? "admin" : "customer",
        text: raw.text ?? "",
        at: raw.at ?? null,
    };
}

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ (thay Button/Modal dùng chung ở bản web)
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
                <Pressable onPress={() => { }} style={{ width: "100%", maxWidth: 440 }}>
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

function EmptyState({ icon: Icon, text }) {
    return (
        <View className="items-center py-14 px-6">
            <Icon size={32} color={colors.gray[300]} style={{ opacity: 0.6 }} />
            <Text className="text-sm text-gray-300 font-bold mt-2 text-center">{text}</Text>
        </View>
    );
}

/* ── 1 đơn đang xử lý = 1 card ───────────────────────────────────────────── */
function OrderCard({ order, onCancel, onAdvance }) {
    return (
        <View className="bg-white rounded-2xl border border-gray-100 p-3.5" style={{ gap: 10 }}>
            <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text className="font-bold text-sm text-gray-800" numberOfLines={1}>{order.customerName}</Text>
                    <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                        <Phone size={10} color={colors.gray[400]} />
                        <Text className="text-[11px] text-gray-400">{order.phone}</Text>
                    </View>
                </View>
                <Text className="text-[10px] text-gray-400">{safeFmtDate(order.createdAt)}</Text>
            </View>

            <View className="flex-row items-start" style={{ gap: 4 }}>
                <MapPin size={10} color={colors.gray[400]} style={{ marginTop: 2 }} />
                <Text className="text-[11px] text-gray-400" style={{ flex: 1 }}>{order.address}</Text>
            </View>

            <View className="bg-gray-50 rounded-lg p-2.5" style={{ gap: 4 }}>
                {order.items.map((item, idx) => (
                    <View key={idx} className="flex-row justify-between">
                        <Text className="text-xs text-gray-700" numberOfLines={1} style={{ flex: 1 }}>
                            {item.foodName} × {item.quantity}
                        </Text>
                    </View>
                ))}
                {!!order.note && (
                    <Text className="text-[10px] text-gray-400 pt-1 mt-1 border-t border-gray-200">Ghi chú: {order.note}</Text>
                )}
            </View>

            <Text className="font-black text-sm text-green-600">{safeFmtVND(order.totalPrice)}</Text>

            <View className="flex-row" style={{ gap: 6 }}>
                <Pressable
                    onPress={() => onCancel(order)}
                    className="w-9 h-9 items-center justify-center rounded-lg border border-red-200"
                >
                    <XCircle size={14} color={colors.red[500]} />
                </Pressable>
                <ActionBtn icon={ArrowRight} label={NEXT_LABEL[order.status]} onPress={() => onAdvance(order)} variant="primary" flex />
            </View>
        </View>
    );
}

/* ── 1 đơn lịch sử = 1 card (thay cho <tr> bảng gốc, dùng cho mọi kích cỡ
   màn hình — xem ghi chú platform ở đầu file) ──────────────────────────── */
function OrderHistoryCard({ order, isLast, onPress }) {
    return (
        <Pressable
            onPress={onPress}
            style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.gray[50] }}
            className="px-4 py-3.5 flex-row items-center justify-between"
        >
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="font-semibold text-gray-700 text-sm" numberOfLines={1}>{order.customerName}</Text>
                <Text className="text-xs text-gray-400">{order.phone}</Text>
                <Text className="text-[11px] text-gray-400 mt-0.5">{order.items.length} món · {safeFmtDate(order.createdAt)}</Text>
            </View>
            <View className="items-end" style={{ gap: 4, marginLeft: 10 }}>
                <Text className="font-bold text-green-600 text-sm">{safeFmtVND(order.totalPrice)}</Text>
                <OnlineStatusBadge status={order.status} />
            </View>
        </Pressable>
    );
}

/* ── 1 hội thoại = 1 hàng trong tab Tin nhắn ─────────────────────────────── */
function ChatThreadRow({ thread, active, onPress, isLast }) {
    return (
        <Pressable
            onPress={onPress}
            style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.gray[50] }}
            className={`px-4 py-3.5 flex-row items-center ${active ? "bg-green-50" : ""}`}
        >
            <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center" style={{ marginRight: 12 }}>
                <Text className="text-green-700 font-bold">{(thread.customerName || "?").charAt(0).toUpperCase() || "?"}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="font-bold text-sm text-gray-800" numberOfLines={1}>
                    {thread.customerName || shortCustomerLabel(thread.customerId)}
                </Text>
                {!!thread.phone && (
                    <View className="flex-row items-center" style={{ gap: 4 }}>
                        <Phone size={9} color={colors.gray[400]} />
                        <Text className="text-[11px] text-gray-400" numberOfLines={1}>{thread.phone}</Text>
                    </View>
                )}
                <Text className="text-xs text-gray-400" numberOfLines={1}>{thread.lastMessage}</Text>
            </View>
            <View className="items-end" style={{ gap: 4, marginLeft: 8 }}>
                <Text className="text-[10px] text-gray-400">{safeFmtDate(thread.lastAt)}</Text>
                {thread.unreadCount > 0 && (
                    <View className="bg-red-500 rounded-full items-center justify-center" style={{ minWidth: 18, height: 18, paddingHorizontal: 4 }}>
                        <Text className="text-white text-[10px] font-bold">{thread.unreadCount}</Text>
                    </View>
                )}
            </View>
        </Pressable>
    );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function OnlineOrdersPage() {
    // ── State [GIU-NGUYEN, đổi tên mobileStatusFilter → statusFilter vì đây
    // giờ là bộ lọc DUY NHẤT, không còn phân biệt mobile/desktop] ───────────
    const [connected, setConnected] = useState(false);
    const [orders, setOrders] = useState([]);
    const [chatThreads, setChatThreads] = useState([]);
    const [tab, setTab] = useState("orders"); // "orders" | "chat"
    const [ordersView, setOrdersView] = useState("active"); // "active" | "history"
    const [historySearch, setHistorySearch] = useState("");

    const [orderToasts, setOrderToasts] = useState([]); // [{ toastId, order }]
    const [chatToast, setChatToast] = useState(null); // { customerId, message }

    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [detailOrder, setDetailOrder] = useState(null);

    const [statusFilter, setStatusFilter] = useState("pending");

    const [checkoutTarget, setCheckoutTarget] = useState(null);
    const [checkoutPayMethod, setCheckoutPayMethod] = useState("CASH");
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [actionToast, setActionToast] = useState(null); // { type: "success"|"error", msg }

    const [activeChatCustomerId, setActiveChatCustomerId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatDraft, setChatDraft] = useState("");

    const socketRef = useRef(null);
    const orderToastTimersRef = useRef(new Map());
    const chatToastTimer = useRef(null);
    const actionToastTimer = useRef(null);
    const activeChatCustomerIdRef = useRef(null);
    const chatScrollRef = useRef(null);
    const chatInputRef = useRef(null);

    useEffect(() => {
        activeChatCustomerIdRef.current = activeChatCustomerId;
    }, [activeChatCustomerId]);

    useEffect(() => () => clearTimeout(actionToastTimer.current), []);

    const showActionToast = useCallback((type, msg) => {
        setActionToast({ type, msg });
        clearTimeout(actionToastTimer.current);
        actionToastTimer.current = setTimeout(() => setActionToast(null), ACTION_TOAST_DURATION);
    }, []);

    const dismissOrderToast = useCallback((toastId) => {
        setOrderToasts((prev) => prev.filter((t) => t.toastId !== toastId));
        const timeoutId = orderToastTimersRef.current.get(toastId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            orderToastTimersRef.current.delete(toastId);
        }
    }, []);

    // ─── Socket setup [GIU-NGUYEN] ──────────────────────────────────────────
    useEffect(() => {
        socketRef.current = socket;
        const orderToastTimers = orderToastTimersRef.current;

        const handleConnect = () => {
            setConnected(true);
            socket.emit("join_admin");
        };
        const handleDisconnect = () => setConnected(false);

        const handleOrdersState = (list) =>
            setOrders(Array.isArray(list) ? list.map(normalizeOnlineOrder).filter(Boolean) : []);
        const handleOrderCreated = (order) => {
            const normalized = normalizeOnlineOrder(order);
            if (!normalized || !normalized.id) return;
            const toastId = `${normalized.id}-${Date.now()}`;
            setOrderToasts((prev) => [...prev, { toastId, order: normalized }]);
            const timeoutId = setTimeout(() => dismissOrderToast(toastId), NEW_ORDER_TOAST_DURATION);
            orderToastTimers.set(toastId, timeoutId);
        };

        const handleChatThreadsState = (list) =>
            setChatThreads(Array.isArray(list) ? list.map(normalizeChatThread).filter(Boolean) : []);
        const handleChatHistory = (history) =>
            setChatMessages(Array.isArray(history) ? history.map(normalizeChatMessage).filter(Boolean) : []);
        const handleCustomerChatMessage = (payload) => {
            const customerId = payload?.customerId;
            const message = normalizeChatMessage(payload?.message);
            if (!customerId || !message) return;
            if (activeChatCustomerIdRef.current === customerId) {
                setChatMessages((prev) => [...prev, message]);
                return;
            }
            if (message.from !== "customer") return;
            setChatToast({ customerId, message });
            clearTimeout(chatToastTimer.current);
            chatToastTimer.current = setTimeout(() => setChatToast(null), NEW_CHAT_TOAST_DURATION);
        };

        if (socket.connected) handleConnect();

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("online_orders_state", handleOrdersState);
        socket.on("online_order_created", handleOrderCreated);
        socket.on("chat_threads_state", handleChatThreadsState);
        socket.on("chat_history", handleChatHistory);
        socket.on("customer_chat_message", handleCustomerChatMessage);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("online_orders_state", handleOrdersState);
            socket.off("online_order_created", handleOrderCreated);
            socket.off("chat_threads_state", handleChatThreadsState);
            socket.off("chat_history", handleChatHistory);
            socket.off("customer_chat_message", handleCustomerChatMessage);
            orderToastTimers.forEach(clearTimeout);
            orderToastTimers.clear();
            clearTimeout(chatToastTimer.current);
        };
    }, [dismissOrderToast]);

    // Mở khung chat → cuộn xuống cuối + focus ô nhập. [UI] RN không có
    // scrollTop, dùng ref.scrollToEnd — xem ghi chú platform ở đầu file.
    useEffect(() => {
        if (activeChatCustomerId == null) return;
        chatScrollRef.current?.scrollToEnd({ animated: false });
        const t = setTimeout(() => chatInputRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, [activeChatCustomerId]);

    useEffect(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
    }, [chatMessages.length]);

    // ─── Derived values [GIU-NGUYEN] ────────────────────────────────────────
    const activeByStatus = useMemo(() => {
        const map = { pending: [], confirmed: [], preparing: [], delivering: [] };
        orders.forEach((o) => { if (map[o.status]) map[o.status].push(o); });
        return map;
    }, [orders]);

    const totalActive = activeByStatus.pending.length + activeByStatus.confirmed.length
        + activeByStatus.preparing.length + activeByStatus.delivering.length;

    const historyOrders = useMemo(() => {
        const list = orders.filter((o) => o.status === "completed" || o.status === "cancelled");
        const keyword = historySearch.trim().toLowerCase();
        if (!keyword) return list;
        return list.filter((o) =>
            o.customerName?.toLowerCase().includes(keyword) ||
            o.phone?.includes(keyword) ||
            o.id?.toLowerCase().includes(keyword)
        );
    }, [orders, historySearch]);

    const todayCompleted = useMemo(() => {
        const today = new Date().toDateString();
        return orders.filter(
            (o) => o.status === "completed" && o.completedAt && new Date(o.completedAt).toDateString() === today
        );
    }, [orders]);
    const todayRevenue = todayCompleted.reduce((s, o) => s + o.totalPrice, 0);

    const totalUnreadChat = chatThreads.reduce((s, t) => s + t.unreadCount, 0);
    const activeThread = chatThreads.find((t) => t.customerId === activeChatCustomerId);

    const visibleOrderToasts = orderToasts.slice(0, MAX_VISIBLE_ORDER_TOASTS);
    const hiddenOrderToastCount = orderToasts.length - visibleOrderToasts.length;

    // ─── Hành động đơn hàng [GIU-NGUYEN] ────────────────────────────────────
    const advanceStatus = useCallback((order) => {
        const next = NEXT_STATUS[order.status];
        if (!next) return;
        if (next === "completed") {
            setCheckoutTarget(order);
            setCheckoutPayMethod("CASH");
            return;
        }
        socketRef.current?.emit("admin_update_order_status", { orderId: order.id, status: next });
    }, []);

    const openCancel = useCallback((order) => {
        setCancelTarget(order);
        setCancelReason("");
    }, []);

    const confirmCancel = useCallback(() => {
        if (!cancelTarget) return;
        socketRef.current?.emit("admin_update_order_status", { orderId: cancelTarget.id, status: "cancelled", reason: cancelReason });
        setCancelTarget(null);
    }, [cancelTarget, cancelReason]);

    // ─── Xác nhận thanh toán (bước Hoàn thành) [GIU-NGUYEN logic — chỉ đổi
    // fetch() → postData(), xem ghi chú platform ở đầu file] ────────────────
    const handleConfirmCheckout = useCallback(async () => {
        if (!checkoutTarget) return;
        setCheckoutLoading(true);

        const payload = {
            items: checkoutTarget.items.map((i) => ({
                foodId: i.foodId,
                quantity: i.quantity,
                note: checkoutTarget.note || "",
                channel: "ONLINE",
                customerName: checkoutTarget.customerName,
                customerPhone: checkoutTarget.phone,
                customerAddress: checkoutTarget.address,
            })),
            discountAmount: 0,
            paymentMethod: checkoutPayMethod,
            isPaid: true,
            note: checkoutTarget.note || "",
            createdBy: "Admin (Online)",
        };

        try {
            const res = await postData({ url: "/orders", data: payload });
            if (!res.success) throw new Error(res.message || `Lỗi lưu đơn (HTTP ${res.status})`);
            const saved = res.data;

            socketRef.current?.emit("admin_update_order_status", {
                orderId: checkoutTarget.id,
                status: "completed",
                paymentMethod: checkoutPayMethod,
                convertedOrderId: saved?.order?._id,
            });

            showActionToast("success", `Đã ghi nhận thanh toán cho ${checkoutTarget.customerName}! 🎉`);
            setCheckoutTarget(null);
        } catch (err) {
            console.error("[Checkout online]", err);
            showActionToast("error", `Thanh toán thất bại: ${err.message}`);
        } finally {
            setCheckoutLoading(false);
        }
    }, [checkoutTarget, checkoutPayMethod, showActionToast]);

    // ─── Hành động chat [GIU-NGUYEN] ────────────────────────────────────────
    const openChatThread = useCallback((customerId) => {
        setActiveChatCustomerId(customerId);
        setChatMessages([]);
        socketRef.current?.emit("admin_join_customer_chat", { customerId });
    }, []);
    const closeChatThread = useCallback(() => {
        setActiveChatCustomerId(null);
        setChatDraft("");
    }, []);
    const sendChatReply = useCallback(() => {
        const value = chatDraft.trim();
        if (!value || !activeChatCustomerId) return;
        socketRef.current?.emit("send_admin_chat_message", { customerId: activeChatCustomerId, text: value });
        setChatDraft("");
    }, [chatDraft, activeChatCustomerId]);

    const goToNewOrders = useCallback(() => {
        setTab("orders");
        setOrdersView("active");
        setStatusFilter("pending");
    }, []);

    // ─── Nội dung khung chat — dùng chung cho Modal chat ────────────────────
    const renderChatBody = () => (
        <>
            <ScrollView ref={chatScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
                {chatMessages.length === 0 ? (
                    <Text className="text-gray-400 text-xs text-center" style={{ paddingVertical: 40 }}>Chưa có tin nhắn nào</Text>
                ) : (
                    chatMessages.map((m, idx) => (
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
        </>
    );

    // ──────────────────────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1, position: "relative" }} className="bg-gray-50">
            {/* ── Toast đơn mới + tin nhắn mới — gộp 1 cột ở mép trên (xem ghi chú
          platform ở đầu file) ─────────────────────────────────────────── */}
            {(orderToasts.length > 0 || !!chatToast) && (
                <View style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 50, gap: 8 }} pointerEvents="box-none">
                    {visibleOrderToasts.map(({ toastId, order }) => (
                        <Animated.View key={toastId} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(180)}>
                            <Pressable
                                onPress={() => { goToNewOrders(); dismissOrderToast(toastId); }}
                                className="bg-white border-2 border-green-300 rounded-2xl shadow-lg px-4 py-3.5"
                            >
                                <View className="flex-row items-center" style={{ gap: 6 }}>
                                    <Bell size={13} color={colors.green[600]} />
                                    <Text className="text-xs font-bold text-green-600">Đơn online mới</Text>
                                </View>
                                <Text className="text-sm font-bold text-gray-700 mt-0.5" numberOfLines={1}>{order.customerName}</Text>
                                <Text className="text-xs text-gray-400">{safeFmtVND(order.totalPrice)} · {order.items.length} món</Text>
                            </Pressable>
                        </Animated.View>
                    ))}
                    {hiddenOrderToastCount > 0 && (
                        <Animated.View entering={FadeInDown.duration(220)}>
                            <Pressable onPress={goToNewOrders} className="bg-green-600 rounded-2xl shadow-lg px-4 py-2.5 items-center">
                                <Text className="text-white text-xs font-bold">+{hiddenOrderToastCount} đơn khác chờ xử lý</Text>
                            </Pressable>
                        </Animated.View>
                    )}
                    {!!chatToast && (
                        <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(180)}>
                            <Pressable
                                onPress={() => { setTab("chat"); openChatThread(chatToast.customerId); setChatToast(null); }}
                                className="bg-white border border-green-200 rounded-xl shadow-lg px-3.5 py-2.5"
                            >
                                <View className="flex-row items-center" style={{ gap: 4 }}>
                                    <MessageCircle size={11} color={colors.green[600]} />
                                    <Text className="text-[11px] font-bold text-green-600">Tin nhắn mới</Text>
                                </View>
                                <Text className="text-xs text-gray-700 mt-0.5" numberOfLines={2}>{chatToast.message.text}</Text>
                            </Pressable>
                        </Animated.View>
                    )}
                </View>
            )}

            {/* ── Toast kết quả thao tác (thanh toán...) ───────────────────────── */}
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
                {/* ── Header ───────────────────────────────────────────────────── */}
                <View>
                    <Text className="text-2xl font-black text-green-900">Đơn Online</Text>
                    <View className="flex-row items-center flex-wrap mt-1" style={{ gap: 8 }}>
                        <Text className="text-gray-500 text-sm">{totalActive} đơn đang xử lý</Text>
                        <View className={`flex-row items-center rounded-full px-2 py-0.5 ${connected ? "bg-green-100" : "bg-red-100"}`} style={{ gap: 4 }}>
                            {connected ? <Wifi size={11} color={colors.green[700]} /> : <WifiOff size={11} color={colors.red[600]} />}
                            <Text className={`text-xs font-semibold ${connected ? "text-green-700" : "text-red-600"}`}>
                                {connected ? "Real-time" : "Mất kết nối"}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Tab: Đơn hàng / Tin nhắn ─────────────────────────────────── */}
                <View className="flex-row" style={{ gap: 8 }}>
                    {[["orders", `Đơn hàng${totalActive ? ` (${totalActive})` : ""}`], ["chat", `Tin nhắn${totalUnreadChat ? ` (${totalUnreadChat})` : ""}`]].map(([k, l]) => (
                        <Pressable
                            key={k}
                            onPress={() => setTab(k)}
                            className={`px-4 py-2 rounded-xl ${tab === k ? "bg-green-500" : "bg-white border border-gray-200"}`}
                        >
                            <Text className={`text-sm font-bold ${tab === k ? "text-white" : "text-gray-600"}`}>{l}</Text>
                        </Pressable>
                    ))}
                </View>

                {tab === "orders" ? (
                    <View style={{ gap: 14 }}>
                        {/* ── Thống kê nhanh ─────────────────────────────────────── */}
                        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                            <View
                                style={{ width: "47%", borderLeftWidth: 4, borderLeftColor: "#fb923c" }}
                                className="bg-white rounded-2xl border border-gray-100 p-4"
                            >
                                <Text className="text-xs font-bold text-gray-400 uppercase">Đang xử lý</Text>
                                <Text className="text-2xl font-black text-gray-800 mt-1">{totalActive}</Text>
                            </View>
                            <View
                                style={{ width: "47%", borderLeftWidth: 4, borderLeftColor: colors.green[500] }}
                                className="bg-white rounded-2xl border border-gray-100 p-4"
                            >
                                <Text className="text-xs font-bold text-gray-400 uppercase">Hoàn thành hôm nay</Text>
                                <Text className="text-2xl font-black text-gray-800 mt-1">{todayCompleted.length}</Text>
                            </View>
                            <View
                                style={{ width: "100%", borderLeftWidth: 4, borderLeftColor: colors.green[500] }}
                                className="bg-white rounded-2xl border border-gray-100 p-4"
                            >
                                <Text className="text-xs font-bold text-gray-400 uppercase">Doanh thu hôm nay</Text>
                                <Text className="text-2xl font-black text-green-600 mt-1">{safeFmtVND(todayRevenue)}</Text>
                            </View>
                        </View>

                        {/* ── Sub-tabs: Đang xử lý / Lịch sử ─────────────────────── */}
                        <View className="flex-row" style={{ gap: 8 }}>
                            {[["active", "Đang xử lý"], ["history", "Lịch sử"]].map(([k, l]) => (
                                <Pressable
                                    key={k}
                                    onPress={() => setOrdersView(k)}
                                    className={`px-3.5 py-1.5 rounded-lg ${ordersView === k ? "bg-green-100" : ""}`}
                                >
                                    <Text className={`text-xs font-bold ${ordersView === k ? "text-green-700" : "text-gray-500"}`}>{l}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {ordersView === "active" ? (
                            totalActive === 0 ? (
                                <View className="bg-white rounded-2xl border border-gray-100">
                                    <EmptyState icon={ShoppingBag} text="Chưa có đơn online nào đang xử lý" />
                                </View>
                            ) : (
                                <View style={{ gap: 12 }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                                        {ACTIVE_COLUMNS.map((col) => (
                                            <Pressable
                                                key={col.status}
                                                onPress={() => setStatusFilter(col.status)}
                                                className={`px-3.5 py-2 rounded-xl ${statusFilter === col.status ? "bg-green-500" : "bg-white border border-gray-200"}`}
                                            >
                                                <Text className={`text-xs font-bold ${statusFilter === col.status ? "text-white" : "text-gray-600"}`}>
                                                    {col.label} ({activeByStatus[col.status].length})
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>

                                    <View style={{ gap: 12 }}>
                                        {activeByStatus[statusFilter].length === 0 ? (
                                            <View className="bg-white rounded-2xl border border-gray-100 items-center py-10">
                                                <Text className="text-gray-300 text-sm font-bold">Trống</Text>
                                            </View>
                                        ) : (
                                            activeByStatus[statusFilter].map((order) => (
                                                <OrderCard key={order.id} order={order} onCancel={openCancel} onAdvance={advanceStatus} />
                                            ))
                                        )}
                                    </View>
                                </View>
                            )
                        ) : (
                            <View style={{ gap: 12 }}>
                                <View style={{ position: "relative", justifyContent: "center" }}>
                                    <View style={{ position: "absolute", left: 14, zIndex: 1 }}>
                                        <Search size={15} color={colors.gray[400]} />
                                    </View>
                                    <TextInput
                                        value={historySearch}
                                        onChangeText={setHistorySearch}
                                        placeholder="Tìm theo tên, SĐT, mã đơn..."
                                        placeholderTextColor={colors.gray[300]}
                                        className="bg-white border border-gray-200 rounded-xl text-sm text-gray-800"
                                        style={{ paddingLeft: 38, paddingRight: 16, paddingVertical: 11 }}
                                    />
                                </View>

                                <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    {historyOrders.length === 0 ? (
                                        <EmptyState icon={Search} text="Chưa có đơn nào trong lịch sử" />
                                    ) : (
                                        historyOrders.map((order, idx) => (
                                            <OrderHistoryCard
                                                key={order.id}
                                                order={order}
                                                isLast={idx === historyOrders.length - 1}
                                                onPress={() => setDetailOrder(order)}
                                            />
                                        ))
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                ) : (
                    /* ── Tab: Tin nhắn ─────────────────────────────────────────── */
                    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        {chatThreads.length === 0 ? (
                            <EmptyState icon={MessageCircle} text="Chưa có khách nào nhắn tin" />
                        ) : (
                            chatThreads.map((t, idx) => (
                                <ChatThreadRow
                                    key={t.customerId}
                                    thread={t}
                                    active={activeChatCustomerId === t.customerId}
                                    isLast={idx === chatThreads.length - 1}
                                    onPress={() => openChatThread(t.customerId)}
                                />
                            ))
                        )}
                    </View>
                )}
            </ScrollView>

            {/* ── Modal chat ───────────────────────────────────────────────── */}
            {!!activeChatCustomerId && (
                <ModalOverlay onClose={closeChatThread}>
                    <View className="bg-white rounded-3xl overflow-hidden" style={{ height: 480 }}>
                        <ModalHeader
                            title={activeThread?.customerName ? `${activeThread.customerName}${activeThread.phone ? " · " + activeThread.phone : ""}` : shortCustomerLabel(activeChatCustomerId)}
                            onClose={closeChatThread}
                        />
                        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                            {renderChatBody()}
                        </KeyboardAvoidingView>
                    </View>
                </ModalOverlay>
            )}

            {/* ── Modal chi tiết đơn (từ tab lịch sử) ─────────────────────────── */}
            {!!detailOrder && (
                <ModalOverlay onClose={() => setDetailOrder(null)}>
                    <View className="bg-white rounded-3xl overflow-hidden">
                        <ModalHeader title={detailOrder.customerName} onClose={() => setDetailOrder(null)} />
                        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} style={{ maxHeight: 480 }}>
                            <View className="flex-row items-center justify-between">
                                <OnlineStatusBadge status={detailOrder.status} />
                                <Text className="text-xs text-gray-400">{safeFmtDate(detailOrder.createdAt)}</Text>
                            </View>
                            <View style={{ gap: 4 }}>
                                <View className="flex-row items-center" style={{ gap: 6 }}>
                                    <Phone size={12} color={colors.gray[500]} />
                                    <Text className="text-xs text-gray-500">{detailOrder.phone}</Text>
                                </View>
                                <View className="flex-row items-center" style={{ gap: 6 }}>
                                    <MapPin size={12} color={colors.gray[500]} />
                                    <Text className="text-xs text-gray-500" style={{ flex: 1 }}>{detailOrder.address}</Text>
                                </View>
                            </View>
                            <View className="bg-gray-50 rounded-xl p-3" style={{ gap: 4 }}>
                                {detailOrder.items.map((item, idx) => (
                                    <View key={idx} className="flex-row justify-between">
                                        <Text className="text-sm text-gray-700">{item.foodName} × {item.quantity}</Text>
                                        <Text className="text-sm font-semibold text-gray-600">{safeFmtVND(item.unitPrice * item.quantity)}</Text>
                                    </View>
                                ))}
                            </View>
                            {!!detailOrder.note && <Text className="text-xs text-gray-500">Ghi chú: {detailOrder.note}</Text>}
                            {detailOrder.status === "cancelled" && !!detailOrder.cancelReason && (
                                <Text className="text-xs text-red-500">Lý do huỷ: {detailOrder.cancelReason}</Text>
                            )}
                            <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                                <Text className="font-bold text-gray-700 text-sm">Tổng cộng</Text>
                                <Text className="font-black text-lg text-green-600">{safeFmtVND(detailOrder.totalPrice)}</Text>
                            </View>
                            {chatThreads.some((t) => t.customerId === detailOrder.customerId) && (
                                <ActionBtn
                                    icon={MessageCircle}
                                    label="Xem trò chuyện với khách"
                                    variant="secondary"
                                    flex
                                    onPress={() => { setDetailOrder(null); setTab("chat"); openChatThread(detailOrder.customerId); }}
                                />
                            )}
                        </ScrollView>
                    </View>
                </ModalOverlay>
            )}

            {/* ── Modal xác nhận thanh toán (bước Hoàn thành) ─────────────────── */}
            {!!checkoutTarget && (
                <ModalOverlay onClose={() => setCheckoutTarget(null)}>
                    <View className="bg-white rounded-3xl overflow-hidden">
                        <ModalHeader title={`Thanh toán — ${checkoutTarget.customerName}`} onClose={() => setCheckoutTarget(null)} />
                        <View style={{ padding: 20, gap: 16 }}>
                            <View className="bg-green-50 rounded-xl p-4" style={{ gap: 8 }}>
                                {checkoutTarget.items.map((item, idx) => (
                                    <View key={idx} className="flex-row justify-between">
                                        <Text className="text-sm text-gray-700">{item.foodName} × {item.quantity}</Text>
                                        <Text className="text-sm font-semibold">{safeFmtVND(item.unitPrice * item.quantity)}</Text>
                                    </View>
                                ))}
                                <View className="flex-row justify-between items-center border-t border-green-200 pt-2 mt-1">
                                    <Text className="font-bold text-gray-700">Tổng cộng</Text>
                                    <Text className="font-black text-lg text-green-600">{safeFmtVND(checkoutTarget.totalPrice)}</Text>
                                </View>
                            </View>

                            <View>
                                <Text className="text-xs font-bold text-gray-500 uppercase mb-3">Phương thức thanh toán</Text>
                                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                    {PAYMENT_OPTIONS.map(([m, l]) => (
                                        <Pressable
                                            key={m}
                                            onPress={() => setCheckoutPayMethod(m)}
                                            style={{ width: "47%" }}
                                            className={`py-3 rounded-xl items-center border-2 ${checkoutPayMethod === m ? "border-green-500 bg-green-50" : "border-gray-200"}`}
                                        >
                                            <Text className={`text-sm font-bold ${checkoutPayMethod === m ? "text-green-700" : "text-gray-600"}`}>{l}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View className="flex-row" style={{ gap: 8 }}>
                                <ActionBtn label="Hủy" variant="secondary" flex onPress={() => setCheckoutTarget(null)} />
                                <ActionBtn
                                    icon={Check}
                                    label={checkoutLoading ? "Đang xử lý…" : "Xác nhận thanh toán"}
                                    variant="primary"
                                    flex
                                    loading={checkoutLoading}
                                    disabled={checkoutLoading}
                                    onPress={handleConfirmCheckout}
                                />
                            </View>
                        </View>
                    </View>
                </ModalOverlay>
            )}

            {/* ── Modal xác nhận huỷ đơn ───────────────────────────────────────── */}
            {!!cancelTarget && (
                <ModalOverlay onClose={() => setCancelTarget(null)}>
                    <View className="bg-white rounded-3xl overflow-hidden">
                        <ModalHeader title="Huỷ đơn online?" />
                        <View style={{ padding: 20, gap: 16 }}>
                            <Text className="text-sm text-gray-600" style={{ lineHeight: 20 }}>
                                Đơn của <Text style={{ fontWeight: "800", color: colors.gray[800] }}>{cancelTarget.customerName}</Text> sẽ được đánh dấu là đã huỷ. Bạn có chắc chắn không?
                            </Text>
                            <TextInput
                                value={cancelReason}
                                onChangeText={setCancelReason}
                                placeholder="Lý do huỷ (tuỳ chọn)"
                                placeholderTextColor={colors.gray[300]}
                                className="border border-gray-200 rounded-xl text-sm text-gray-800"
                                style={{ paddingHorizontal: 14, paddingVertical: 11 }}
                            />
                            <View className="flex-row" style={{ gap: 8 }}>
                                <ActionBtn label="Đóng" variant="secondary" flex onPress={() => setCancelTarget(null)} />
                                <ActionBtn icon={XCircle} label="Huỷ đơn" variant="danger" flex onPress={confirmCancel} />
                            </View>
                        </View>
                    </View>
                </ModalOverlay>
            )}
        </View>
    );
}