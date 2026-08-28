import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import socket from "../utils/socket";
import Button from "../components/Button";
import Modal from "../components/Modal";
import fmtVND from "../utils/fmtVND";
import fmtDate from "../utils/fmtDate";
import { API_URL } from "../config/api";
import {
    ArrowRight, Bell, Check, MapPin, MessageCircle, Phone, Search,
    Send, ShoppingBag, Wifi, WifiOff, XCircle,
} from "lucide-react";

// ─── Hằng số ──────────────────────────────────────────────────────────────────
const NEW_ORDER_TOAST_DURATION = 6000; // mỗi toast đơn mới tự ẩn sau 6s (độc lập với các toast khác)
const MAX_VISIBLE_ORDER_TOASTS = 3; // đơn mới về liên tiếp — chỉ hiện tối đa 3 toast, dư ra gộp vào dòng tổng
const NEW_CHAT_TOAST_DURATION = 6000; // toast tin nhắn mới tự ẩn sau 6s
const ACTION_TOAST_DURATION = 3500; // toast kết quả thao tác (thanh toán...) tự ẩn sau 3.5s

// Đơn hàng thật (OrderModel) được tạo qua REST khi admin xác nhận thanh
// toán — CÙNG endpoint mà OrdersPage.jsx (bản tại bàn) đang dùng, để đơn
// online cũng lên chung 1 chỗ báo cáo doanh thu.
const ORDERS_API_URL = `${API_URL}/api/orders`;

const PAYMENT_OPTIONS = [
    ["CASH", "💵 Tiền mặt"],
    ["BANKING", "🏦 Chuyển khoản"],
    ["MOMO", "🟣 MoMo"],
    ["ZALOPAY", "🔵 ZaloPay"],
];

// Cột Kanban cho các đơn đang xử lý — đúng thứ tự luồng thật:
// pending → confirmed → preparing → delivering → (completed nằm ở tab Lịch sử)
const ACTIVE_COLUMNS = [
    { status: "pending", label: "Chờ xác nhận", accent: "border-l-orange-400", badge: "bg-orange-100 text-orange-600" },
    { status: "confirmed", label: "Đã xác nhận", accent: "border-l-blue-400", badge: "bg-blue-100 text-blue-600" },
    { status: "preparing", label: "Đang làm", accent: "border-l-purple-400", badge: "bg-purple-100 text-purple-600" },
    { status: "delivering", label: "Đang giao", accent: "border-l-cyan-400", badge: "bg-cyan-100 text-cyan-600" },
];

// Trạng thái kế tiếp + nhãn nút hành động cho từng trạng thái hiện tại.
const NEXT_STATUS = { pending: "confirmed", confirmed: "preparing", preparing: "delivering", delivering: "completed" };
const NEXT_LABEL = { pending: "Xác nhận", confirmed: "Bắt đầu làm", preparing: "Giao hàng", delivering: "Hoàn thành" };

// ❗ MỚI — "confirmed" và "preparing" giờ tự động chuyển bước sau 30s (server
// xử lý, xem socket.js: scheduleAutoAdvance/applyOnlineOrderStatusUpdate),
// nên 2 trạng thái đó không cần nút bấm nữa. Chỉ còn 2 trạng thái vẫn cần
// admin thao tác thủ công:
// - "pending": vẫn giữ nút "Xác nhận" để admin có thể duyệt/đẩy nhanh đơn
//   ngay, thay vì luôn phải chờ đủ 30s — dù không bấm, server vẫn tự chuyển
//   sang "confirmed" sau 30s như một lưới an toàn.
// - "delivering": bắt buộc thủ công vì đây là bước thanh toán, cần admin
//   xác nhận đã thu tiền thật (không thể tự động hoá).
const ORDER_CARD_ACTION_STATUSES = new Set(["pending", "delivering"]);

const STATUS_META = {
    pending: { label: "Chờ xác nhận", className: "text-orange-600 bg-orange-100" },
    confirmed: { label: "Đã xác nhận", className: "text-blue-600 bg-blue-100" },
    preparing: { label: "Đang làm", className: "text-purple-600 bg-purple-100" },
    delivering: { label: "Đang giao", className: "text-cyan-600 bg-cyan-100" },
    completed: { label: "Hoàn thành", className: "text-green-600 bg-green-100" },
    cancelled: { label: "Đã huỷ", className: "text-red-600 bg-red-100" },
};

function OnlineStatusBadge({ status }) {
    const meta = STATUS_META[status] || STATUS_META.pending;
    return (
        <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${meta.className}`}>
            {meta.label}
        </span>
    );
}

// Rút gọn customerId (UUID dài) để hiện tạm khi chưa biết tên khách —
// vd "a1b2c3d4-..." → "Khách #a1b2c3d4"
function shortCustomerLabel(customerId) {
    return `Khách #${(customerId || "").slice(0, 8)}`;
}

// fmtDate/fmtVND là util bên ngoài — không kiểm soát được chúng throw gì khi
// gặp giá trị null/undefined/sai định dạng (rất hay xảy ra với các field
// ngày tháng khi API trả thiếu). Bọc lại kiểu safeCall để 1 giá trị xấu
// không làm crash cả cây render.
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

// ─── Chuẩn hoá dữ liệu từ server ───────────────────────────────────────────
// API/socket đôi khi trả về field bị thiếu, sai kiểu, hoặc cả object null
// (đơn lỗi, race condition lúc server đang ghi DB...). Toàn bộ phần render
// bên dưới giả định field luôn tồn tại đúng kiểu (order.items.map, v.v.),
// nên chuẩn hoá NGAY LÚC NHẬN — 1 chỗ duy nhất — để tránh phải rải optional
// chaining khắp nơi và lỡ sót gây crash UI (màn hình trắng).
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

export default function OnlineOrdersPage() {
    // ── State ─────────────────────────────────────────────────────────────────
    const [connected, setConnected] = useState(false);
    const [orders, setOrders] = useState([]); // toàn bộ đơn online trong cache (mới nhất trước)
    const [chatThreads, setChatThreads] = useState([]); // danh sách hội thoại
    const [tab, setTab] = useState("orders"); // "orders" | "chat"
    const [ordersView, setOrdersView] = useState("active"); // "active" | "history"
    const [historySearch, setHistorySearch] = useState("");

    // Hàng đợi toast đơn mới — KHÔNG dùng 1 state đơn lẻ nữa, vì nếu 2-3 khách
    // đặt liên tiếp trong vài giây, đơn sau sẽ ghi đè mất thông báo đơn trước.
    // Mỗi phần tử tự có timer riêng (xem orderToastTimersRef) nên tự tắt độc
    // lập, không phụ thuộc đơn đến sau/trước.
    const [orderToasts, setOrderToasts] = useState([]); // [{ toastId, order }]
    const [chatToast, setChatToast] = useState(null); // { customerId, message }

    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [detailOrder, setDetailOrder] = useState(null); // xem chi tiết đơn ở tab lịch sử

    // Bộ lọc trạng thái dùng trên mobile (<md) — thay cho Kanban 4 cột đầy đủ,
    // xem 1 cột tại 1 thời điểm cho dễ thao tác bằng ngón tay.
    const [mobileStatusFilter, setMobileStatusFilter] = useState("pending");

    // Modal xác nhận thanh toán — chỉ mở lúc chuyển bước cuối
    // "delivering" → "completed", vì chỉ bước đó thật sự liên quan tới tiền.
    const [checkoutTarget, setCheckoutTarget] = useState(null);
    const [checkoutPayMethod, setCheckoutPayMethod] = useState("CASH");
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [actionToast, setActionToast] = useState(null); // { type: "success"|"error", msg }

    const [activeChatCustomerId, setActiveChatCustomerId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatDraft, setChatDraft] = useState("");

    const socketRef = useRef(null);
    const orderToastTimersRef = useRef(new Map()); // toastId -> timeoutId, để clear đúng cái khi dismiss/unmount
    const chatToastTimer = useRef(null);
    const actionToastTimer = useRef(null);
    const activeChatCustomerIdRef = useRef(null);
    const chatScrollRef = useRef(null);
    const chatInputRef = useRef(null);

    useEffect(() => {
        activeChatCustomerIdRef.current = activeChatCustomerId;
    }, [activeChatCustomerId]);

    useEffect(() => () => clearTimeout(actionToastTimer.current), []);

    // Kết quả 1 thao tác admin tự bấm (thanh toán...) — khác với orderToasts/
    // chatToast vốn là thông báo real-time tới TỪ server.
    const showActionToast = useCallback((type, msg) => {
        setActionToast({ type, msg });
        clearTimeout(actionToastTimer.current);
        actionToastTimer.current = setTimeout(() => setActionToast(null), ACTION_TOAST_DURATION);
    }, []);

    // Gỡ đúng 1 toast đơn mới khỏi hàng đợi — dùng chung cho auto-timeout (hết
    // 6s) và khi admin bấm tay vào toast đó. Luôn clear timer tương ứng để
    // tránh set state trên toastId đã bị gỡ trước đó.
    const dismissOrderToast = useCallback((toastId) => {
        setOrderToasts((prev) => prev.filter((t) => t.toastId !== toastId));
        const timeoutId = orderToastTimersRef.current.get(toastId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            orderToastTimersRef.current.delete(toastId);
        }
    }, []);

    // ─── Socket setup ──────────────────────────────────────────────────────────
    // Dùng instance socket DÙNG CHUNG (import từ ../utils/socket), giống các
    // trang admin khác — chia sẻ đúng 1 connection thay vì tự io(...) riêng.
    useEffect(() => {
        socketRef.current = socket;
        const orderToastTimers = orderToastTimersRef.current; // chụp lại tham chiếu Map ngay lúc effect chạy

        const handleConnect = () => {
            setConnected(true);
            // join_admin có thể đã được gọi bởi trang admin khác trước đó — gọi
            // lại ở đây không sao, join 1 room đã ở trong là no-op phía Socket.IO.
            socket.emit("join_admin");
        };
        const handleDisconnect = () => setConnected(false);

        // Lọc bỏ phần tử null/undefined/sai kiểu ngay khi nhận — 1 đơn lỗi lẫn
        // trong mảng (do server race condition, DB write dở...) sẽ không còn
        // làm crash toàn bộ danh sách nữa.
        const handleOrdersState = (list) =>
            setOrders(Array.isArray(list) ? list.map(normalizeOnlineOrder).filter(Boolean) : []);
        const handleOrderCreated = (order) => {
            const normalized = normalizeOnlineOrder(order);
            if (!normalized || !normalized.id) return; // đơn lỗi từ server → bỏ qua thay vì crash toast
            const toastId = `${normalized.id}-${Date.now()}`;
            setOrderToasts((prev) => [...prev, { toastId, order: normalized }]);
            const timeoutId = setTimeout(() => dismissOrderToast(toastId), NEW_ORDER_TOAST_DURATION);
            orderToastTimers.set(toastId, timeoutId); // dùng biến local thay vì .current
        };

        const handleChatThreadsState = (list) =>
            setChatThreads(Array.isArray(list) ? list.map(normalizeChatThread).filter(Boolean) : []);
        const handleChatHistory = (history) =>
            setChatMessages(Array.isArray(history) ? history.map(normalizeChatMessage).filter(Boolean) : []);
        const handleCustomerChatMessage = (payload) => {
            const customerId = payload?.customerId;
            const message = normalizeChatMessage(payload?.message);
            if (!customerId || !message) return; // payload thiếu field quan trọng → bỏ qua an toàn
            if (activeChatCustomerIdRef.current === customerId) {
                setChatMessages((prev) => [...prev, message]);
                return;
            }
            if (message.from !== "customer") return; // chỉ toast tin khách gửi, không toast lại tin admin tự gửi
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
            orderToastTimers.forEach(clearTimeout); // dùng biến local, không đọc lại ref.current
            orderToastTimers.clear()
            clearTimeout(chatToastTimer.current);
        };
    }, [dismissOrderToast]);

    // Mở hộp thoại chat → cuộn xuống cuối + focus ô nhập
    useEffect(() => {
        if (activeChatCustomerId == null) return;
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        const t = setTimeout(() => chatInputRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [activeChatCustomerId]);

    useEffect(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }, [chatMessages.length]);

    // ─── Derived values ────────────────────────────────────────────────────────
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

    // Đơn mới về liên tiếp (2, 3, hay nhiều hơn) đều nằm đủ trong orderToasts —
    // chỉ giới hạn số toast HIỂN THỊ cùng lúc để không tràn màn hình trên
    // điện thoại; phần dư gộp vào 1 dòng tổng, vẫn bấm được để nhảy tới tab
    // đơn hàng. Toast nào tự hết 6s sẽ tự rời hàng đợi, không cần thao tác gì.
    const visibleOrderToasts = orderToasts.slice(0, MAX_VISIBLE_ORDER_TOASTS);
    const hiddenOrderToastCount = orderToasts.length - visibleOrderToasts.length;

    // ─── Hành động đơn hàng ────────────────────────────────────────────────────
    // Bước cuối (delivering → completed) mở modal thanh toán thay vì đổi
    // trạng thái ngay — các bước trước đó (pending/confirmed/preparing)
    // không liên quan tới tiền nên vẫn đổi thẳng như cũ.
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

    // ─── Xác nhận thanh toán (bước Hoàn thành) ─────────────────────────────────
    // Giống hệt handleCheckout của OrdersPage.jsx (bản tại bàn): tạo 1 Order
    // THẬT qua REST để lên chung báo cáo doanh thu, rồi mới báo server đổi
    // OnlineOrder sang "completed" kèm paymentMethod + id của Order vừa tạo.
    // OrderModel.orderItemSchema có sẵn field channel/customerName/
    // customerPhone/customerAddress ở TỪNG item — điền vào đây cho đúng thiết
    // kế đó (không đổi field ở cấp đơn).
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
            const res = await fetch(ORDERS_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const saved = await res.json();

            socketRef.current?.emit("admin_update_order_status", {
                orderId: checkoutTarget.id,
                status: "completed",
                paymentMethod: checkoutPayMethod,
                convertedOrderId: saved.order?._id,
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

    // ─── Hành động chat ────────────────────────────────────────────────────────
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

    // Bấm vào 1 toast đơn mới (hoặc dòng tổng "+N đơn khác") → nhảy thẳng tới
    // cột "Chờ xác nhận" của tab đơn hàng, vì đơn mới luôn bắt đầu ở đó.
    const goToNewOrders = useCallback(() => {
        setTab("orders");
        setOrdersView("active");
        setMobileStatusFilter("pending");
    }, []);

    // ─── Thẻ đơn hàng dùng chung cho các cột Kanban ────────────────────────────
    const renderOrderCard = (order) => {
        const showAdvanceButton = ORDER_CARD_ACTION_STATUSES.has(order.status);
        return (
        <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{order.customerName}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><Phone size={10} /> {order.phone}</p>
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{safeFmtDate(order.createdAt)}</span>
            </div>

            <p className="text-[11px] text-gray-400 flex items-start gap-1"><MapPin size={10} className="mt-0.5 shrink-0" /> {order.address}</p>

            <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
                {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                        <span className="text-gray-700 truncate">{item.foodName} × {item.quantity}</span>
                    </div>
                ))}
                {order.note && <p className="text-[10px] text-gray-400 pt-1 mt-1 border-t border-gray-200">Ghi chú: {order.note}</p>}
            </div>

            <div className="flex items-center justify-between">
                <span className="font-black text-sm text-green-600">{safeFmtVND(order.totalPrice)}</span>
            </div>

            <div className="flex gap-1.5">
                <button
                    onClick={() => openCancel(order)}
                    title="Huỷ đơn"
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                    <XCircle size={14} />
                </button>
                {showAdvanceButton && (
                    <Button className="flex-1 justify-center text-xs py-2" onClick={() => advanceStatus(order)}>
                        {NEXT_LABEL[order.status]}<ArrowRight size={13} />
                    </Button>
                )}
            </div>
        </div>
        );
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* Toast đơn online mới — hàng đợi, mỗi đơn 1 toast riêng, tự tắt
                độc lập. Đơn liên tiếp thứ 4+ gộp vào dòng tổng phía dưới để
                không tràn màn hình trên điện thoại. */}
            {orderToasts.length > 0 && (
                <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-xs">
                    {visibleOrderToasts.map(({ toastId, order }) => (
                        <button
                            key={toastId}
                            onClick={() => { goToNewOrders(); dismissOrderToast(toastId); }}
                            className="text-left bg-white border-2 border-green-300 rounded-2xl shadow-lg px-4 py-3.5 animate-fade-in"
                        >
                            <p className="text-xs font-bold text-green-600 mb-1 flex items-center gap-1.5">
                                <Bell size={13} /> Đơn online mới
                            </p>
                            <p className="text-sm font-bold text-gray-700 truncate">{order.customerName}</p>
                            <p className="text-xs text-gray-400">{safeFmtVND(order.totalPrice)} · {order.items.length} món</p>
                        </button>
                    ))}
                    {hiddenOrderToastCount > 0 && (
                        <button
                            onClick={goToNewOrders}
                            className="text-center bg-green-600 text-white rounded-2xl shadow-lg px-4 py-2.5 text-xs font-bold animate-fade-in"
                        >
                            +{hiddenOrderToastCount} đơn khác chờ xử lý
                        </button>
                    )}
                </div>
            )}

            {/* Toast tin nhắn chat mới */}
            {chatToast && (
                <button
                    onClick={() => { setTab("chat"); openChatThread(chatToast.customerId); setChatToast(null); }}
                    className="fixed top-4 left-4 sm:left-auto sm:right-4 sm:mt-24 z-40 text-left bg-white border border-green-200 rounded-xl shadow-lg px-3.5 py-2.5 max-w-[calc(100vw-2rem)] sm:max-w-xs animate-fade-in"
                >
                    <p className="text-[11px] font-bold text-green-600 mb-0.5 flex items-center gap-1">
                        <MessageCircle size={11} /> Tin nhắn mới
                    </p>
                    <p className="text-xs text-gray-700 line-clamp-2">{chatToast.message.text}</p>
                </button>
            )}

            {/* Toast kết quả thao tác (thanh toán...) — góc dưới-phải, tránh đè
                lên toast đơn mới/tin nhắn vốn đã chiếm góc trên */}
            {actionToast && (
                <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all
                    ${actionToast.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
                    {actionToast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-green-900">Đơn Online</h1>
                    <p className="text-gray-500 text-sm flex items-center gap-2">
                        {totalActive} đơn đang xử lý
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
                            ${connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {connected
                                ? <><Wifi size={11} /> Real-time</>
                                : <><WifiOff size={11} /> Mất kết nối</>}
                        </span>
                    </p>
                </div>
                <div className="flex gap-2">
                    {[["orders", `Đơn hàng${totalActive ? ` (${totalActive})` : ""}`], ["chat", `Tin nhắn${totalUnreadChat ? ` (${totalUnreadChat})` : ""}`]].map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all
                                ${tab === k ? "bg-green-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-green-50"}`}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "orders" ? (
                <div className="space-y-4">
                    {/* Thống kê nhanh */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl border border-gray-100 border-l-4 border-l-orange-400 p-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Đang xử lý</p>
                            <p className="text-2xl font-black text-gray-800 mt-1">{totalActive}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 border-l-4 border-l-green-500 p-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Hoàn thành hôm nay</p>
                            <p className="text-2xl font-black text-gray-800 mt-1">{todayCompleted.length}</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 border-l-4 border-l-green-500 p-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Doanh thu hôm nay</p>
                            <p className="text-2xl font-black text-green-600 mt-1">{safeFmtVND(todayRevenue)}</p>
                        </div>
                    </div>

                    {/* Sub-tabs: Đang xử lý / Lịch sử */}
                    <div className="flex gap-2">
                        {[["active", "Đang xử lý"], ["history", "Lịch sử"]].map(([k, l]) => (
                            <button key={k} onClick={() => setOrdersView(k)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all
                                    ${ordersView === k ? "bg-green-100 text-green-700" : "text-gray-500 hover:bg-gray-100"}`}>
                                {l}
                            </button>
                        ))}
                    </div>

                    {ordersView === "active" ? (
                        totalActive === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 text-center text-gray-400 py-16">
                                <ShoppingBag size={32} className="mx-auto mb-2 opacity-25" />
                                <p className="text-sm">Chưa có đơn online nào đang xử lý</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile (<md): xem 1 trạng thái tại 1 thời điểm — admin quản lý
                                    chủ yếu qua điện thoại nên 4 cột xếp chồng sẽ phải cuộn rất dài,
                                    thay bằng dải chip lọc + danh sách 1 cột dễ thao tác 1 tay hơn. */}
                                <div className="md:hidden space-y-3">
                                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                                        {ACTIVE_COLUMNS.map((col) => (
                                            <button key={col.status} onClick={() => setMobileStatusFilter(col.status)}
                                                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all
                                                    ${mobileStatusFilter === col.status ? "bg-green-500 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
                                                {col.label} ({activeByStatus[col.status].length})
                                            </button>
                                        ))}
                                    </div>
                                    <div className="space-y-3">
                                        {activeByStatus[mobileStatusFilter].length === 0 ? (
                                            <div className="bg-white rounded-2xl border border-gray-100 text-center text-gray-400 py-10 text-sm">Trống</div>
                                        ) : (
                                            activeByStatus[mobileStatusFilter].map(renderOrderCard)
                                        )}
                                    </div>
                                </div>

                                {/* Tablet/desktop (md+): Kanban đầy đủ 4 cột */}
                                <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                                    {ACTIVE_COLUMNS.map((col) => (
                                        <div key={col.status} className={`bg-gray-50 rounded-2xl border-l-4 ${col.accent} p-3 space-y-3`}>
                                            <div className="flex items-center justify-between px-1">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{col.label}</span>
                                                <span className="text-xs font-bold text-gray-400">{activeByStatus[col.status].length}</span>
                                            </div>
                                            <div className="space-y-3">
                                                {activeByStatus[col.status].length === 0 ? (
                                                    <p className="text-center text-gray-300 text-xs py-6">Trống</p>
                                                ) : (
                                                    activeByStatus[col.status].map(renderOrderCard)
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )
                    ) : (
                        <div className="space-y-3">
                            <div className="relative w-full sm:max-w-xs">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    placeholder="Tìm theo tên, SĐT, mã đơn..."
                                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                                />
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                {/* Mobile (<md): danh sách dạng thẻ — bảng cuộn ngang khó bấm 1 tay
                                    nên thay bằng danh sách hàng dọc, tap vào để xem chi tiết. */}
                                <div className="md:hidden divide-y divide-gray-50">
                                    {historyOrders.length === 0 ? (
                                        <div className="text-center py-12 text-gray-400 text-sm">Chưa có đơn nào trong lịch sử</div>
                                    ) : (
                                        historyOrders.map((order) => (
                                            <button
                                                key={order.id}
                                                onClick={() => setDetailOrder(order)}
                                                className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-green-50/40 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-700 text-sm truncate">{order.customerName}</p>
                                                    <p className="text-xs text-gray-400">{order.phone}</p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">{order.items.length} món · {safeFmtDate(order.createdAt)}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="font-bold text-green-600 text-sm">{safeFmtVND(order.totalPrice)}</p>
                                                    <div className="mt-1"><OnlineStatusBadge status={order.status} /></div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>

                                {/* Tablet/desktop (md+): bảng đầy đủ như cũ */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-green-50 border-b border-green-100">
                                                {["Khách hàng", "Món", "Trạng thái", "Tổng tiền", "Thời gian"].map((h, i) => (
                                                    <th key={i} className="px-4 py-3 text-left text-xs font-bold text-green-800 whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyOrders.map((order) => (
                                                <tr key={order.id}
                                                    onClick={() => setDetailOrder(order)}
                                                    className="border-t border-gray-50 hover:bg-green-50/40 transition-colors cursor-pointer">
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold text-gray-700">{order.customerName}</p>
                                                        <p className="text-xs text-gray-400">{order.phone}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1 min-w-[160px]">
                                                            {order.items.map((item, idx) => (
                                                                <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                                                                    <span className="text-gray-700 truncate">{item.foodName}</span>
                                                                    <span className="font-semibold text-green-600 whitespace-nowrap">×{item.quantity}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3"><OnlineStatusBadge status={order.status} /></td>
                                                    <td className="px-4 py-3 font-bold text-green-600 whitespace-nowrap">{safeFmtVND(order.totalPrice)}</td>
                                                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{safeFmtDate(order.createdAt)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {historyOrders.length === 0 && (
                                        <div className="text-center py-12 text-gray-400 text-sm">Chưa có đơn nào trong lịch sử</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* ── Tab: Tin nhắn ── */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                        {chatThreads.length === 0 ? (
                            <div className="text-center text-gray-400 py-16">
                                <MessageCircle size={32} className="mx-auto mb-2 opacity-25" />
                                <p className="text-sm">Chưa có khách nào nhắn tin</p>
                            </div>
                        ) : (
                            chatThreads.map((t) => (
                                <button
                                    key={t.customerId}
                                    onClick={() => openChatThread(t.customerId)}
                                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-green-50/50 transition-colors
                                        ${activeChatCustomerId === t.customerId ? "bg-green-50" : ""}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center shrink-0">
                                        {(t.customerName || "?").charAt(0).toUpperCase() || "?"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800 truncate">{t.customerName || shortCustomerLabel(t.customerId)}</p>
                                        {t.phone && (
                                            <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                                                <Phone size={9} /> {t.phone}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 truncate">{t.lastMessage}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className="text-[10px] text-gray-400">{safeFmtDate(t.lastAt)}</span>
                                        {t.unreadCount > 0 && (
                                            <span className="text-[10px] font-bold text-white bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                                                {t.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Panel chat cố định — chỉ hiện từ lg trở lên */}
                    <div className="hidden lg:flex bg-white rounded-2xl border border-gray-100 flex-col" style={{ minHeight: 480 }}>
                        {activeChatCustomerId ? (
                            <>
                                <div className="px-4 py-3.5 border-b border-gray-100">
                                    <h3 className="font-bold text-gray-800">{activeThread?.customerName || shortCustomerLabel(activeChatCustomerId)}</h3>
                                    {activeThread?.phone && (
                                        <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                            <Phone size={10} /> {activeThread.phone}
                                        </p>
                                    )}
                                </div>
                                {renderChatBody()}
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-8 text-center">
                                <div className="text-gray-400">
                                    <MessageCircle size={40} className="mx-auto mb-3 opacity-25" />
                                    <p className="font-semibold text-gray-500 text-sm">Chọn một hội thoại để bắt đầu</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Modal chat — mobile/tablet (dưới lg) ── */}
            <div className="lg:hidden">
                <Modal
                    open={!!activeChatCustomerId}
                    onClose={closeChatThread}
                    title={
                        activeThread?.customerName
                            ? `${activeThread.customerName}${activeThread.phone ? " · " + activeThread.phone : ""}`
                            : shortCustomerLabel(activeChatCustomerId || "")
                    }
                >
                    <div className="flex flex-col" style={{ height: 420 }}>
                        {renderChatBody()}
                    </div>
                </Modal>
            </div>

            {/* ── Modal chi tiết đơn (từ tab lịch sử) ── */}
            <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title={detailOrder?.customerName || ""}>
                {detailOrder && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <OnlineStatusBadge status={detailOrder.status} />
                            <span className="text-xs text-gray-400">{safeFmtDate(detailOrder.createdAt)}</span>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                            <p className="flex items-center gap-1.5"><Phone size={12} /> {detailOrder.phone}</p>
                            <p className="flex items-center gap-1.5"><MapPin size={12} /> {detailOrder.address}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                            {detailOrder.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-gray-700">{item.foodName} × {item.quantity}</span>
                                    <span className="font-semibold text-gray-600">{safeFmtVND(item.unitPrice * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                        {detailOrder.note && <p className="text-xs text-gray-500">Ghi chú: {detailOrder.note}</p>}
                        {detailOrder.status === "cancelled" && detailOrder.cancelReason && (
                            <p className="text-xs text-red-500">Lý do huỷ: {detailOrder.cancelReason}</p>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                            <span className="font-bold text-gray-700 text-sm">Tổng cộng</span>
                            <span className="font-black text-lg text-green-600">{safeFmtVND(detailOrder.totalPrice)}</span>
                        </div>
                        {chatThreads.some((t) => t.customerId === detailOrder.customerId) && (
                            <Button variant="outline" className="w-full justify-center"
                                onClick={() => { setDetailOrder(null); setTab("chat"); openChatThread(detailOrder.customerId); }}>
                                <MessageCircle size={14} />Xem trò chuyện với khách
                            </Button>
                        )}
                    </div>
                )}
            </Modal>

            {/* ── Modal xác nhận thanh toán (bước Hoàn thành) ── */}
            <Modal open={!!checkoutTarget} onClose={() => setCheckoutTarget(null)} title={`Thanh toán — ${checkoutTarget?.customerName || ""}`}>
                {checkoutTarget && (
                    <>
                        <div className="space-y-2 mb-5 bg-green-50 rounded-xl p-4">
                            {checkoutTarget.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-gray-700">
                                        {item.foodName} × {item.quantity}
                                    </span>
                                    <span className="font-semibold">{safeFmtVND(item.unitPrice * item.quantity)}</span>
                                </div>
                            ))}
                            <div className="border-t border-green-200 pt-2 mt-2 flex justify-between items-center">
                                <span className="font-bold text-gray-700">Tổng cộng</span>
                                <span className="font-black text-lg text-green-600">{safeFmtVND(checkoutTarget.totalPrice)}</span>
                            </div>
                        </div>

                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Phương thức thanh toán</p>
                        <div className="grid grid-cols-2 gap-2">
                            {PAYMENT_OPTIONS.map(([m, l]) => (
                                <button key={m} onClick={() => setCheckoutPayMethod(m)}
                                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-all
                                        ${checkoutPayMethod === m ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-green-200"}`}>
                                    {l}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-5">
                            <Button variant="outline" className="flex-1 justify-center" onClick={() => setCheckoutTarget(null)}>
                                Hủy
                            </Button>
                            <Button className="flex-1 justify-center" onClick={handleConfirmCheckout} disabled={checkoutLoading}>
                                {checkoutLoading ? (
                                    <span className="inline-flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Đang xử lý…
                                    </span>
                                ) : (
                                    <><Check size={15} />Xác nhận thanh toán</>
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </Modal>

            {/* ── Modal xác nhận huỷ đơn ── */}
            <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Huỷ đơn online?">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Đơn của <span className="font-semibold text-gray-800">{cancelTarget?.customerName}</span> sẽ được đánh dấu là đã huỷ. Bạn có chắc chắn không?
                    </p>
                    <input
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Lý do huỷ (tuỳ chọn)"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 justify-center" onClick={() => setCancelTarget(null)}>
                            Đóng
                        </Button>
                        <Button className="flex-1 justify-center bg-red-500 hover:bg-red-600" onClick={confirmCancel}>
                            <XCircle size={15} />Huỷ đơn
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );

    // ─── Nội dung khung chat — tái dùng cho cả panel desktop và Modal mobile ──
    function renderChatBody() {
        return (
            <>
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2 p-3">
                    {chatMessages.length === 0 ? (
                        <p className="text-gray-400 text-xs text-center py-10">Chưa có tin nhắn nào</p>
                    ) : (
                        chatMessages.map((m, idx) => (
                            <div key={m.id || idx} className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                                    ${m.from === "admin" ? "bg-green-500 text-white rounded-br-md" : "bg-gray-100 text-gray-700 rounded-bl-md"}`}>
                                    <p>{m.text}</p>
                                    <p className={`text-[10px] mt-1 ${m.from === "admin" ? "text-green-100" : "text-gray-400"}`}>
                                        {safeFmtDate(m.at instanceof Date ? m.at.toISOString() : m.at)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="flex items-center gap-2 p-3 border-t border-gray-100">
                    <input
                        ref={chatInputRef}
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChatReply()}
                        placeholder="Nhập tin nhắn trả lời..."
                        className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    <button
                        onClick={sendChatReply}
                        disabled={!chatDraft.trim()}
                        aria-label="Gửi"
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-green-500 text-white disabled:opacity-40 disabled:cursor-not-allowed active:bg-green-600">
                        <Send size={16} />
                    </button>
                </div>
            </>
        );
    }
}