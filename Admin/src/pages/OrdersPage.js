import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import Button from "../components/Button";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { Bell, Check, CheckCircle2, ChefHat, Flame, Lock, Search, Wifi, WifiOff, X } from "lucide-react";
import fmtVND from "../utils/fmtVND";
import fmtDate from "../utils/fmtDate";
import { API_URL } from "../config/api";
import axios from "axios"

// ─── Hằng số ──────────────────────────────────────────────────────────────────
const TABLE_COUNT = 12;
const SOCKET_URL = `${API_URL}`;   // đổi nếu server khác host/port
const ORDERS_API_URL = `${API_URL}/api/orders`;

const mkEmptyTable = (id) => ({
    id,
    name: `Bàn ${id}`,
    status: "empty",
    since: null,
    items: [],
    pendingItems: [],
    active: false, // mặc định khoá gọi món cho tới khi admin bật, khớp default ở DB
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

    const socketRef = useRef(null);

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
    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ["websocket"],
            reconnectionAttempts: 10,
            reconnectionDelay: 1500,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            setConnected(true);
            socket.emit("join_admin");
        });

        socket.on("disconnect", () => setConnected(false));

        // Nhận toàn bộ state bàn từ server (đã gồm cả pendingItems và active)
        socket.on("tables_state", (serverTables) => {
            setTables(serverTables.map((t) => ({
                ...t,
                active: t.active ?? false,
                since: t.since ? new Date(t.since) : null,
                items: t.items || [],
                pendingItems: t.pendingItems || [],
            })));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Đổi bàn đang chọn → bỏ chọn hết checkbox món chờ xác nhận của bàn cũ
    useEffect(() => {
        setSelectedPending(new Set());
    }, [selectedId]);

    // ─── Derived values ────────────────────────────────────────────────────────
    const activeTable = selectedId != null ? tables.find((t) => t.id === selectedId) : null;
    const subtotal = activeTable?.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) ?? 0;
    const pendingSubtotal = activeTable?.pendingItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0) ?? 0;
    const occupiedCount = tables.filter((t) => t.status === "occupied").length;

    // ─── Xác nhận món đang chờ & gửi bếp ────────────────────────────────────────
    const togglePending = useCallback((foodId) => {
        setSelectedPending((prev) => {
            const next = new Set(prev);
            const key = String(foodId);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    const toggleSelectAllPending = useCallback(() => {
        if (!activeTable) return;
        setSelectedPending((prev) =>
            prev.size === activeTable.pendingItems.length
                ? new Set()
                : new Set(activeTable.pendingItems.map((i) => String(i.foodId)))
        );
    }, [activeTable]);

    const confirmItems = useCallback((foodIds) => {
        if (!activeTable || !socketRef.current || foodIds.length === 0) return;
        setConfirmLoading(true);
        socketRef.current.emit("confirm_items", { tableId: activeTable.id, foodIds });
        setSelectedPending(new Set());
        showToast("success", `Đã xác nhận & gửi bếp cho ${activeTable.name}`);
        setTimeout(() => setConfirmLoading(false), 300);
    }, [activeTable, showToast]);

    // ─── Bật/tắt cho phép khách gọi món tại 1 bàn ──────────────────────────────
    // Đây là công tắc riêng biệt với status "occupied/empty" — dùng để
    // khoá/mở trang OrderPage.jsx phía khách theo từng bàn. Đồng bộ realtime
    // 2 chiều qua socket "toggle_table_active".
    const handleToggleActive = useCallback((table) => {
        if (!socketRef.current) return;
        socketRef.current.emit("toggle_table_active", { tableId: table.id, active: !table.active });
    }, []);

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

        // Gộp lại theo foodId trước khi gửi — vì cùng 1 món có thể tồn tại
        // thành 2 dòng riêng (vd 1 dòng "cooking" + 1 dòng "ready") sau khi
        // đi qua bước xác nhận nhiều lần.
        const mergedForOrder = new Map();
        activeTable.items.forEach((i) => {
            const key = String(i.foodId);
            mergedForOrder.set(key, (mergedForOrder.get(key) || 0) + i.quantity);
        });

        const payload = {
            items: Array.from(mergedForOrder, ([foodId, quantity]) => ({ foodId, quantity })),
            discountAmount: 0,
            paymentMethod: payMethod,
            isPaid: true,
            note: "",
            createdBy: "Admin", // thay bằng userId khi có auth
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

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all
                    ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
                    {toast.msg}
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
                                return (
                                    <div key={t.id} className="relative group">
                                        <button
                                            onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                                            className={`w-full relative rounded-2xl p-4 text-center transition-all border-2
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

                                        {/* Toggle bật/tắt cho khách gọi món tại bàn này.
                                            Desktop (>= sm): ẩn mặc định, hiện khi hover vào card (group-hover).
                                            Mobile (< sm): luôn hiện sẵn dạng slider để chạm trực tiếp. */}
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
                                    </div>
                                );
                            })}
                        </div>

                        {/* Chú thích */}
                        <div className="flex gap-4 text-xs text-gray-500 bg-white rounded-xl px-4 py-3 border border-gray-100 flex-wrap">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-gray-200 bg-white inline-block" />Trống</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-orange-200 bg-orange-50 inline-block" />Có khách</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-50 inline-block" />Đang chọn</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Có món chờ xác nhận</span>
                            <span className="flex items-center gap-1.5"><Lock size={11} className="text-gray-400" />Chưa mở gọi món — hover/chạm góc trái bàn để bật</span>
                        </div>
                    </div>

                    {/* Chi tiết bàn được chọn */}
                    <div className="bg-white rounded-2xl border border-gray-100 flex flex-col" style={{ minHeight: 480 }}>
                        {activeTable ? (
                            <>
                                {/* Header bàn */}
                                <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-gray-800">{activeTable.name}</h3>
                                        {activeTable.since && (
                                            <p className="text-xs text-gray-400">
                                                {fmtDate(activeTable.since instanceof Date
                                                    ? activeTable.since.toISOString()
                                                    : activeTable.since)}
                                            </p>
                                        )}
                                    </div>
                                    <button onClick={() => setSelectedId(null)}
                                        className="text-gray-400 hover:text-gray-600 w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center">
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="flex-1 p-3 overflow-y-auto space-y-4">

                                    {/* Món chờ xác nhận */}
                                    {activeTable.pendingItems.length > 0 && (
                                        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-bold text-red-600 uppercase tracking-wide flex items-center gap-1.5">
                                                    <Bell size={13} /> Khách vừa gọi — cần xác nhận
                                                </p>
                                                <button onClick={toggleSelectAllPending} className="text-[11px] font-semibold text-red-500 hover:underline">
                                                    {selectedPending.size === activeTable.pendingItems.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                                </button>
                                            </div>
                                            <div className="space-y-1.5">
                                                {activeTable.pendingItems.map((item) => (
                                                    <label key={item.foodId} className="flex items-center gap-2.5 bg-white rounded-lg p-2 cursor-pointer">
                                                        <input type="checkbox"
                                                            checked={selectedPending.has(String(item.foodId))}
                                                            onChange={() => togglePending(item.foodId)}
                                                            className="w-4 h-4 accent-red-500" />
                                                        <span className="text-lg">{item.emoji}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-gray-700 truncate">{item.foodName}</p>
                                                            <p className="text-xs text-gray-400">{fmtVND(item.unitPrice)} × {item.quantity}</p>
                                                        </div>
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
                                                    onClick={() => confirmItems(activeTable.pendingItems.map((i) => String(i.foodId)))}
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
                                                    <div key={`${item.foodId}-${item.status}-${idx}`} className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-2.5">
                                                        <span className="text-xl">{item.emoji}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-gray-700 truncate">{item.foodName}</p>
                                                            <p className="text-xs text-gray-400">{fmtVND(item.unitPrice)} × {item.quantity}</p>
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

            {/* ── Modal thanh toán ── */}
            <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={`Thanh toán — ${activeTable?.name}`}>
                {activeTable && (
                    <>
                        <div className="space-y-2 mb-5 bg-green-50 rounded-xl p-4">
                            {activeTable.items.map((item, idx) => (
                                <div key={`${item.foodId}-${idx}`} className="flex justify-between text-sm">
                                    <span className="text-gray-700">{item.emoji} {item.foodName} × {item.quantity}</span>
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
        </div>
    );
}