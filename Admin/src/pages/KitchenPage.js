import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { Check, ChefHat, Flame, Wifi, WifiOff } from "lucide-react";
import { API_URL } from "../config/api";

// ─── Hằng số ──────────────────────────────────────────────────────────────────
const SOCKET_URL = API_URL;   // đổi nếu server khác host/port
const WARN_MINUTES = 5;    // chờ quá mốc này → vàng, cần chú ý
const URGENT_MINUTES = 10; // chờ quá mốc này → đỏ nhấp nháy, ưu tiên nấu ngay

// ─── Helpers ──────────────────────────────────────────────────────────────────
function urgencyOf(mins) {
    if (mins >= URGENT_MINUTES) return "urgent";
    if (mins >= WARN_MINUTES) return "warn";
    return "fresh";
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function KitchenPage() {
    // ── State ─────────────────────────────────────────────────────────────────
    const [connected, setConnected] = useState(false);
    const [queue, setQueue] = useState([]); // [{ tableId, tableName, items: [...] }]
    const [now, setNow] = useState(() => Date.now());
    const [toast, setToast] = useState(null); // { type, msg }
    const [doneFlash, setDoneFlash] = useState(() => new Set()); // foodId vừa bấm xong, để hiệu ứng mờ dần

    const socketRef = useRef(null);

    // ─── Toast helper ──────────────────────────────────────────────────────────
    const showToast = useCallback((type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 2800);
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
            socket.emit("join_kitchen");
        });

        socket.on("disconnect", () => setConnected(false));

        socket.on("kitchen_state", (data) => setQueue(data || []));

        return () => {
            socket.disconnect();
        };
    }, []);

    // Đồng hồ chờ — cập nhật mỗi 10s để giờ chờ + màu cảnh báo luôn sát thực tế
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(t);
    }, []);

    const waitMinutes = useCallback((confirmedAt) => {
        if (!confirmedAt) return 0;
        return Math.max(0, Math.floor((now - new Date(confirmedAt).getTime()) / 60000));
    }, [now]);

    // ─── Đánh dấu đã nấu xong ────────────────────────────────────────────────────
    const markReady = useCallback((tableId, foodId, tableName, foodName) => {
        const key = `${tableId}:${foodId}`;
        setDoneFlash((prev) => new Set(prev).add(key));
        socketRef.current?.emit("mark_item_ready", { tableId, foodId });
        showToast("success", `${foodName} — ${tableName} đã xong`);
    }, [showToast]);

    const markAllReady = useCallback((table) => {
        table.items.forEach((item) => {
            socketRef.current?.emit("mark_item_ready", { tableId: table.tableId, foodId: item.foodId });
        });
        showToast("success", `${table.tableName} — đã xong toàn bộ`);
    }, [showToast]);

    const totalDishes = queue.reduce((s, t) => s + t.items.reduce((a, i) => a + i.quantity, 0), 0);
    const urgentCount = queue.filter((t) =>
        t.items.some((i) => waitMinutes(i.confirmedAt) >= URGENT_MINUTES)
    ).length;

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
                    <h1 className="text-2xl font-black text-green-900">Nhà bếp</h1>
                    <p className="text-gray-500 text-sm flex items-center gap-2">
                        {totalDishes} món / {queue.length} bàn đang chờ
                        {urgentCount > 0 && (
                            <span className="text-red-500 font-bold">· {urgentCount} bàn cần ưu tiên</span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
                            ${connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {connected
                                ? <><Wifi size={11} /> Real-time</>
                                : <><WifiOff size={11} /> Mất kết nối</>}
                        </span>
                    </p>
                </div>
            </div>

            {/* Lưới phiếu order */}
            {queue.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center text-gray-400">
                    <ChefHat size={40} className="mx-auto mb-3 opacity-25" />
                    <p className="font-semibold text-gray-500">Bếp đang trống</p>
                    <p className="text-xs mt-1">Món admin xác nhận sẽ hiện tại đây</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {queue.map((t) => {
                        const oldestMins = t.items.length ? waitMinutes(t.items[0].confirmedAt) : 0;
                        const level = urgencyOf(oldestMins);
                        const style = URGENCY_STYLE[level];

                        return (
                            <div key={t.tableId}
                                className={`bg-white rounded-2xl border-2 overflow-hidden ${style.card} ${style.pulse ? "animate-pulse" : ""}`}>

                                {/* Vạch màu trạng thái ở đỉnh phiếu */}
                                <div className={`h-1.5 ${style.bar}`} />

                                {/* Header phiếu */}
                                <div className="px-4 pt-3 pb-2.5 flex items-center justify-between">
                                    <h3 className="font-black text-gray-800 text-lg flex items-center gap-1.5">
                                        {level === "urgent" && <Flame size={16} className="text-red-500" />}
                                        {t.tableName}
                                    </h3>
                                    <span className={`text-sm font-bold px-2.5 py-1 rounded-lg border ${style.badge}`}>
                                        {oldestMins} phút
                                    </span>
                                </div>

                                {/* Danh sách món */}
                                <div className="px-3 pb-3 space-y-1.5">
                                    {t.items.map((item) => {
                                        const mins = waitMinutes(item.confirmedAt);
                                        const itemLevel = urgencyOf(mins);
                                        const key = `${t.tableId}:${item.foodId}`;
                                        const isFlashing = doneFlash.has(key);
                                        return (
                                            <div key={item.foodId}
                                                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 bg-gray-50 transition-opacity
                                                    ${isFlashing ? "opacity-40" : "opacity-100"}`}>
                                                <span className="text-xl leading-none">{item.emoji}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-gray-700 truncate">
                                                        {item.foodName} <span className="text-gray-400">× {item.quantity}</span>
                                                    </p>
                                                    <p className={`text-[11px] ${itemLevel === "urgent" ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                                                        Chờ {mins} phút
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => markReady(t.tableId, item.foodId, t.tableName, item.foodName)}
                                                    disabled={isFlashing}
                                                    className="w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 active:scale-95 disabled:opacity-40 flex items-center justify-center text-white flex-shrink-0 transition-all">
                                                    <Check size={16} strokeWidth={3} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Hoàn thành cả phiếu */}
                                {t.items.length > 1 && (
                                    <button
                                        onClick={() => markAllReady(t)}
                                        className="w-full py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-t border-gray-100 transition-colors">
                                        Hoàn thành cả phiếu ({t.items.reduce((s, i) => s + i.quantity, 0)} món)
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}