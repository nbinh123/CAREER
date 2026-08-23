import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
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
    FlatList,
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
import { postData, getData } from "../utils/callAPI";
import colors from "../theme/tokens";

// ─── Hằng số [GIU-NGUYEN] ───────────────────────────────────────────────────
const NEW_ORDER_TOAST_DURATION = 6000; // mỗi toast đơn mới tự ẩn sau 6s (độc lập với các toast khác)
const MAX_VISIBLE_ORDER_TOASTS = 3; // đơn mới về liên tiếp — chỉ hiện tối đa 3 toast, dư ra gộp vào dòng tổng
const NEW_CHAT_TOAST_DURATION = 6000; // toast tin nhắn mới tự ẩn sau 6s
const ACTION_TOAST_DURATION = 3500; // toast kết quả thao tác (thanh toán...) tự ẩn sau 3.5s
const HISTORY_SEARCH_DEBOUNCE = 350; // [PERF] trì hoãn filter lịch sử để không chạy lại trên mỗi keystroke
const AUTO_ADVANCE_DELAY = 30000; // [NGHIỆP VỤ] "Đã xác nhận" và "Đang làm" tự chuyển bước tiếp theo sau 30s, không cần bấm nút
const HISTORY_PAGE_SIZE = 5; // [PHÂN TRANG] mỗi trang lịch sử tải 5 đơn, bấm "Xem thêm" để tải trang kế
// [PHÂN TRANG] Base queryKey dùng chung giữa useInfiniteQuery (trong
// OrderHistorySection) và queryClient.invalidateQueries (ở component cha,
// khi phát hiện có đơn vừa chuyển sang completed/cancelled qua socket) —
// react-query khớp theo tiền tố nên invalidate bằng key này sẽ làm mới mọi
// query lịch sử đang mở, bất kể đang gõ từ khoá tìm kiếm gì.
const HISTORY_QUERY_KEY_BASE = ["online-order-history"];

const PAYMENT_OPTIONS = [
    ["CASH", "💵 Tiền mặt"],
    ["BANKING", "🏦 Chuyển khoản"],
    ["MOMO", "🟣 MoMo"],
    ["ZALOPAY", "🔵 ZaloPay"],
];

// [NGHIỆP VỤ] Chỉ còn 2 tab lọc "Chờ xác nhận" và "Đang giao" trên UI.
// "confirmed" và "preparing" vẫn tồn tại trong dữ liệu (activeByStatus vẫn
// gộp đủ 4 trạng thái cho số liệu "Đang xử lý") và vẫn tự chuyển bước sau
// 30s như đã làm ở lượt trước — chỉ không còn hiện thành tab riêng để admin
// thao tác/nhìn thấy nữa, đúng ý "chạy ngầm dưới UI".
const ACTIVE_COLUMNS = [
    { status: "pending", label: "Chờ xác nhận" },
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

// ─── [PERF] Giữ nguyên reference của các field không đổi khi merge dữ liệu
// đơn hàng nhận từ socket. Server bắn lại NGUYÊN danh sách mỗi lần cập nhật
// (`online_orders_state`), nên nếu map thẳng qua normalizeOnlineOrder, MỌI
// đơn — kể cả đơn không hề thay đổi — đều nhận object reference MỚI, khiến
// React.memo ở OrderCard/OrderHistoryCard vô tác dụng (props luôn "khác
// nhau" dù nội dung giống hệt). Hàm dưới đây so sánh nội dung, và chỉ tạo
// object mới cho đơn thực sự thay đổi. Đây là workaround ở phía client cho
// một hạn chế thuộc kiến trúc socket (xem "Potential remaining bottlenecks"
// trong báo cáo đi kèm) — chỉ nên áp dụng nếu team chưa muốn đổi backend
// sang bắn diff/delta.
function ordersContentEqual(a, b) {
    if (
        a.status !== b.status ||
        a.totalPrice !== b.totalPrice ||
        a.note !== b.note ||
        a.cancelReason !== b.cancelReason ||
        a.customerName !== b.customerName ||
        a.phone !== b.phone ||
        a.address !== b.address ||
        a.completedAt !== b.completedAt
    ) {
        return false;
    }
    if (a.items.length !== b.items.length) return false;
    for (let i = 0; i < a.items.length; i++) {
        const x = a.items[i];
        const y = b.items[i];
        if (x.foodId !== y.foodId || x.foodName !== y.foodName || x.quantity !== y.quantity || x.unitPrice !== y.unitPrice) {
            return false;
        }
    }
    return true;
}
function mergeOrdersPreservingRefs(prevList, rawList) {
    const prevById = new Map(prevList.map((o) => [o.id, o]));
    const next = [];
    for (const raw of rawList) {
        const normalized = normalizeOnlineOrder(raw);
        if (!normalized || !normalized.id) continue;
        const prev = prevById.get(normalized.id);
        next.push(prev && ordersContentEqual(prev, normalized) ? prev : normalized);
    }
    return next;
}

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ (thay Button/Modal dùng chung ở bản web)
════════════════════════════════════════════════════════════ */
const ACTION_VARIANTS = {
    primary: { box: "bg-green-500", text: "text-white" },
    secondary: { box: "bg-white border border-gray-200", text: "text-gray-600" },
    danger: { box: "bg-red-500", text: "text-white" },
};
// [UI] size="lg" chỉ dùng cho 2 nút "Xác nhận" / "Hoàn thành" trong OrderCard
// (giờ là 2 nút thao tác chính trên trang) — các nút khác (modal thanh toán,
// modal huỷ...) giữ nguyên size="md" như cũ, không đổi.
const ACTION_SIZES = {
    md: "py-2.5",
    lg: "py-3.5",
};
function ActionBtn({ icon: Icon, label, onPress, variant = "secondary", disabled, loading, flex, size = "md" }) {
    const v = ACTION_VARIANTS[variant] ?? ACTION_VARIANTS.secondary;
    const paddingClass = ACTION_SIZES[size] ?? ACTION_SIZES.md;
    const iconColor = variant === "primary" || variant === "danger" ? colors.white : colors.gray[600];
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={{ opacity: disabled ? 0.5 : 1, flex: flex ? 1 : undefined }}
            className={`flex-row items-center justify-center gap-1.5 px-4 ${paddingClass} rounded-xl ${v.box}`}
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
/* [PERF] React.memo: khi danh sách `orders` được cập nhật qua socket, chỉ
   những đơn thực sự đổi nội dung mới nhận object reference mới (nhờ
   mergeOrdersPreservingRefs), nên các card không đổi sẽ bỏ qua re-render. */
// [NGHIỆP VỤ] "Đã xác nhận" (confirmed) và "Đang làm" (preparing) tự động
// chuyển bước sau 30s (xem effect tự động chuyển trạng thái ở component
// cha) nên không cần nút bấm nữa — chỉ còn "Xác nhận" (pending) và
// "Hoàn thành" (delivering, mở modal thanh toán) là thao tác thủ công.
const ORDER_CARD_ACTION_STATUSES = new Set(["pending", "delivering"]);
const OrderCard = React.memo(function OrderCard({ order, onCancel, onAdvance }) {
    const showAdvanceButton = ORDER_CARD_ACTION_STATUSES.has(order.status);
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

            <View className="flex-row items-stretch" style={{ gap: 6 }}>
                <Pressable
                    onPress={() => onCancel(order)}
                    className="items-center justify-center rounded-lg border border-red-200 py-2.5"
                    style={{ aspectRatio: 1 }}
                >
                    <XCircle size={14} color={colors.red[500]} />
                </Pressable>
                {showAdvanceButton && (
                    <ActionBtn
                        icon={ArrowRight}
                        label={NEXT_LABEL[order.status]}
                        onPress={() => onAdvance(order)}
                        variant="primary"
                        flex
                        size="lg"
                    />
                )}
            </View>
        </View>
    );
});

/* ── 1 đơn lịch sử = 1 card (thay cho <tr> bảng gốc, dùng cho mọi kích cỡ
   màn hình — xem ghi chú platform ở đầu file) ──────────────────────────── */
/* [PERF] React.memo — cùng lý do với OrderCard. */
const OrderHistoryCard = React.memo(function OrderHistoryCard({ order, isLast, onPress }) {
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
});

/* ── 1 hội thoại = 1 hàng trong tab Tin nhắn ─────────────────────────────── */
/* [PERF] React.memo — hạn chế re-render khi danh sách chatThreads được thay
   mới (server cũng bắn lại nguyên mảng, xem ghi chú "Potential remaining
   bottlenecks"). */
const ChatThreadRow = React.memo(function ChatThreadRow({ thread, active, onPress, isLast }) {
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
});

/* ── Khung chat (modal) ───────────────────────────────────────────────────
   [PERF] Tách thành component riêng, giữ ô nhập (`draft`) là state CỤC BỘ
   ở đây thay vì ở component cha. Bản gốc để `chatDraft` trong
   OnlineOrdersPage nên MỖI phím gõ khi trả lời khách sẽ re-render TOÀN BỘ
   trang (đơn hàng, thống kê, toast...) — chỉ vì gõ chat. Tách ra chỗ này,
   gõ chat giờ chỉ re-render riêng modal chat. Danh sách tin nhắn cũng đổi
   từ ScrollView + map() sang FlatList: modal có chiều cao cố định (480),
   nên FlatList ở đây virtualization thật sự có tác dụng cho các đoạn chat
   dài — không giống list "Lịch sử" bên dưới (xem ghi chú ở đó). ────────── */
const ChatModal = React.memo(function ChatModal({ visible, customerId, title, messages, onClose, onSend }) {
    const [draft, setDraft] = useState("");
    const listRef = useRef(null);
    const inputRef = useRef(null);

    // Đổi khách đang chat → reset ô nhập dở dang, giống hành vi bản gốc
    // (bản gốc reset chatDraft trong closeChatThread).
    useEffect(() => {
        setDraft("");
    }, [customerId]);

    // Mở khung chat → cuộn xuống cuối + focus ô nhập. [GIU-NGUYEN hành vi gốc]
    useEffect(() => {
        if (!visible) return;
        listRef.current?.scrollToEnd({ animated: false });
        const t = setTimeout(() => inputRef.current?.focus(), 150);
        return () => clearTimeout(t);
    }, [visible, customerId]);

    useEffect(() => {
        if (!visible) return;
        listRef.current?.scrollToEnd({ animated: true });
    }, [visible, messages.length]);

    const handleSend = useCallback(() => {
        const value = draft.trim();
        if (!value) return;
        onSend(value);
        setDraft("");
    }, [draft, onSend]);

    const renderMessage = useCallback(({ item }) => (
        <View style={{ flexDirection: "row", justifyContent: item.from === "admin" ? "flex-end" : "flex-start" }}>
            <View
                style={{ maxWidth: "75%" }}
                className={`rounded-2xl px-3.5 py-2.5 ${item.from === "admin" ? "bg-green-500 rounded-br-md" : "bg-gray-100 rounded-bl-md"}`}
            >
                <Text className={`text-sm ${item.from === "admin" ? "text-white" : "text-gray-700"}`} style={{ lineHeight: 20 }}>
                    {item.text}
                </Text>
                <Text className={`text-[10px] mt-1 ${item.from === "admin" ? "text-green-100" : "text-gray-400"}`}>
                    {safeFmtDate(item.at instanceof Date ? item.at.toISOString() : item.at)}
                </Text>
            </View>
        </View>
    ), []);
    const keyExtractor = useCallback((item, idx) => (item.id != null ? String(item.id) : String(idx)), []);

    if (!visible) return null;

    return (
        <ModalOverlay onClose={onClose}>
            <View className="bg-white rounded-3xl overflow-hidden" style={{ height: 480 }}>
                <ModalHeader title={title} onClose={onClose} />
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <FlatList
                        ref={listRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={keyExtractor}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 12, gap: 8 }}
                        ListEmptyComponent={
                            <Text className="text-gray-400 text-xs text-center" style={{ paddingVertical: 40 }}>Chưa có tin nhắn nào</Text>
                        }
                        initialNumToRender={20}
                        maxToRenderPerBatch={20}
                        windowSize={10}
                    />
                    <View className="flex-row items-center border-t border-gray-100" style={{ gap: 8, padding: 12 }}>
                        <TextInput
                            ref={inputRef}
                            value={draft}
                            onChangeText={setDraft}
                            onSubmitEditing={handleSend}
                            placeholder="Nhập tin nhắn trả lời..."
                            placeholderTextColor={colors.gray[300]}
                            className="flex-1 border border-gray-200 rounded-full text-sm text-gray-800"
                            style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                        />
                        <Pressable
                            onPress={handleSend}
                            disabled={!draft.trim()}
                            style={{ opacity: draft.trim() ? 1 : 0.4 }}
                            className="w-10 h-10 rounded-full bg-green-500 items-center justify-center"
                        >
                            <Send size={16} color={colors.white} />
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </ModalOverlay>
    );
});

/* ── Tab "Lịch sử" ─────────────────────────────────────────────────────────
   [PERF] Tách thành component riêng, giữ ô tìm kiếm (`search`) VÀ modal chi
   tiết đơn (`detailOrder`) là state cục bộ ở đây. Bản gốc để `historySearch`
   và `detailOrder` trong OnlineOrdersPage nên mỗi phím gõ tìm kiếm re-render
   toàn trang. Có thêm debounce 350ms cho ô tìm kiếm (mục 6 trong checklist)
   để không filter lại mảng lịch sử trên mỗi keystroke.

   Lưu ý: danh sách này VẪN dùng .map() thay vì FlatList, y hệt bản gốc —
   xem lý do ở "GLOBAL/UX ISSUE" trong báo cáo đi kèm: trang hiện là MỘT
   ScrollView duy nhất bọc toàn bộ nội dung (header, thống kê, danh sách),
   nên nhét FlatList vào đây sẽ bị cảnh báo "VirtualizedList nested inside
   plain ScrollView" và KHÔNG có lợi ích ảo hoá thật sự (FlatList lồng trong
   ScrollView không có chiều cao giới hạn vẫn phải render gần như toàn bộ).
   Muốn ảo hoá thật cho danh sách lịch sử cần tách phần header (thống kê,
   tab) ra khỏi vùng cuộn — đây là thay đổi layout/UX vượt phạm vi "tối ưu
   không đổi UI", nên tôi không tự ý làm mà để bạn quyết định. ──────────── */
/* ── Tab "Lịch sử" ─────────────────────────────────────────────────────────
   [PHÂN TRANG] Lịch sử giờ tải qua REST có phân trang (5 đơn/trang, nút "Xem
   thêm") bằng useInfiniteQuery, thay vì lọc từ mảng `orders` đến từ socket
   "online_orders_state" (vốn bắn lại NGUYÊN danh sách mỗi lần cập nhật — đây
   từng là điểm bị flag "danh sách lịch sử không giới hạn" ở các lượt review
   hiệu năng trước). Phân trang giải quyết vấn đề đó TẬN GỐC: danh sách trong
   bộ nhớ giờ luôn có giới hạn (5, 10, 15... tuỳ số lần bấm "Xem thêm"), nên
   .map() là đủ, không cần FlatList/ảo hoá nữa.

   Từ khoá tìm kiếm (debouncedSearch) nằm trong queryKey → đổi từ khoá sẽ tự
   bắt đầu 1 query mới từ trang 1 (tìm kiếm chạy Ở BACKEND trên toàn bộ lịch
   sử, không chỉ trong các trang đã tải — đúng hơn cách lọc client cũ). Vẫn
   giữ ô tìm kiếm là state cục bộ + debounce 350ms như trước, tránh gõ 1 ký
   tự là bắn 1 request.

   [PERF] Vẫn tách thành component riêng, giữ `search`/`detailOrder` là state
   cục bộ ở đây — gõ tìm kiếm hoặc mở modal chi tiết không re-render toàn
   trang (đơn hàng, thống kê, toast...). ─────────────────────────────────── */
const OrderHistorySection = React.memo(function OrderHistorySection({ chatThreads, onViewChat }) {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [detailOrder, setDetailOrder] = useState(null);
    const debounceTimerRef = useRef(null);

    useEffect(() => {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => setDebouncedSearch(search), HISTORY_SEARCH_DEBOUNCE);
        return () => clearTimeout(debounceTimerRef.current);
    }, [search]);

    const historyQueryKey = useMemo(() => [...HISTORY_QUERY_KEY_BASE, debouncedSearch], [debouncedSearch]);

    // GIẢ ĐỊNH CẦN BẠN KIỂM TRA: gọi getData({ url, params }) — giả sử
    // getData nhận query string qua object `params` giống cách postData nhận
    // `data`. Nếu getData thực tế của bạn nhận query string khác (vd. nối
    // thẳng vào url), đổi lại phần gọi getData bên dưới cho khớp. Endpoint
    // "/orders/online/history" là endpoint MỚI, cần thêm ở backend — xem file
    // tham khảo đính kèm.
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
        refetch,
    } = useInfiniteQuery({
        queryKey: historyQueryKey,
        queryFn: async ({ pageParam }) => {
            const res = await getData({
                url: "/orders/online/history",
                params: { page: pageParam, limit: HISTORY_PAGE_SIZE, search: debouncedSearch || undefined },
            });
            if (!res.success) throw new Error(res.message || `Lỗi tải lịch sử (HTTP ${res.status})`);
            return res.data; // kỳ vọng { orders: [...], page, hasMore }
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => (lastPage?.hasMore ? (lastPage.page ?? 1) + 1 : undefined),
        // Không cần staleTime ngắn như mặc định (10s) vì đã có
        // queryClient.invalidateQueries chủ động ở component cha ngay khi
        // socket xác nhận có đơn chuyển sang completed/cancelled.
        staleTime: 30_000,
    });

    const orders = useMemo(() => {
        const pages = data?.pages ?? [];
        const out = [];
        for (const page of pages) {
            const list = Array.isArray(page?.orders) ? page.orders : [];
            for (const raw of list) {
                const normalized = normalizeOnlineOrder(raw);
                if (normalized) out.push(normalized);
            }
        }
        return out;
    }, [data]);

    const hasChatWithDetail = !!detailOrder && chatThreads.some((t) => t.customerId === detailOrder.customerId);

    return (
        <View style={{ gap: 12 }}>
            <View style={{ position: "relative", justifyContent: "center" }}>
                <View style={{ position: "absolute", left: 14, zIndex: 1 }}>
                    <Search size={15} color={colors.gray[400]} />
                </View>
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Tìm theo tên, SĐT, mã đơn..."
                    placeholderTextColor={colors.gray[300]}
                    className="bg-white border border-gray-200 rounded-xl text-sm text-gray-800"
                    style={{ paddingLeft: 38, paddingRight: 16, paddingVertical: 11 }}
                />
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <View className="items-center py-14">
                        <ActivityIndicator size="small" color={colors.green[500]} />
                        <Text className="text-xs text-gray-400 mt-2">Đang tải lịch sử...</Text>
                    </View>
                ) : isError ? (
                    <View className="items-center py-14 px-6" style={{ gap: 10 }}>
                        <Text className="text-sm text-red-500 text-center">
                            {error?.message || "Không tải được lịch sử đơn"}
                        </Text>
                        <ActionBtn label="Thử lại" variant="secondary" onPress={() => refetch()} />
                    </View>
                ) : orders.length === 0 ? (
                    <EmptyState icon={Search} text="Chưa có đơn nào trong lịch sử" />
                ) : (
                    orders.map((order, idx) => (
                        <OrderHistoryCard
                            key={order.id}
                            order={order}
                            isLast={idx === orders.length - 1}
                            onPress={() => setDetailOrder(order)}
                        />
                    ))
                )}
            </View>

            {!isLoading && !isError && hasNextPage && (
                <ActionBtn
                    label={isFetchingNextPage ? "Đang tải..." : "Xem thêm"}
                    variant="secondary"
                    loading={isFetchingNextPage}
                    disabled={isFetchingNextPage}
                    onPress={() => fetchNextPage()}
                />
            )}

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
                            {hasChatWithDetail && (
                                <ActionBtn
                                    icon={MessageCircle}
                                    label="Xem trò chuyện với khách"
                                    variant="secondary"
                                    flex
                                    onPress={() => {
                                        const cid = detailOrder.customerId;
                                        setDetailOrder(null);
                                        onViewChat(cid);
                                    }}
                                />
                            )}
                        </ScrollView>
                    </View>
                </ModalOverlay>
            )}
        </View>
    );
});

/* ── Modal xác nhận huỷ đơn ────────────────────────────────────────────────
   [PERF] Tách thành component riêng, giữ `reason` (ô nhập lý do huỷ) là
   state cục bộ ở đây thay vì trong OnlineOrdersPage — cùng lý do với
   ChatModal/OrderHistorySection: gõ lý do huỷ không nên re-render cả trang. */
const CancelConfirmModal = React.memo(function CancelConfirmModal({ order, onClose, onConfirm }) {
    const [reason, setReason] = useState("");

    useEffect(() => {
        setReason("");
    }, [order?.id]);

    if (!order) return null;

    return (
        <ModalOverlay onClose={onClose}>
            <View className="bg-white rounded-3xl overflow-hidden">
                <ModalHeader title="Huỷ đơn online?" />
                <View style={{ padding: 20, gap: 16 }}>
                    <Text className="text-sm text-gray-600" style={{ lineHeight: 20 }}>
                        Đơn của <Text style={{ fontWeight: "800", color: colors.gray[800] }}>{order.customerName}</Text> sẽ được đánh dấu là đã huỷ. Bạn có chắc chắn không?
                    </Text>
                    <TextInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Lý do huỷ (tuỳ chọn)"
                        placeholderTextColor={colors.gray[300]}
                        className="border border-gray-200 rounded-xl text-sm text-gray-800"
                        style={{ paddingHorizontal: 14, paddingVertical: 11 }}
                    />
                    <View className="flex-row" style={{ gap: 8 }}>
                        <ActionBtn label="Đóng" variant="secondary" flex onPress={onClose} />
                        <ActionBtn icon={XCircle} label="Huỷ đơn" variant="danger" flex onPress={() => onConfirm(order, reason)} />
                    </View>
                </View>
            </View>
        </ModalOverlay>
    );
});

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function OnlineOrdersPage() {
    // [PHÂN TRANG] Dùng để invalidate query lịch sử ("Lịch sử" tab) ngay khi
    // phát hiện qua socket có đơn vừa chuyển sang completed/cancelled — xem
    // effect socket bên dưới.
    const queryClient = useQueryClient();

    // ── State [GIU-NGUYEN, đổi tên mobileStatusFilter → statusFilter vì đây
    // giờ là bộ lọc DUY NHẤT, không còn phân biệt mobile/desktop]
    // [PERF] historySearch, detailOrder, cancelReason, chatDraft đã chuyển
    // xuống làm state cục bộ trong OrderHistorySection/CancelConfirmModal/
    // ChatModal — xem ghi chú ở từng component. ─────────────────────────────
    const [connected, setConnected] = useState(false);
    const [orders, setOrders] = useState([]);
    const [chatThreads, setChatThreads] = useState([]);
    const [tab, setTab] = useState("orders"); // "orders" | "chat"
    const [ordersView, setOrdersView] = useState("active"); // "active" | "history"

    const [orderToasts, setOrderToasts] = useState([]); // [{ toastId, order }]
    const [chatToast, setChatToast] = useState(null); // { customerId, message }

    const [cancelTarget, setCancelTarget] = useState(null);

    const [statusFilter, setStatusFilter] = useState("pending");

    const [checkoutTarget, setCheckoutTarget] = useState(null);
    const [checkoutPayMethod, setCheckoutPayMethod] = useState("CASH");
    const [actionToast, setActionToast] = useState(null); // { type: "success"|"error", msg }

    const [activeChatCustomerId, setActiveChatCustomerId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);

    const socketRef = useRef(null);
    const orderToastTimersRef = useRef(new Map());
    const chatToastTimer = useRef(null);
    const actionToastTimer = useRef(null);
    const activeChatCustomerIdRef = useRef(null);
    // [NGHIỆP VỤ] orderId -> { timeoutId, status } cho cơ chế tự động chuyển
    // "Đã xác nhận" → "Đang làm" → "Đang giao" sau 30s không cần bấm nút.
    const autoAdvanceTimersRef = useRef(new Map());
    // Bản sao mới nhất của `orders`, đọc trong callback setTimeout để tránh
    // race: nếu đơn đã bị huỷ / đổi trạng thái khác trước khi timer 30s kịp
    // chạy, không gửi tín hiệu tự động chuyển bước nữa.
    const ordersRef = useRef([]);

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

        // [PERF] Dùng mergeOrdersPreservingRefs thay vì map thẳng qua
        // normalizeOnlineOrder, để giữ nguyên object reference cho các đơn
        // không đổi nội dung — nhờ đó React.memo(OrderCard)/React.memo(
        // OrderHistoryCard) mới thực sự bỏ qua re-render được. Không đổi
        // hành vi/dữ liệu hiển thị, chỉ đổi cách tạo object.
        //
        // [PHÂN TRANG] Đồng thời phát hiện đơn nào MỚI chuyển sang
        // completed/cancelled ở lần cập nhật này (so với snapshot `orders`
        // trước đó) để invalidate query lịch sử — làm ở đây (dựa trên state
        // đã được server xác nhận qua socket) thay vì invalidate ngay khi
        // bấm nút thanh toán/huỷ, để tránh trường hợp gọi lại API lịch sử
        // TRƯỚC KHI backend kịp lưu xong thay đổi.
        const handleOrdersState = (list) =>
            setOrders((prev) => {
                const merged = Array.isArray(list) ? mergeOrdersPreservingRefs(prev, list) : [];
                const prevHistoryIds = new Set(
                    prev.filter((o) => o.status === "completed" || o.status === "cancelled").map((o) => o.id)
                );
                const enteredHistory = merged.some(
                    (o) => (o.status === "completed" || o.status === "cancelled") && !prevHistoryIds.has(o.id)
                );
                if (enteredHistory) {
                    queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY_BASE });
                }
                return merged;
            });
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
    }, [dismissOrderToast, queryClient]);

    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    // ─── [NGHIỆP VỤ] Tự động chuyển "Đã xác nhận" → "Đang làm" → "Đang giao"
    // sau 30s, không cần admin bấm nút — gửi lại ĐÚNG event socket
    // `admin_update_order_status` mà nút bấm thủ công vẫn dùng, nên không
    // đổi API/socket contract. Mỗi đơn chỉ có 1 timer tại một thời điểm.
    //
    // LƯU Ý QUAN TRỌNG (GLOBAL): đây là timer chạy Ở PHÍA CLIENT, chỉ hoạt
    // động khi trang này đang mở trên ít nhất một thiết bị admin có kết nối
    // socket. Nếu tất cả admin đều thoát app / mất mạng đúng lúc, đơn sẽ
    // "kẹt" ở confirmed/preparing cho đến khi có ai mở lại trang. Muốn đảm
    // bảo 100% (kể cả khi không ai mở app) cần dời lịch hẹn giờ này sang
    // backend (cron/queue) — việc đó ngoài phạm vi 1 page nên tôi không tự
    // ý sửa, chỉ báo để bạn cân nhắc.
    useEffect(() => {
        const timers = autoAdvanceTimersRef.current;
        const relevantIds = new Set();

        orders.forEach((order) => {
            if (order.status !== "confirmed" && order.status !== "preparing") return;
            relevantIds.add(order.id);

            const existing = timers.get(order.id);
            if (existing && existing.status === order.status) return; // đã có timer đúng trạng thái, giữ nguyên đếm ngược

            if (existing) clearTimeout(existing.timeoutId);

            const statusAtSchedule = order.status;
            const nextStatus = NEXT_STATUS[statusAtSchedule];
            const timeoutId = setTimeout(() => {
                timers.delete(order.id);
                // Kiểm tra lại trạng thái mới nhất trước khi bắn tín hiệu — tránh
                // trường hợp đơn đã bị huỷ hoặc đổi trạng thái khác ngay trước khi
                // timer chạy tới.
                const current = ordersRef.current.find((o) => o.id === order.id);
                if (current && current.status === statusAtSchedule) {
                    socketRef.current?.emit("admin_update_order_status", { orderId: order.id, status: nextStatus });
                }
            }, AUTO_ADVANCE_DELAY);
            timers.set(order.id, { timeoutId, status: statusAtSchedule });
        });

        // Dọn timer cho đơn không còn ở confirmed/preparing nữa (đã tự chuyển,
        // bị huỷ, hoặc bị đổi trạng thái theo cách khác).
        timers.forEach((info, orderId) => {
            if (!relevantIds.has(orderId)) {
                clearTimeout(info.timeoutId);
                timers.delete(orderId);
            }
        });
    }, [orders]);

    useEffect(
        () => () => {
            autoAdvanceTimersRef.current.forEach((info) => clearTimeout(info.timeoutId));
            autoAdvanceTimersRef.current.clear();
        },
        []
    );

    // ─── Derived values [GIU-NGUYEN] ────────────────────────────────────────
    const activeByStatus = useMemo(() => {
        const map = { pending: [], confirmed: [], preparing: [], delivering: [] };
        orders.forEach((o) => { if (map[o.status]) map[o.status].push(o); });
        return map;
    }, [orders]);

    const totalActive = activeByStatus.pending.length + activeByStatus.confirmed.length
        + activeByStatus.preparing.length + activeByStatus.delivering.length;

    // [PHÂN TRANG] historyBaseList (lọc completed/cancelled từ `orders` phía
    // socket) không còn cần nữa — OrderHistorySection giờ tự tải dữ liệu
    // lịch sử có phân trang qua REST (xem component đó), không còn dựa vào
    // mảng `orders` đầy đủ ở đây nữa.

    const todayCompleted = useMemo(() => {
        const today = new Date().toDateString();
        return orders.filter(
            (o) => o.status === "completed" && o.completedAt && new Date(o.completedAt).toDateString() === today
        );
    }, [orders]);
    const todayRevenue = todayCompleted.reduce((s, o) => s + o.totalPrice, 0);

    const totalUnreadChat = chatThreads.reduce((s, t) => s + t.unreadCount, 0);
    const activeThread = chatThreads.find((t) => t.customerId === activeChatCustomerId);
    const chatModalTitle = activeChatCustomerId
        ? (activeThread?.customerName
            ? `${activeThread.customerName}${activeThread.phone ? " · " + activeThread.phone : ""}`
            : shortCustomerLabel(activeChatCustomerId))
        : "";

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
    }, []);

    // [PERF] Nhận (order, reason) từ CancelConfirmModal thay vì đọc state
    // `cancelReason` ở component cha (state đó giờ sống trong modal).
    const confirmCancel = useCallback((order, reason) => {
        socketRef.current?.emit("admin_update_order_status", { orderId: order.id, status: "cancelled", reason });
        setCancelTarget(null);
    }, []);

    // ─── [REACT QUERY] Thanh toán (bước Hoàn thành) ─────────────────────────
    // Vẫn gọi ĐÚNG "/orders" qua postData (utils/callAPI.js) như bản gốc —
    // không tạo axios instance mới, không đổi API contract, không bypass
    // callAPI.js. Chỉ đổi cách QUẢN LÝ trạng thái loading/error: từ state
    // thủ công (checkoutLoading + try/catch/finally) sang useMutation của
    // TanStack Query, dùng chung QueryClient/defaultOptions (retry: 1) đã
    // cấu hình ở src/config/queryClient.js — đồng bộ với các màn hình khác
    // trong app đang dùng react-query. Trang này không có request GET nào để
    // đổi sang useQuery: toàn bộ dữ liệu đơn/chat đến qua Socket.io (state
    // đẩy real-time), "/orders" là request REST duy nhất trên trang.
    const checkoutMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await postData({ url: "/orders", data: payload });
            if (!res.success) throw new Error(res.message || `Lỗi lưu đơn (HTTP ${res.status})`);
            return res.data;
        },
    });

    const handleConfirmCheckout = useCallback(() => {
        if (!checkoutTarget) return;
        const target = checkoutTarget; // chốt tham chiếu tại thời điểm bấm

        const payload = {
            items: target.items.map((i) => ({
                foodId: i.foodId,
                quantity: i.quantity,
                note: target.note || "",
                channel: "ONLINE",
                customerName: target.customerName,
                customerPhone: target.phone,
                customerAddress: target.address,
            })),
            discountAmount: 0,
            paymentMethod: checkoutPayMethod,
            isPaid: true,
            note: target.note || "",
            createdBy: "Admin (Online)",
        };

        checkoutMutation.mutate(payload, {
            onSuccess: (saved) => {
                socketRef.current?.emit("admin_update_order_status", {
                    orderId: target.id,
                    status: "completed",
                    paymentMethod: checkoutPayMethod,
                    convertedOrderId: saved?.order?._id,
                });
                showActionToast("success", `Đã ghi nhận thanh toán cho ${target.customerName}! 🎉`);
                setCheckoutTarget(null);
            },
            onError: (err) => {
                console.error("[Checkout online]", err);
                showActionToast("error", `Thanh toán thất bại: ${err.message}`);
            },
        });
    }, [checkoutTarget, checkoutPayMethod, showActionToast, checkoutMutation.mutate]);


    // ─── Hành động chat [GIU-NGUYEN, sendChatReply đổi tên → handleSendChat
    // và nhận text trực tiếp từ ChatModal thay vì đọc state chatDraft ──────
    const openChatThread = useCallback((customerId) => {
        setActiveChatCustomerId(customerId);
        setChatMessages([]);
        socketRef.current?.emit("admin_join_customer_chat", { customerId });
    }, []);
    const closeChatThread = useCallback(() => {
        setActiveChatCustomerId(null);
    }, []);
    const handleSendChat = useCallback((text) => {
        if (!activeChatCustomerId) return;
        socketRef.current?.emit("send_admin_chat_message", { customerId: activeChatCustomerId, text });
    }, [activeChatCustomerId]);
    // Dùng bởi nút "Xem trò chuyện với khách" trong OrderHistorySection.
    const goToChatThread = useCallback((customerId) => {
        setTab("chat");
        openChatThread(customerId);
    }, [openChatThread]);

    const goToNewOrders = useCallback(() => {
        setTab("orders");
        setOrdersView("active");
        setStatusFilter("pending");
    }, []);

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
                            <OrderHistorySection chatThreads={chatThreads} onViewChat={goToChatThread} />
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
            <ChatModal
                visible={!!activeChatCustomerId}
                customerId={activeChatCustomerId}
                title={chatModalTitle}
                messages={chatMessages}
                onClose={closeChatThread}
                onSend={handleSendChat}
            />

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
                                    label={checkoutMutation.isPending ? "Đang xử lý…" : "Xác nhận thanh toán"}
                                    variant="primary"
                                    flex
                                    loading={checkoutMutation.isPending}
                                    disabled={checkoutMutation.isPending}
                                    onPress={handleConfirmCheckout}
                                />
                            </View>
                        </View>
                    </View>
                </ModalOverlay>
            )}

            {/* ── Modal xác nhận huỷ đơn ───────────────────────────────────────── */}
            <CancelConfirmModal order={cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={confirmCancel} />
        </View>
    );
}