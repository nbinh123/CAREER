import React, { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    ActivityIndicator,
} from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
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
} from "lucide-react-native";
import { getData } from "../utils/callAPI";
import colors from "../theme/tokens";

// ─── Helpers [GIU-NGUYEN] ─────────────────────────────────────────────────
function fmt(value) {
    return new Intl.NumberFormat("vi-VN").format(Math.round(value || 0)) + "đ";
}
function pct(value, decimals = 1) {
    return (value ?? 0).toFixed(decimals) + "%";
}

const DAY_OPTIONS = [7, 14, 21, 30];

export default function CashFlowPage() {
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
    const [customersFocused, setCustomersFocused] = useState(false);

    // Maintenance costs (chỉ tồn tại phía client, không có API lưu)
    const [costs, setCosts] = useState([]);
    const [newName, setNewName] = useState("");
    const [newValue, setNewValue] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editValue, setEditValue] = useState("");

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoadingFetch(true);
        try {
            const [wRes, mRes, bRes] = await Promise.all([
                getData({ url: "/analyst/food-weights", params: { days } }),
                getData({ url: "/analyst/margin", params: { days } }),
                getData({ url: "/analyst/avg-bill-value", params: { days } }),
            ]);
            if (wRes.success && mRes.success && bRes.success) {
                const sorted = [...(wRes.data.weights ?? [])].sort(
                    (a, b) => b.aiTrainingWeight - a.aiTrainingWeight
                );
                setFoodWeights(sorted);
                setCompositeMargin(mRes.data.compositeMarginPercent ?? 0);
                if (bRes.data.avgBillValue) setAvgBillValue(bRes.data.avgBillValue);
            } else {
                console.error("CashFlow fetchAll: một hoặc nhiều request thất bại");
            }
        } catch (err) {
            console.error("CashFlow fetchAll:", err);
        } finally {
            setLoadingFetch(false);
        }
    }, [days]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // ── Update weights ────────────────────────────────────────────────────
    const handleUpdateWeights = async () => {
        setLoadingUpdate(true);
        setUpdateMsg("");
        try {
            const res = await getData({ url: "/analyst/food-weights", params: { days } });
            if (res.success) {
                setUpdateMsg(`Đã cập nhật ${res.data.updatedCount ?? 0} món`);
                await fetchAll();
            } else {
                setUpdateMsg("Cập nhật thất bại");
            }
        } catch (err) {
            console.error("CashFlow updateWeights:", err);
            setUpdateMsg("Cập nhật thất bại");
        } finally {
            setLoadingUpdate(false);
            setTimeout(() => setUpdateMsg(""), 3000);
        }
    };

    // ── Derived numbers ───────────────────────────────────────────────────
    const numCustomers = parseInt(customers) || 0;
    const revenue = avgBillValue * numCustomers;
    const tax = revenue * 0.045;
    const totalMaintenance = costs.reduce((s, c) => s + (parseFloat(c.value) || 0), 0);
    const estimatedProfit = revenue - tax - totalMaintenance;

    // ── Maintenance CRUD ──────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1 }} className="bg-gray-50">
            <ScrollView
                contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Header ──────────────────────────────────────────────────── */}
                <View>
                    <Text className="text-2xl font-bold text-gray-900">Dòng tiền</Text>
                    <Text className="text-sm text-gray-400 mt-0.5">
                        Phân tích tài chính & ước tính doanh thu
                    </Text>
                </View>

                {/* ── Controls: days selector + update button ────────────────── */}
                <View style={{ gap: 10 }}>
                    <View className="flex-row bg-white border border-gray-200 rounded-xl overflow-hidden self-start">
                        {DAY_OPTIONS.map((d) => (
                            <Pressable
                                key={d}
                                onPress={() => setDays(d)}
                                className={`px-4 py-2 ${days === d ? "bg-green-600" : ""}`}
                            >
                                <Text
                                    className={`text-sm font-medium ${days === d ? "text-white" : "text-gray-500"
                                        }`}
                                >
                                    {d}N
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Pressable
                        onPress={handleUpdateWeights}
                        disabled={loadingUpdate || loadingFetch}
                        style={{ opacity: loadingUpdate || loadingFetch ? 0.6 : 1 }}
                        className="flex-row items-center gap-2 px-4 py-2.5 bg-green-600 rounded-xl self-start"
                    >
                        {loadingUpdate ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <RefreshCw size={15} color={colors.white} />
                        )}
                        <Text className="text-white text-sm font-medium">Cập nhật trọng số</Text>
                    </Pressable>
                </View>

                {/* ── Food Weights ────────────────────────────────────────────── */}
                <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
                        <View>
                            <Text className="text-sm font-semibold text-gray-900">Trọng số món ăn</Text>
                            <Text className="text-xs text-gray-400 mt-0.5">
                                Xếp hạng mức đóng góp vào doanh thu
                            </Text>
                        </View>
                        {loadingFetch && <ActivityIndicator size="small" color={colors.gray[400]} />}
                    </View>

                    {foodWeights.length === 0 && !loadingFetch ? (
                        <View className="py-12 px-6 items-center">
                            <Text className="text-sm text-gray-400 text-center">
                                Chưa có dữ liệu — nhấn{" "}
                                <Text className="font-medium text-green-600">Cập nhật trọng số</Text> để tính
                                toán.
                            </Text>
                        </View>
                    ) : (
                        foodWeights.map((food, idx) => {
                            const w = food.aiTrainingWeight ?? 0;
                            const isTop3 = idx < 3;
                            const isLast = idx === foodWeights.length - 1;
                            return (
                                <View
                                    key={food.foodId ?? idx}
                                    className={`px-5 py-3.5 flex-row items-center gap-3 ${isLast ? "" : "border-b border-gray-50"
                                        }`}
                                >
                                    <Text
                                        className={`w-6 text-xs font-bold text-center ${isTop3 ? "text-green-600" : "text-gray-300"
                                            }`}
                                    >
                                        #{idx + 1}
                                    </Text>
                                    <Text
                                        className="flex-1 text-sm text-gray-800 font-medium"
                                        numberOfLines={1}
                                    >
                                        {food.foodName}
                                    </Text>
                                    <View className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <View
                                            className={`h-1.5 rounded-full ${isTop3 ? "bg-green-500" : "bg-gray-300"
                                                }`}
                                            style={{ width: `${Math.min(w * 100, 100)}%` }}
                                        />
                                    </View>
                                    <Text
                                        className={`text-sm w-14 text-right font-semibold ${isTop3 ? "text-green-700" : "text-gray-500"
                                            }`}
                                    >
                                        {pct(w * 100, 2)}
                                    </Text>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* ── Revenue Estimation ──────────────────────────────────────── */}
                <View className="bg-white rounded-2xl border border-gray-100 p-5">
                    <View className="mb-4">
                        <Text className="text-sm font-semibold text-gray-900">Ước tính doanh thu</Text>
                        <Text className="text-xs text-gray-400 mt-0.5">
                            Nhập số lượng khách để xem dự báo tài chính
                        </Text>
                    </View>

                    <View className="flex-row flex-wrap gap-3">
                        {/* Avg bill value — read-only */}
                        <View
                            className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                            style={{ width: "47%" }}
                        >
                            <View className="flex-row items-center gap-1 mb-2">
                                <Receipt size={11} color={colors.gray[400]} />
                                <Text className="text-xs text-gray-400">Giá trị bill TB</Text>
                            </View>
                            <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>
                                {fmt(avgBillValue)}
                            </Text>
                            <Text className="text-xs text-gray-400 mt-1">{days} ngày gần nhất</Text>
                        </View>

                        {/* Customers — editable */}
                        <View
                            className={`rounded-xl p-4 border ${customersFocused
                                    ? "border-green-300 bg-green-50"
                                    : "border-gray-100 bg-gray-50"
                                }`}
                            style={{ width: "47%" }}
                        >
                            <View className="flex-row items-center gap-1 mb-2">
                                <Users size={11} color={colors.gray[400]} />
                                <Text className="text-xs text-gray-400">Số lượng khách</Text>
                            </View>
                            <TextInput
                                value={customers}
                                onChangeText={(t) => setCustomers(t.replace(/[^0-9]/g, ""))}
                                onFocus={() => setCustomersFocused(true)}
                                onBlur={() => setCustomersFocused(false)}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor={colors.gray[300]}
                                className="text-xl font-bold text-gray-900 p-0"
                            />
                            <Text className="text-xs text-gray-400 mt-1">Dự kiến</Text>
                        </View>

                        {/* Revenue */}
                        <View
                            className="bg-green-50 rounded-xl p-4 border border-green-100"
                            style={{ width: "47%" }}
                        >
                            <View className="flex-row items-center gap-1 mb-2">
                                <TrendingUp size={11} color={colors.green[600]} />
                                <Text className="text-xs text-green-600">Doanh thu</Text>
                            </View>
                            <Text className="text-xl font-bold text-green-700" numberOfLines={1}>
                                {fmt(revenue)}
                            </Text>
                            <Text className="text-xs text-green-500 mt-1">Bill TB × Khách</Text>
                        </View>

                        {/* Composite margin */}
                        <View
                            className="bg-blue-50 rounded-xl p-4 border border-blue-100"
                            style={{ width: "47%" }}
                        >
                            <View className="flex-row items-center gap-1 mb-2">
                                <Percent size={11} color={colors.blue[500]} />
                                <Text className="text-xs text-blue-600">Biên lợi nhuận</Text>
                            </View>
                            <Text className="text-xl font-bold text-blue-700">{pct(compositeMargin)}</Text>
                            <Text className="text-xs text-blue-400 mt-1">Toàn thực đơn</Text>
                        </View>

                        {/* Tax */}
                        <View
                            className="bg-orange-50 rounded-xl p-4 border border-orange-100"
                            style={{ width: "47%" }}
                        >
                            <View className="flex-row items-center gap-1 mb-2">
                                <Receipt size={11} color="#ea580c" />
                                <Text className="text-xs text-orange-600">Thuế (4.5%)</Text>
                            </View>
                            <Text className="text-xl font-bold text-orange-700" numberOfLines={1}>
                                {fmt(tax)}
                            </Text>
                            <Text className="text-xs text-orange-400 mt-1">Ước tính</Text>
                        </View>

                        {/* Estimated profit */}
                        <View
                            className={`rounded-xl p-4 border ${estimatedProfit >= 0
                                    ? "bg-emerald-50 border-emerald-100"
                                    : "bg-red-50 border-red-100"
                                }`}
                            style={{ width: "47%" }}
                        >
                            <View className="flex-row items-center gap-1 mb-2">
                                <Wallet
                                    size={11}
                                    color={estimatedProfit >= 0 ? colors.emerald[600] : colors.red[500]}
                                />
                                <Text
                                    className={`text-xs ${estimatedProfit >= 0 ? "text-emerald-600" : "text-red-500"
                                        }`}
                                >
                                    Lợi nhuận ước tính
                                </Text>
                            </View>
                            <Text
                                className={`text-xl font-bold ${estimatedProfit >= 0 ? "text-emerald-700" : "text-red-600"
                                    }`}
                                numberOfLines={1}
                            >
                                {fmt(estimatedProfit)}
                            </Text>
                            <Text
                                className={`text-xs mt-1 ${estimatedProfit >= 0 ? "text-emerald-400" : "text-red-400"
                                    }`}
                            >
                                Sau thuế & chi phí
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Maintenance Costs ───────────────────────────────────────── */}
                <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
                        <View>
                            <Text className="text-sm font-semibold text-gray-900">Chi phí duy trì</Text>
                            <Text className="text-xs text-gray-400 mt-0.5">
                                Quản lý các khoản chi cố định hàng tháng
                            </Text>
                        </View>
                        {costs.length > 0 && (
                            <View className="bg-gray-50 border border-gray-100 px-3 py-1 rounded-lg">
                                <Text className="text-sm font-semibold text-gray-700">
                                    {fmt(totalMaintenance)}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View className="p-5" style={{ gap: 16 }}>
                        {costs.length > 0 && (
                            <View>
                                {/* Column labels */}
                                <View className="flex-row items-center pb-2 border-b border-gray-100">
                                    <Text className="flex-[2] text-xs text-gray-400 font-medium">Thành phần</Text>
                                    <Text className="flex-1 text-xs text-gray-400 font-medium text-right">
                                        Chi phí / Tỉ lệ
                                    </Text>
                                    <View style={{ width: 72 }} />
                                </View>

                                {costs.map((cost, idx) => {
                                    const isEditing = editingId === cost.id;
                                    const isLast = idx === costs.length - 1;
                                    return (
                                        <View
                                            key={cost.id}
                                            className={`flex-row items-center py-3 ${isLast ? "" : "border-b border-gray-50"
                                                }`}
                                        >
                                            {/* Name */}
                                            <View className="flex-[2] pr-2">
                                                {isEditing ? (
                                                    <TextInput
                                                        value={editName}
                                                        onChangeText={setEditName}
                                                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <View className="flex-row items-center gap-1.5">
                                                        <ChevronRight size={12} color={colors.gray[300]} />
                                                        <Text
                                                            className="text-gray-800 font-medium text-sm flex-shrink"
                                                            numberOfLines={1}
                                                        >
                                                            {cost.name}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Value + ratio (ratio luôn tính theo cost.value đã lưu,
                          giống bản gốc — không đổi theo editValue đang gõ dở) */}
                                            <View className="flex-1 items-end" style={{ gap: 3 }}>
                                                {isEditing ? (
                                                    <TextInput
                                                        value={editValue}
                                                        onChangeText={setEditValue}
                                                        keyboardType="numeric"
                                                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-700 w-full"
                                                    />
                                                ) : (
                                                    <Text className="text-right text-gray-700 text-sm" numberOfLines={1}>
                                                        {fmt(cost.value)}
                                                    </Text>
                                                )}
                                                <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                                                    <Text className="text-[10px] text-gray-500">{costRatio(cost.value)}</Text>
                                                </View>
                                            </View>

                                            {/* Actions */}
                                            <View
                                                className="flex-row items-center justify-end gap-1"
                                                style={{ width: 72 }}
                                            >
                                                {isEditing ? (
                                                    <>
                                                        <Pressable onPress={saveEdit} className="p-1.5 rounded-lg">
                                                            <Check size={14} color={colors.green[600]} />
                                                        </Pressable>
                                                        <Pressable
                                                            onPress={() => setEditingId(null)}
                                                            className="p-1.5 rounded-lg"
                                                        >
                                                            <X size={14} color={colors.gray[400]} />
                                                        </Pressable>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Pressable onPress={() => startEdit(cost)} className="p-1.5 rounded-lg">
                                                            <Edit2 size={14} color={colors.gray[400]} />
                                                        </Pressable>
                                                        <Pressable
                                                            onPress={() => deleteCost(cost.id)}
                                                            className="p-1.5 rounded-lg"
                                                        >
                                                            <Trash2 size={14} color={colors.gray[400]} />
                                                        </Pressable>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}

                                {/* Footer total */}
                                <View
                                    className="flex-row items-center pt-3"
                                    style={{ borderTopWidth: 2, borderTopColor: colors.gray[200] }}
                                >
                                    <Text className="flex-[2] text-sm font-semibold text-gray-600">
                                        Tổng chi phí
                                    </Text>
                                    <View className="flex-1 items-end" style={{ gap: 3 }}>
                                        <Text className="text-right text-sm font-bold text-gray-900">
                                            {fmt(totalMaintenance)}
                                        </Text>
                                        <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                                            <Text className="text-[10px] text-gray-500">100%</Text>
                                        </View>
                                    </View>
                                    <View style={{ width: 72 }} />
                                </View>
                            </View>
                        )}

                        {/* Add row */}
                        <View style={{ gap: 10 }}>
                            <TextInput
                                value={newName}
                                onChangeText={setNewName}
                                onSubmitEditing={addCost}
                                placeholder="Tên chi phí (VD: Tiền thuê mặt bằng...)"
                                placeholderTextColor={colors.gray[300]}
                                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800"
                            />
                            <View className="flex-row items-center gap-3">
                                <TextInput
                                    value={newValue}
                                    onChangeText={(t) => setNewValue(t.replace(/[^0-9.]/g, ""))}
                                    onSubmitEditing={addCost}
                                    keyboardType="numeric"
                                    placeholder="Số tiền (đ)"
                                    placeholderTextColor={colors.gray[300]}
                                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800"
                                />
                                <Pressable
                                    onPress={addCost}
                                    disabled={!newName.trim() || !newValue}
                                    style={{ opacity: !newName.trim() || !newValue ? 0.4 : 1 }}
                                    className="flex-row items-center gap-1.5 px-4 py-2.5 bg-green-600 rounded-xl"
                                >
                                    <Plus size={15} color={colors.white} />
                                    <Text className="text-white text-sm font-medium">Thêm</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* ── Toast ─────────────────────────────────────────────────────── */}
            {!!updateMsg && (
                <Animated.View
                    entering={FadeInDown.duration(300)}
                    exiting={FadeOutDown.duration(300)}
                    className="absolute left-0 right-0 bottom-4 items-center"
                >
                    <View className="bg-emerald-900 px-5 py-2.5 rounded-full">
                        <Text className="text-emerald-300 text-[13px] font-extrabold">{updateMsg}</Text>
                    </View>
                </Animated.View>
            )}
        </View>
    );
}