import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
    RefreshCw,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    TrendingUp,
    Receipt,
    Wallet,
    Users,
    Percent,
    ChevronRight,
} from "lucide-react";

import { API_URL } from "../config/api";
// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = `${API_URL}/api`;

function fmt(value) {
    return new Intl.NumberFormat("vi-VN").format(Math.round(value || 0)) + "đ";
}

function pct(value, decimals = 1) {
    return (value ?? 0).toFixed(decimals) + "%";
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconBg, label, value, sub }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
            <div className={`${iconBg} p-3 rounded-xl flex-shrink-0`}>
                <Icon size={20} className="text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── CashFlow ─────────────────────────────────────────────────────────────────

export default function CashFlow() {
    const [days, setDays] = useState(7);

    // Remote data
    const [foodWeights, setFoodWeights] = useState([]);
    const [compositeMargin, setCompositeMargin] = useState(0);
    const [avgBillValue, setAvgBillValue] = useState(80000);
    const [loadingFetch, setLoadingFetch] = useState(false);
    const [loadingUpdate, setLoadingUpdate] = useState(false);
    const [updateMsg, setUpdateMsg] = useState("");

    // Revenue estimation
    const [customers, setCustomers] = useState("");

    // Maintenance costs
    const [costs, setCosts] = useState([]);
    const [newName, setNewName] = useState("");
    const [newValue, setNewValue] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editValue, setEditValue] = useState("");

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchAll = useCallback(async () => {
        setLoadingFetch(true);
        try {
            const [wRes, mRes, bRes] = await Promise.all([
                axios.get(`${API_BASE}/analyst/food-weights?days=${days}`),
                axios.get(`${API_BASE}/analyst/margin?days=${days}`),
                axios.get(`${API_BASE}/analyst/avg-bill-value?days=${days}`),
            ]);

            const sorted = [...(wRes.data.weights ?? [])].sort(
                (a, b) => b.aiTrainingWeight - a.aiTrainingWeight
            );
            setFoodWeights(sorted);
            setCompositeMargin(mRes.data.compositeMarginPercent ?? 0);
            if (bRes.data.avgBillValue) setAvgBillValue(bRes.data.avgBillValue);
        } catch (err) {
            console.error("CashFlow fetchAll:", err);
        } finally {
            setLoadingFetch(false);
        }
    }, [days]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Update weights ───────────────────────────────────────────────────────

    const handleUpdateWeights = async () => {
        setLoadingUpdate(true);
        setUpdateMsg("");
        try {
            const res = await axios.get(
                `${API_BASE}/analyst/food-weights?days=${days}`
            );
            setUpdateMsg(`Đã cập nhật ${res.data.updatedCount ?? 0} món`);
            await fetchAll();
        } catch (err) {
            console.error("CashFlow updateWeights:", err);
            setUpdateMsg("Cập nhật thất bại");
        } finally {
            setLoadingUpdate(false);
            setTimeout(() => setUpdateMsg(""), 3000);
        }
    };

    // ── Derived numbers ──────────────────────────────────────────────────────

    const numCustomers = parseInt(customers) || 0;
    const revenue = avgBillValue * numCustomers;
    const tax = revenue * 0.045;
    const totalMaintenance = costs.reduce((s, c) => s + (parseFloat(c.value) || 0), 0);
    const estimatedProfit = revenue - tax - totalMaintenance;

    // ── Maintenance CRUD ─────────────────────────────────────────────────────

    const addCost = () => {
        if (!newName.trim() || !newValue) return;
        setCosts((prev) => [
            ...prev,
            { id: Date.now(), name: newName.trim(), value: parseFloat(newValue) || 0 },
        ]);
        setNewName("");
        setNewValue("");
    };

    const deleteCost = (id) => setCosts((prev) => prev.filter((c) => c.id !== id));

    const startEdit = (cost) => {
        setEditingId(cost.id);
        setEditName(cost.name);
        setEditValue(String(cost.value));
    };

    const saveEdit = () => {
        setCosts((prev) =>
            prev.map((c) =>
                c.id === editingId
                    ? { ...c, name: editName.trim(), value: parseFloat(editValue) || 0 }
                    : c
            )
        );
        setEditingId(null);
    };

    const costRatio = (val) =>
        totalMaintenance > 0 ? pct((val / totalMaintenance) * 100) : "—";

    // ────────────────────────────────────────────────────────────────────────

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dòng tiền</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Phân tích tài chính & ước tính doanh thu
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Days selector */}
                    <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {[7, 14, 21, 30].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${
                                    days === d
                                        ? "bg-green-600 text-white"
                                        : "text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                                {d}N
                            </button>
                        ))}
                    </div>

                    {/* Update button */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleUpdateWeights}
                            disabled={loadingUpdate || loadingFetch}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60 shadow-sm"
                        >
                            <RefreshCw
                                size={15}
                                className={loadingUpdate ? "animate-spin" : ""}
                            />
                            Cập nhật trọng số
                        </button>
                        {updateMsg && (
                            <span className="text-xs text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                {updateMsg}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Food Weights ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">
                            Trọng số món ăn
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Xếp hạng mức đóng góp vào doanh thu
                        </p>
                    </div>
                    {loadingFetch && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <RefreshCw size={12} className="animate-spin" />
                            Đang tải...
                        </span>
                    )}
                </div>

                {foodWeights.length === 0 && !loadingFetch ? (
                    <div className="py-12 text-center">
                        <p className="text-sm text-gray-400">
                            Chưa có dữ liệu — nhấn{" "}
                            <span className="font-medium text-green-600">
                                Cập nhật trọng số
                            </span>{" "}
                            để tính toán.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {foodWeights.map((food, idx) => {
                            const w = food.aiTrainingWeight ?? 0;
                            const isTop3 = idx < 3;
                            return (
                                <div
                                    key={food.foodId ?? idx}
                                    className="px-6 py-3.5 flex items-center gap-4 hover:bg-gray-50/70 transition-colors"
                                >
                                    {/* Rank */}
                                    <span
                                        className={`w-6 text-xs font-bold text-center ${
                                            isTop3 ? "text-green-600" : "text-gray-300"
                                        }`}
                                    >
                                        #{idx + 1}
                                    </span>

                                    {/* Name */}
                                    <span className="flex-1 text-sm text-gray-800 font-medium truncate">
                                        {food.foodName}
                                    </span>

                                    {/* Bar */}
                                    <div className="hidden sm:block w-36 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-500 ${
                                                isTop3 ? "bg-green-500" : "bg-gray-300"
                                            }`}
                                            style={{ width: `${Math.min(w * 100, 100)}%` }}
                                        />
                                    </div>

                                    {/* Value */}
                                    <span
                                        className={`text-sm font-mono w-14 text-right font-semibold ${
                                            isTop3 ? "text-green-700" : "text-gray-500"
                                        }`}
                                    >
                                        {pct(w * 100, 2)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Revenue Estimation ──────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="mb-5">
                    <h2 className="text-sm font-semibold text-gray-900">
                        Ước tính doanh thu
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Nhập số lượng khách để xem dự báo tài chính
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                    {/* Avg bill value — read-only from API */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                            <Receipt size={11} />
                            Giá trị bill trung bình
                        </p>
                        <p className="text-2xl font-bold text-gray-900 truncate">
                            {fmt(avgBillValue)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {days} ngày gần nhất
                        </p>
                    </div>

                    {/* Customers — editable */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 group focus-within:border-green-300 focus-within:bg-green-50/30 transition-colors">
                        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                            <Users size={11} />
                            Số lượng khách
                        </p>
                        <input
                            type="number"
                            min="0"
                            value={customers}
                            onChange={(e) => setCustomers(e.target.value)}
                            placeholder="0"
                            className="w-full text-2xl font-bold text-gray-900 bg-transparent outline-none placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">Dự kiến</p>
                    </div>

                    {/* Revenue */}
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <p className="text-xs text-green-600 mb-2 flex items-center gap-1">
                            <TrendingUp size={11} />
                            Doanh thu
                        </p>
                        <p className="text-2xl font-bold text-green-700 truncate">
                            {fmt(revenue)}
                        </p>
                        <p className="text-xs text-green-500 mt-1">
                            Bill TB × Khách
                        </p>
                    </div>

                    {/* Composite margin */}
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <p className="text-xs text-blue-600 mb-2 flex items-center gap-1">
                            <Percent size={11} />
                            Biên lợi nhuận tổng hợp
                        </p>
                        <p className="text-2xl font-bold text-blue-700">
                            {pct(compositeMargin)}
                        </p>
                        <p className="text-xs text-blue-400 mt-1">Toàn thực đơn</p>
                    </div>

                    {/* Tax */}
                    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                        <p className="text-xs text-orange-600 mb-2 flex items-center gap-1">
                            <Receipt size={11} />
                            Thuế (4.5%)
                        </p>
                        <p className="text-2xl font-bold text-orange-700 truncate">
                            {fmt(tax)}
                        </p>
                        <p className="text-xs text-orange-400 mt-1">Ước tính</p>
                    </div>

                    {/* Estimated profit */}
                    <div
                        className={`rounded-xl p-4 border ${
                            estimatedProfit >= 0
                                ? "bg-emerald-50 border-emerald-100"
                                : "bg-red-50 border-red-100"
                        }`}
                    >
                        <p
                            className={`text-xs mb-2 flex items-center gap-1 ${
                                estimatedProfit >= 0
                                    ? "text-emerald-600"
                                    : "text-red-500"
                            }`}
                        >
                            <Wallet size={11} />
                            Lợi nhuận ước tính
                        </p>
                        <p
                            className={`text-2xl font-bold truncate ${
                                estimatedProfit >= 0
                                    ? "text-emerald-700"
                                    : "text-red-600"
                            }`}
                        >
                            {fmt(estimatedProfit)}
                        </p>
                        <p
                            className={`text-xs mt-1 ${
                                estimatedProfit >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                            }`}
                        >
                            Sau thuế & chi phí duy trì
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Maintenance Costs ────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-900">
                            Chi phí duy trì
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Quản lý các khoản chi cố định hàng tháng
                        </p>
                    </div>
                    {costs.length > 0 && (
                        <span className="text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-100 px-3 py-1 rounded-lg">
                            {fmt(totalMaintenance)}
                        </span>
                    )}
                </div>

                <div className="p-6">
                    {/* Table */}
                    {costs.length > 0 && (
                        <div className="mb-5 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                                        <th className="text-left pb-3 font-medium">
                                            Thành phần
                                        </th>
                                        <th className="text-right pb-3 font-medium">
                                            Chi phí
                                        </th>
                                        <th className="text-right pb-3 font-medium pr-4">
                                            Tỉ lệ
                                        </th>
                                        <th className="pb-3 w-20" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {costs.map((cost) => (
                                        <tr
                                            key={cost.id}
                                            className="hover:bg-gray-50/60 transition-colors"
                                        >
                                            {/* Name */}
                                            <td className="py-3 text-gray-800 font-medium">
                                                {editingId === cost.id ? (
                                                    <input
                                                        value={editName}
                                                        onChange={(e) =>
                                                            setEditName(e.target.value)
                                                        }
                                                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full outline-none focus:border-green-400 focus:ring-2 focus:ring-green-50"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <ChevronRight
                                                            size={12}
                                                            className="text-gray-300"
                                                        />
                                                        {cost.name}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Value */}
                                            <td className="py-3 text-right font-mono text-gray-700">
                                                {editingId === cost.id ? (
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) =>
                                                            setEditValue(e.target.value)
                                                        }
                                                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-32 text-right outline-none focus:border-green-400 focus:ring-2 focus:ring-green-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                ) : (
                                                    fmt(cost.value)
                                                )}
                                            </td>

                                            {/* Ratio */}
                                            <td className="py-3 text-right pr-4">
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                    {costRatio(cost.value)}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {editingId === cost.id ? (
                                                        <>
                                                            <button
                                                                onClick={saveEdit}
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                title="Lưu"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    setEditingId(null)
                                                                }
                                                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                                title="Huỷ"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() =>
                                                                    startEdit(cost)
                                                                }
                                                                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Sửa"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    deleteCost(cost.id)
                                                                }
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Xoá"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                                {/* Footer total */}
                                <tfoot>
                                    <tr className="border-t-2 border-gray-200">
                                        <td className="pt-3 text-sm font-semibold text-gray-600">
                                            Tổng chi phí
                                        </td>
                                        <td className="pt-3 text-right text-sm font-bold text-gray-900 font-mono">
                                            {fmt(totalMaintenance)}
                                        </td>
                                        <td className="pt-3 text-right pr-4">
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                100%
                                            </span>
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Add row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addCost()}
                            placeholder="Tên chi phí (VD: Tiền thuê mặt bằng...)"
                            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-50 transition-all"
                        />
                        <input
                            type="number"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addCost()}
                            placeholder="Số tiền (đ)"
                            className="w-40 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                            onClick={addCost}
                            disabled={!newName.trim() || !newValue}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Plus size={15} />
                            Thêm
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
