import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import socket from "../utils/socket";
import Button from "../components/Button";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { Bell, Check, CheckCircle2, ChefHat, Flame, Lock, MessageCircle, Search, Send, Trash2, Wifi, WifiOff, X } from "lucide-react";
import fmtVND from "../utils/fmtVND";
import fmtDate from "../utils/fmtDate";
import { API_URL } from "../config/api";
import axios from "axios"

// ─── Hằng số ──────────────────────────────────────────────────────────────────
const TABLE_COUNT = 12;
const ORDERS_API_URL = `${API_URL}/api/orders`;
const CHAT_TOOLTIP_DURATION = 8000; // tooltip tự ẩn sau 8s nếu admin không bấm vào

const mkEmptyTable = (id) => ({
    id,
    name: `Bàn ${id}`,
    status: "empty",
    since: null,
    items: [],
    pendingItems: [],
    active: false, // mặc định khoá gọi món cho tới khi admin bật, khớp default ở DB
    chatEnabled: true, // mặc định mở tin nhắn, khớp default ở DB
    guestName: null, // tên khách nhập ở GuestInfoPage.jsx (phía khách) trước khi gọi món
    guestPhone: null, // SĐT khách, đủ 10 chữ số — hiện cùng tên trong hộp thoại chat
    messages: [],
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
    // const { currentUser, logout } = useAuthZustand();   // { _id, name, role: "admin" | "staff" }

    // ── State ─────────────────────────────────────────────────────────────────
    const [tables, setTables] = useState(() => Array.from({ length: TABLE_COUNT }, (_, i) => mkEmptyTable(i + 1)));
    const [connected, setConnected] = useState(false);
    const [tab, setTab] = useState("tables");
    const [selectedId, setSelectedId] = useState(null);
    const [selectedPending, setSelectedPending] = useState(() => new Set());
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [payMethod, setPayMethod] = useState("CASH");
    const [orders, setOrders] = useState([]);
    const [histSearch, setHistSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [toast, setToast] = useState(null); // { type, msg }

    const [paymentFilter, setPaymentFilter] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");

    // ── Chat theo bàn ────────────────────────────────────────────────────────
    const [chatOpenTableId, setChatOpenTableId] = useState(null);
    const [chatDraft, setChatDraft] = useState("");
    const [tooltips, setTooltips] = useState({}); // { [tableId]: message } — tin nhắn mới nhất chưa xem

    const socketRef = useRef(null);
    const chatScrollRef = useRef(null);
    const chatInputRef = useRef(null);
    const tooltipTimers = useRef({});
    const chatOpenTableIdRef = useRef(null); // để đọc trong socket handler mà không tạo lại effect
    const [clearChatConfirmOpen, setClearChatConfirmOpen] = useState(false);

    useEffect(() => {
        chatOpenTableIdRef.current = chatOpenTableId;
    }, [chatOpenTableId]);

    useEffect(() => {
        if (orders.length === 0) {
            getOrders();
        }
    }, [orders]);

    // ─── Toast helper ──────────────────────────────────────────────────────────
    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // ─── Socket setup ──────────────────────────────────────────────────────────
    // Dùng instance socket DÙNG CHUNG (import từ ../utils/socket) — không tự
    // io(...) ở đây nữa, để trang này và các trang khác (KitchenPage, trang
    // khách...) chia sẻ đúng 1 connection.
    useEffect(() => {
        socketRef.current = socket;
        const timers = tooltipTimers.current;

        const handleConnect = () => {
            setConnected(true);
            socket.emit("join_admin");
        };
        const handleDisconnect = () => setConnected(false);

        // Nhận toàn bộ state bàn từ server (đã gồm cả pendingItems, active, chatEnabled,
        // guestName, guestPhone, messages)
        const handleTablesState = (serverTables) => {
            setTables(serverTables.map((t) => ({
                ...t,
                active: t.active ?? false,
                chatEnabled: t.chatEnabled !== false,
                guestName: t.guestName || null,
                guestPhone: t.guestPhone || null,
                since: t.since ? new Date(t.since) : null,
                items: t.items || [],
                pendingItems: t.pendingItems || [],
                messages: t.messages || [],
            })));
        };

        // Tin nhắn mới (chat) — chỉ quan tâm tin từ khách để hiện tooltip/tín hiệu.
        // Nếu admin đang mở đúng hộp thoại của bàn đó thì coi như đã đọc luôn,
        // không cần hiện tooltip.
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

        // Socket dùng chung có thể ĐÃ connect từ trước (do một trang khác mở
        // lên trước trang này) — nếu vậy event "connect" sẽ không bắn lại,
        // nên cần tự đồng bộ state + join_admin ngay khi mount.
        if (socket.connected) {
            handleConnect();
        }

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("tables_state", handleTablesState);
        socket.on("chat_message", handleChatMessage);

        return () => {
            // Chỉ gỡ listener của riêng trang này. KHÔNG gọi socket.disconnect()
            // ở đây — socket này dùng chung cho cả app, disconnect sẽ làm
            // trang khác (hoặc lần mount lại của chính trang này) mất kết nối.
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

    // Mở hộp thoại chat → cuộn xuống cuối + focus ô nhập
    useEffect(() => {
        if (chatOpenTableId == null) return;
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        const t = setTimeout(() => chatInputRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [chatOpenTableId]);

    // ─── Derived values ────────────────────────────────────────────────────────
    const activeTable = selectedId != null ? tables.find((t) => t.id === selectedId) : null;
    const chatTable = chatOpenTableId != null ? tables.find((t) => t.id === chatOpenTableId) : null;
    const subtotal = activeTable?.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) ?? 0;
    const pendingSubtotal = activeTable?.pendingItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) ?? 0;
    const occupiedCount = tables.filter((t) => t.status === "occupied").length;

    // Tiêu đề hộp thoại chat: "Bàn 1 - Bình - 0123456789" nếu khách đã nhập
    // tên/SĐT ở GuestInfoPage.jsx, hoặc chỉ "Bàn 1" nếu chưa có (bàn vừa mở
    // lại sau thanh toán, khách chưa kịp nhập).
    const chatModalTitle = chatTable
        ? [chatTable.name, chatTable.guestName, chatTable.guestPhone].filter(Boolean).join(" - ")
        : "";

    // Tự cuộn xuống mỗi khi có tin nhắn mới trong bàn đang mở chat
    useEffect(() => {
        if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }, [chatTable?.messages?.length]);

    // ─── Xác nhận món đang chờ & gửi bếp ────────────────────────────────────────
    const togglePending = useCallback((itemId) => {
        setSelectedPending((prev) => {
            const next = new Set(prev);
            const key = String(itemId);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    const toggleSelectAllPending = useCallback(() => {
        if (!activeTable) return;
        setSelectedPending((prev) =>
            prev.size === activeTable.pendingItems.length
                ? new Set()
                : new Set(activeTable.pendingItems.map((i) => String(i.id)))
        );
    }, [activeTable]);

    const confirmItems = useCallback((pendingItemIds) => {
        if (!activeTable || !socketRef.current || pendingItemIds.length === 0) return;
        setConfirmLoading(true);
        socketRef.current.emit("confirm_items", { tableId: activeTable.id, pendingItemIds });
        setSelectedPending(new Set());
        showToast("success", `Đã xác nhận & gửi bếp cho ${activeTable.name}`);
        setTimeout(() => setConfirmLoading(false), 300);
    }, [activeTable, showToast]);

    // ─── Bật/tắt cho phép khách gọi món tại 1 bàn ──────────────────────────────
    const handleToggleActive = useCallback((table) => {
        if (!socketRef.current) return;
        socketRef.current.emit("toggle_table_active", { tableId: table.id, active: !table.active });
    }, []);

    // ─── Bật/tắt cho phép khách gửi tin nhắn tại 1 bàn ─────────────────────────
    const handleToggleChat = useCallback((table) => {
        if (!socketRef.current) return;
        const currentlyEnabled = table.chatEnabled !== false;
        socketRef.current.emit("toggle_table_chat", { tableId: table.id, chatEnabled: !currentlyEnabled });
    }, []);

    // ─── Chat theo bàn ─────────────────────────────────────────────────────────
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
        console.log("[clearChatHistory] called", { chatOpenTableId, hasSocket: !!socketRef.current });
        if (chatOpenTableId == null || !socketRef.current) return;
        socketRef.current.emit("clear_chat_messages", { tableId: chatOpenTableId });
        setClearChatConfirmOpen(false);
    }, [chatOpenTableId]);

    // ─── Lấy lịch sử đơn ───────────────────────────────────────────────────────
    function getOrders() {
        axios.get(ORDERS_API_URL)
            .then((response) => {
                setOrders(response.data);
            })
            .catch((error) => {
                console.error("Error fetching orders:", error);
            });
    }
    // ─── Thanh toán ────────────────────────────────────────────────────────────
    const handleCheckout = useCallback(async () => {
        if (!activeTable || !activeTable.items.length) return;
        setCheckoutLoading(true);

        const mergedForOrder = new Map();
        activeTable.items.forEach((i) => {
            const noteKey = i.note || "";
            const key = `${i.foodId}::${noteKey}`;
            const existing = mergedForOrder.get(key);
            if (existing) {
                existing.quantity += i.quantity;
            } else {
                mergedForOrder.set(key, { foodId: i.foodId, note: noteKey, quantity: i.quantity });
            }
        });

        const payload = {
            items: Array.from(mergedForOrder.values()),
            discountAmount: 0,
            paymentMethod: payMethod,
            isPaid: true,
            note: "",
            createdBy: "Admin", // thay bằng userId khi có auth #fix
        };

        try {
            const res = await fetch(ORDERS_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const saved = await res.json();

            setOrders((p) => [saved.order, ...p]);

            socketRef.current?.emit("checkout_table", { tableId: activeTable.id });

            setCheckoutOpen(false);
            setSelectedId(null);
            showToast("success", `Thanh toán ${activeTable.name} thành công! 🎉`);
        } catch (err) {
            console.error("[Checkout]", err);
            showToast("error", `Thanh toán thất bại: ${err.message}`);
        } finally {
            setCheckoutLoading(false);
        }
    }, [activeTable, payMethod, showToast]);

    // ─── Lịch sử đơn – lọc ────────────────────────────────────────────────────
    const filtHist = useMemo(() => {

        return orders.filter((o) => {

            const keyword =
                histSearch
                    .trim()
                    .toLowerCase();

            const matchSearch =
                !keyword ||
                o._id?.toLowerCase().includes(keyword) ||
                o.items?.some((i) => i.foodName?.toLowerCase().includes(keyword)) ||
                o.createdBy?.toLowerCase().includes(keyword);

            const matchStatus =
                !statusFilter ||
                o.status === statusFilter;

            const matchPayment =
                !paymentFilter ||
                o.paymentMethod === paymentFilter;

            const createdDate =
                new Date(o.createdAt);

            const matchDateFrom =
                !dateFrom ||
                createdDate >= new Date(dateFrom);

            const matchDateTo =
                !dateTo ||
                createdDate <= new Date(dateTo + "T23:59:59");

            const amount =
                Number(o.totalAmount || 0);

            const matchMinAmount =
                !minAmount ||
                amount >= Number(minAmount);

            const matchMaxAmount =
                !maxAmount ||
                amount <= Number(maxAmount);

            return (
                matchSearch &&
                matchStatus &&
                matchPayment &&
                matchDateFrom &&
                matchDateTo &&
                matchMinAmount &&
                matchMaxAmount
            );
        });

    }, [
        orders,
        histSearch,
        statusFilter,
        paymentFilter,
        dateFrom,
        dateTo,
        minAmount,
        maxAmount
    ]);

    // ─── Nội dung chi tiết bàn — tách riêng để tái dùng cho cả panel desktop
    // (bên phải, lg+) và Modal trên mobile, tránh lặp code 2 nơi. ─────────────
    const renderTableDetailBody = () => {
        if (!activeTable) return null;
        return (
            <>
                <div className="flex-1 p-3 overflow-y-auto space-y-4">
                    {activeTable.since && (
                        <p className="text-xs text-gray-400">
                            {fmtDate(activeTable.since instanceof Date
                                ? activeTable.since.toISOString()
                                : activeTable.since)}
                        </p>
                    )}

                    {/* Món chờ xác nhận */}
                    {activeTable.pendingItems.length > 0 && (
                        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-red-600 uppercase tracking-wide flex items-center gap-1.5">
                                    <Bell size={13} /> Cần xác nhận
                                </p>
                                <button onClick={toggleSelectAllPending} className="text-[11px] font-semibold text-red-500 hover:underline">
                                    {selectedPending.size === activeTable.pendingItems.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                </button>
                            </div>
                            <div className="space-y-1.5">
                                {activeTable.pendingItems.map((item) => (
                                    <label key={item.id} className="flex items-center gap-3.5 bg-white rounded-lg p-2 cursor-pointer">
                                        <input type="checkbox"
                                            checked={selectedPending.has(String(item.id))}
                                            onChange={() => togglePending(item.id)}
                                            className="w-4 h-4 accent-red-500" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-700 truncate">{item.foodName}</p>
                                            <p className="text-xs text-gray-400">{fmtVND(item.unitPrice)} × {item.quantity}</p>
                                        </div>
                                        {item.note && <p className="text-xs text-gray-500 mt-0.5">{item.note}</p>}
                                    </label>
                                ))}
                            </div>
                            <button
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-3"
                                disabled={selectedPending.size === 0 || confirmLoading}
                                onClick={() => confirmItems(Array.from(selectedPending))}>
                                <Check size={14} /> Xác nhận đã chọn ({selectedPending.size}) & gửi bếp
                            </button>
                            {activeTable.pendingItems.length > 1 && (
                                <button
                                    onClick={() => confirmItems(activeTable.pendingItems.map((i) => String(i.id)))}
                                    disabled={confirmLoading}
                                    className="w-full text-center text-xs font-semibold text-red-500 hover:underline mt-2">
                                    Xác nhận tất cả ({activeTable.pendingItems.length} món)
                                </button>
                            )}
                        </div>
                    )}

                    {/* Món đã xác nhận */}
                    {activeTable.items.length === 0 && activeTable.pendingItems.length === 0 ? (
                        <div className="text-center text-gray-400 py-10">
                            <ChefHat size={32} className="mx-auto mb-2 opacity-25" />
                            <p className="text-sm">Chưa có món nào</p>
                            <p className="text-xs mt-1">Khách gọi món sẽ hiện tại đây</p>
                        </div>
                    ) : activeTable.items.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Đã xác nhận</p>
                            <div className="space-y-2">
                                {activeTable.items.map((item, idx) => (
                                    <div key={item.id || idx} className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-700 truncate">{item.foodName}</p>
                                            <p className="text-xs text-gray-400">{fmtVND(item.unitPrice)} × {item.quantity}</p>
                                            {item.note && <p className="text-[11px] text-gray-400 mt-0.5">{item.note}</p>}
                                        </div>
                                        {item.status === "ready" ? (
                                            <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full whitespace-nowrap">
                                                <CheckCircle2 size={12} /> Sẵn sàng
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full whitespace-nowrap">
                                                <Flame size={12} /> Đang nấu
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tổng & Thanh toán */}
                <div className="p-4 border-t border-gray-100 bg-green-50/50 rounded-b-2xl">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-gray-700">Tổng cộng</span>
                        <span className="text-xl font-black text-green-600">{fmtVND(subtotal)}</span>
                    </div>
                    {pendingSubtotal > 0 && (
                        <p className="text-xs text-red-500 text-right mb-2">+ {fmtVND(pendingSubtotal)} đang chờ xác nhận</p>
                    )}
                    <Button className="w-full justify-center"
                        disabled={!activeTable.items.length || activeTable.pendingItems.length > 0}
                        onClick={() => setCheckoutOpen(true)}>
                        <Check size={15} />Thanh toán
                    </Button>
                    {activeTable.pendingItems.length > 0 && (
                        <p className="text-[11px] text-center text-gray-400 mt-1.5">Xác nhận hết món đang chờ trước khi thanh toán</p>
                    )}
                </div>
            </>
        );
    };

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* Toast (kết quả thao tác) — góc trên-phải */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all
                    ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
                    {toast.msg}
                </div>
            )}

            {/* Thông báo tin nhắn mới từ khách — góc trên-trái, xếp chồng theo bàn.
                Responsive: full-width (trừ lề) trên mobile, thu về khung cố định
                trên màn hình lớn. Đặt bên trái để không đè lên toast phía trên. */}
            {Object.keys(tooltips).length > 0 && (
                <div className="fixed top-4 left-4 right-4 sm:right-auto sm:w-72 z-40 flex flex-col gap-2">
                    {Object.entries(tooltips).map(([tableIdKey, msg]) => {
                        const tableId = Number(tableIdKey);
                        const t = tables.find((tb) => tb.id === tableId);
                        return (
                            <button
                                key={tableIdKey}
                                onClick={() => openChat(tableId)}
                                className="text-left bg-white border border-green-200 rounded-xl shadow-lg px-3.5 py-2.5 animate-fade-in"
                            >
                                <p className="text-[11px] font-bold text-green-600 mb-0.5 flex items-center gap-1">
                                    <MessageCircle size={11} /> {t?.name || `Bàn ${tableId}`} nhắn tin
                                </p>
                                <p className="text-xs text-gray-700 line-clamp-2">{msg.text}</p>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-green-900">Quản lý Order</h1>
                    <p className="text-gray-500 text-sm flex items-center gap-2">
                        {occupiedCount}/{TABLE_COUNT} bàn đang có khách
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
                            ${connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {connected
                                ? <><Wifi size={11} /> Real-time</>
                                : <><WifiOff size={11} /> Mất kết nối</>}
                        </span>
                    </p>
                </div>
                <div className="flex gap-2">
                    {[["tables", "Sơ đồ bàn"], ["history", "Lịch sử đơn"]].map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all
                                ${tab === k ? "bg-green-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-green-50"}`}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab: Sơ đồ bàn ── */}
            {tab === "tables" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Danh sách bàn */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {tables.map((t) => {
                                const tSub = t.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                                const isSelected = t.id === selectedId;
                                const hasPending = t.pendingItems?.length > 0;
                                const hasUnreadChat = (t.messages || []).some((m) => m.from === "guest" && !m.read);
                                return (
                                    <div key={t.id} className="relative group">
                                        <button
                                            onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                                            className={`w-full h-full relative rounded-2xl p-4 text-center transition-all border-2
        ${isSelected ? "border-green-500 bg-green-50"
                                                    : t.status === "occupied" ? "border-orange-200 bg-orange-50 hover:border-orange-300"
                                                        : "border-gray-100 bg-white hover:border-green-200 hover:bg-green-50"}
        ${!t.active ? "opacity-60" : ""}`}>
                                            {hasPending && (
                                                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white" />
                                                </span>
                                            )}
                                            <div className={`text-3xl mb-1.5 ${t.status === "empty" ? "opacity-25" : ""}`}>🪑</div>
                                            <p className="font-bold text-sm text-gray-700">{t.name}</p>
                                            {t.guestName && (
                                                <p className="text-[10px] text-gray-400 truncate">{t.guestName}</p>
                                            )}
                                            {t.status === "occupied" ? (
                                                <div className="mt-1">
                                                    <p className="text-xs font-bold text-orange-600">{t.items.reduce((s, i) => s + i.quantity, 0)} món</p>
                                                    <p className="text-xs text-orange-500 mt-0.5">{fmtVND(tSub)}</p>
                                                </div>
                                            ) : <p className="text-xs text-gray-400 mt-1">Trống</p>}
                                            {hasPending && (
                                                <p className="text-[11px] text-red-500 font-bold mt-0.5">{t.pendingItems.length} món chờ xác nhận</p>
                                            )}
                                            {!t.active && (
                                                <p className="text-[10px] font-bold text-gray-400 mt-1 flex items-center justify-center gap-1">
                                                    <Lock size={9} /> Chưa mở gọi món
                                                </p>
                                            )}
                                        </button>

                                        {/* Toggle bật/tắt cho khách gọi món tại bàn này. */}
                                        <label
                                            onClick={(e) => e.stopPropagation()}
                                            title={t.active ? "Đang mở gọi món — nhấn để khoá" : "Đang khoá — nhấn để mở gọi món"}
                                            className="absolute top-1.5 left-1.5 z-10 inline-flex items-center cursor-pointer
                                                opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100
                                                transition-opacity duration-150"
                                        >
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={!!t.active}
                                                onChange={() => handleToggleActive(t)}
                                            />
                                            <div className="w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors relative shadow-sm">
                                                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                                            </div>
                                        </label>

                                        {/* Cụm nút góc dưới-phải: toggle bật/tắt tin nhắn + icon mở chat.
                                            Toggle luôn hiện trên mobile (chạm được ngay), chỉ ẩn/hiện theo
                                            hover trên màn hình lớn — cùng kiểu với toggle "mở gọi món". */}
                                        <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1">
                                            <label
                                                onClick={(e) => e.stopPropagation()}
                                                title={t.chatEnabled !== false ? "Đang mở tin nhắn — nhấn để tắt" : "Đang tắt tin nhắn — nhấn để mở"}
                                                className="inline-flex items-center cursor-pointer
                                                    opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100
                                                    transition-opacity duration-150"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={t.chatEnabled !== false}
                                                    onChange={() => handleToggleChat(t)}
                                                />
                                                {/* <div className="w-7 h-4 bg-gray-300 rounded-full peer-checked:bg-blue-500 transition-colors relative shadow-sm">
                                                    <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform peer-checked:translate-x-3" />
                                                </div> */}
                                            </label>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); openChat(t.id); }}
                                                title="Nhắn tin với bàn này"
                                                aria-label={`Chat với ${t.name}`}
                                                className="relative w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm
                                                    flex items-center justify-center text-gray-500 hover:text-green-600 hover:border-green-300 transition-colors"
                                            >
                                                <MessageCircle size={14} className={t.chatEnabled === false ? "opacity-40" : ""} />
                                                {hasUnreadChat && (
                                                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white" />
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Chú thích */}
                        <div className="flex gap-4 text-xs text-gray-500 bg-white rounded-xl px-4 py-3 border border-gray-100 flex-wrap">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-gray-200 bg-white inline-block" />Trống</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-orange-200 bg-orange-50 inline-block" />Có khách</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-50 inline-block" />Đang chọn</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Có món chờ xác nhận / tin nhắn chưa đọc</span>
                            <span className="flex items-center gap-1.5"><Lock size={11} className="text-gray-400" />Chưa mở gọi món — hover/chạm góc trái bàn để bật</span>
                            <span className="flex items-center gap-1.5"><MessageCircle size={11} className="text-gray-400" />Chat với bàn — góc phải dưới, có toggle bật/tắt cạnh icon</span>
                        </div>
                    </div>

                    {/* Chi tiết bàn được chọn — panel cố định, chỉ hiện từ lg trở lên.
                        Dưới lg xem qua Modal (bên dưới). */}
                    <div className="hidden lg:flex bg-white rounded-2xl border border-gray-100 flex-col" style={{ minHeight: 480 }}>
                        {activeTable ? (
                            <>
                                <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-800">{activeTable.name}</h3>
                                        {(activeTable.guestName || activeTable.guestPhone) && (
                                            <p className="text-xs text-gray-400 truncate">
                                                {[activeTable.guestName, activeTable.guestPhone].filter(Boolean).join(" - ")}
                                            </p>
                                        )}
                                    </div>
                                    <button onClick={() => setSelectedId(null)}
                                        className="text-gray-400 hover:text-gray-600 w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center shrink-0">
                                        <X size={16} />
                                    </button>
                                </div>
                                {renderTableDetailBody()}
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center p-8 text-center">
                                <div className="text-gray-400">
                                    <div className="text-5xl mb-3">🪑</div>
                                    <p className="font-semibold text-gray-500 text-sm">Chọn một bàn để bắt đầu</p>
                                    <p className="text-xs mt-1">Bàn màu cam đang có khách</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            ) : (
                /* ── Tab: Lịch sử đơn ── */
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-4 border border-gray-100">
                        <div className="flex flex-wrap gap-3">

                            {/* Search */}
                            <div className="relative flex-1 min-w-44">
                                <Search
                                    size={14}
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                                />

                                <input
                                    value={histSearch}
                                    onChange={(e) =>
                                        setHistSearch(e.target.value)
                                    }
                                    placeholder="Tìm theo mã đơn, tên món..."
                                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                                />
                            </div>

                            {/* Status */}
                            <select
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value)
                                }
                                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            >
                                <option value="">Tất cả trạng thái</option>
                                <option value="PENDING">Chờ</option>
                                <option value="PROCESSING">Đang làm</option>
                                <option value="COMPLETED">Hoàn thành</option>
                                <option value="CANCELLED">Đã hủy</option>
                            </select>

                            {/* Payment */}
                            <select
                                value={paymentFilter}
                                onChange={(e) =>
                                    setPaymentFilter(e.target.value)
                                }
                                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            >
                                <option value="">Tất cả PTTT</option>
                                <option value="CASH">Tiền mặt</option>
                                <option value="BANKING">Chuyển khoản</option>
                                <option value="MOMO">MoMo</option>
                                <option value="ZALOPAY">ZaloPay</option>
                            </select>

                            {/* Date from */}
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) =>
                                    setDateFrom(e.target.value)
                                }
                                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            />

                            {/* Date to */}
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) =>
                                    setDateTo(e.target.value)
                                }
                                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            />

                            {/* Min amount */}
                            <input
                                type="number"
                                value={minAmount}
                                onChange={(e) =>
                                    setMinAmount(e.target.value)
                                }
                                placeholder="Tiền từ"
                                className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            />

                            {/* Max amount */}
                            <input
                                type="number"
                                value={maxAmount}
                                onChange={(e) =>
                                    setMaxAmount(e.target.value)
                                }
                                placeholder="Tiền đến"
                                className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-green-50 border-b border-green-100">
                                        {["Mã đơn", "Món", "Trạng thái", "Tổng tiền", "PTTT", "Thời gian", "Người tạo"].map((h, i) => (
                                            <th key={i} className="px-4 py-3 text-left text-xs font-bold text-green-800 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtHist.slice(0, 50).map((ord) => (
                                        <tr key={ord._id} style={{ borderBottom: "1px solid black" }} className="border-t border-gray-50 hover:bg-green-50/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-gray-600">{ord._id}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1 min-w-[160px]">
                                                    {ord.items.map((item, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between gap-3 text-xs"
                                                        >
                                                            <span className="text-gray-700 truncate">
                                                                {item.foodName}
                                                            </span>
                                                            <span className="font-semibold text-green-600 whitespace-nowrap">
                                                                ×{item.quantity}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><StatusBadge status={ord.status} /></td>
                                            <td className="px-4 py-3 font-bold text-green-600 text-left whitespace-nowrap">{fmtVND(ord.totalAmount)}</td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{ord.paymentMethod}</td>
                                            <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(ord.createdAt)}</td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{ord.createdBy || "Admin"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filtHist.length === 0 && (
                                <div className="text-center py-12 text-gray-400 text-sm">Không có đơn nào phù hợp</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal chi tiết bàn — chỉ dùng dưới lg (mobile/tablet), thay cho
                panel cố định bên phải. Cùng nội dung với panel desktop qua
                renderTableDetailBody() để không lặp code. ── */}
            <div className="lg:hidden">
                <Modal open={!!activeTable} onClose={() => setSelectedId(null)} title={activeTable?.name || ""}>
                    {activeTable && (
                        <div className="flex flex-col" style={{ maxHeight: "75vh" }}>
                            {renderTableDetailBody()}
                        </div>
                    )}
                </Modal>
            </div>

            {/* ── Modal thanh toán ── */}
            <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={`Thanh toán — ${activeTable?.name}`}>
                {activeTable && (
                    <>
                        <div className="space-y-2 mb-5 bg-green-50 rounded-xl p-4">
                            {activeTable.items.map((item, idx) => (
                                <div key={`${item.foodId}-${idx}`} className="flex justify-between text-sm">
                                    <span className="text-gray-700">
                                        {item.foodName} × {item.quantity}
                                        {item.note && <span className="block text-[11px] text-gray-400">{item.note}</span>}
                                    </span>
                                    <span className="font-semibold">{fmtVND(item.unitPrice * item.quantity)}</span>
                                </div>
                            ))}
                            <div className="border-t border-green-200 pt-2 mt-2 flex justify-between items-center">
                                <span className="font-bold text-gray-700">Tổng cộng</span>
                                <span className="font-black text-lg text-green-600">{fmtVND(subtotal)}</span>
                            </div>
                        </div>

                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Phương thức thanh toán</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[["CASH", "💵 Tiền mặt"], ["BANKING", "🏦 Chuyển khoản"], ["MOMO", "🟣 MoMo"], ["ZALOPAY", "🔵 ZaloPay"]].map(([m, l]) => (
                                <button key={m} onClick={() => setPayMethod(m)}
                                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-all
                                        ${payMethod === m ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-green-200"}`}>
                                    {l}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-5">
                            <Button variant="outline" className="flex-1 justify-center" onClick={() => setCheckoutOpen(false)}>
                                Hủy
                            </Button>
                            <Button className="flex-1 justify-center" onClick={handleCheckout} disabled={checkoutLoading}>
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

            {/* ── Modal chat theo bàn ── */}
            <Modal open={chatOpenTableId != null} onClose={closeChat} title={chatModalTitle}>
                {chatTable && (
                    <div className="flex flex-col" style={{ height: 420 }}>
                        {/* Thanh hành động — nút xoá lịch sử */}
                        {chatTable.messages?.length > 0 && (
                            <div className="flex justify-end mb-2">
                                <button

                                    onClick={() => { console.log("[open confirm modal] clicked"); setClearChatConfirmOpen(true) }}
                                    className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={13} /> Xoá lịch sử
                                </button>
                            </div>
                        )}

                        <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
                            {(!chatTable.messages || chatTable.messages.length === 0) ? (
                                <p className="text-gray-400 text-xs text-center py-10">Chưa có tin nhắn nào với {chatTable.name}</p>
                            ) : (
                                chatTable.messages.map((m, idx) => (
                                    <div key={m.id || idx} className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                                ${m.from === "admin" ? "bg-green-500 text-white rounded-br-md" : "bg-gray-100 text-gray-700 rounded-bl-md"}`}>
                                            <p>{m.text}</p>
                                            <p className={`text-[10px] mt-1 ${m.from === "admin" ? "text-green-100" : "text-gray-400"}`}>
                                                {fmtDate(m.at instanceof Date ? m.at.toISOString() : m.at)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
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
                    </div>
                )}
            </Modal>

            {/* ── Modal xác nhận xoá lịch sử chat ── */}
            <Modal open={clearChatConfirmOpen} onClose={() => setClearChatConfirmOpen(false)} title="Xoá lịch sử tin nhắn?">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Toàn bộ tin nhắn giữa admin và <span className="font-semibold text-gray-800">{chatTable?.name}</span> sẽ bị xoá vĩnh viễn. Bạn có chắc chắn không?
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 justify-center" onClick={() => setClearChatConfirmOpen(false)}>
                            Huỷ
                        </Button>
                        <Button className="flex-1 justify-center bg-red-500 hover:bg-red-600" onClick={clearChatHistory}>
                            <Trash2 size={15} />Xoá
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}