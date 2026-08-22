import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// Số món/trang khi phân trang "Trọng số món ăn".
const FOOD_WEIGHTS_PAGE_SIZE = 5;

// Key lưu "Chi phí duy trì" trên máy (AsyncStorage) — dữ liệu này KHÔNG có
// API lưu ở BE, chỉ tồn tại phía client nên phải tự persist.
const MAINTENANCE_COSTS_STORAGE_KEY = "cashflow:maintenanceCosts:v1";

// ─── DaySelector ────────────────────────────────────────────────────────
// Tách riêng + React.memo: bấm chọn ngày không kéo theo render các card
// khác, và ngược lại — khi state khác (customers, costs...) đổi, control
// này không render lại vì props (days) không đổi.
const DaySelector = React.memo(function DaySelector({ days, onSelect }) {
    return (
        <View className="flex-row bg-white border border-gray-200 rounded-xl overflow-hidden self-start">
            {DAY_OPTIONS.map((d) => (
                <Pressable
                    key={d}
                    onPress={() => onSelect(d)}
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
    );
});

// ─── FoodWeightRow ──────────────────────────────────────────────────────
const FoodWeightRow = React.memo(function FoodWeightRow({ food, idx, isLast }) {
    const w = food.aiTrainingWeight ?? 0;
    const isTop3 = idx < 3;
    return (
        <View
            className={`px-5 py-3.5 flex-row items-center gap-3 ${isLast ? "" : "border-b border-gray-50"
                }`}
        >
            <Text
                className={`w-6 text-xs font-bold text-center ${isTop3 ? "text-green-600" : "text-gray-300"
                    }`}
            >
                #{idx + 1}
            </Text>
            <Text className="flex-1 text-sm text-gray-800 font-medium" numberOfLines={1}>
                {food.foodName}
            </Text>
            <View className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <View
                    className={`h-1.5 rounded-full ${isTop3 ? "bg-green-500" : "bg-gray-300"}`}
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
});

// ─── FoodWeightsCard ────────────────────────────────────────────────────
// Nhận `foodWeights` + `loadingFetch` làm props riêng: gõ vào ô "Số lượng
// khách" hay sửa chi phí duy trì sẽ không khiến card này (và list bên
// trong) render lại, vì React.memo so sánh props không đổi.
//
// Phân trang: mỗi lần chỉ render các item đã tải (page 1 = 5 món đầu).
// Nút "Thêm" gọi `onLoadMore` để tải tiếp 5 món kế tiếp; ẩn khi hết dữ liệu
// (`hasMore === false`).
const FoodWeightsCard = React.memo(function FoodWeightsCard({
    foodWeights,
    loadingFetch,
    hasMore,
    loadingMore,
    onLoadMore,
}) {
    return (
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
                <>
                    {foodWeights.map((food, idx) => (
                        <FoodWeightRow
                            key={food.foodId ?? idx}
                            food={food}
                            idx={idx}
                            isLast={idx === foodWeights.length - 1 && !hasMore}
                        />
                    ))}

                    {hasMore && (
                        <Pressable
                            onPress={onLoadMore}
                            disabled={loadingMore}
                            style={{ opacity: loadingMore ? 0.6 : 1 }}
                            className="flex-row items-center justify-center gap-2 py-3 border-t border-gray-50"
                        >
                            {loadingMore ? (
                                <ActivityIndicator size="small" color={colors.gray[400]} />
                            ) : (
                                <Text className="text-sm font-medium text-green-600">Thêm</Text>
                            )}
                        </Pressable>
                    )}
                </>
            )}
        </View>
    );
});

// ─── RevenueEstimationCard ──────────────────────────────────────────────
const RevenueEstimationCard = React.memo(function RevenueEstimationCard({
    days,
    avgBillValue,
    customers,
    customersFocused,
    onChangeCustomers,
    onFocusCustomers,
    onBlurCustomers,
    revenue,
    compositeMargin,
    tax,
    estimatedProfit,
}) {
    return (
        <View className="bg-white rounded-2xl border border-gray-100 p-5">
            <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-900">Ước tính doanh thu</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                    Nhập số lượng khách để xem dự báo tài chính
                </Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
                {/* Avg bill value — read-only */}
                <View className="bg-gray-50 rounded-xl p-4 border border-gray-100" style={{ width: "47%" }}>
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
                        onChangeText={onChangeCustomers}
                        onFocus={onFocusCustomers}
                        onBlur={onBlurCustomers}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.gray[300]}
                        className="text-xl font-bold text-gray-900 p-0"
                    />
                    <Text className="text-xs text-gray-400 mt-1">Dự kiến</Text>
                </View>

                {/* Revenue */}
                <View className="bg-green-50 rounded-xl p-4 border border-green-100" style={{ width: "47%" }}>
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
                <View className="bg-blue-50 rounded-xl p-4 border border-blue-100" style={{ width: "47%" }}>
                    <View className="flex-row items-center gap-1 mb-2">
                        <Percent size={11} color={colors.blue[500]} />
                        <Text className="text-xs text-blue-600">Biên lợi nhuận</Text>
                    </View>
                    <Text className="text-xl font-bold text-blue-700">{pct(compositeMargin)}</Text>
                    <Text className="text-xs text-blue-400 mt-1">Toàn thực đơn</Text>
                </View>

                {/* Tax */}
                <View className="bg-orange-50 rounded-xl p-4 border border-orange-100" style={{ width: "47%" }}>
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
                            className={`text-xs ${estimatedProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}
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
                        className={`text-xs mt-1 ${estimatedProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                        Sau thuế & chi phí
                    </Text>
                </View>
            </View>
        </View>
    );
});

// ─── MaintenanceCostRow ─────────────────────────────────────────────────
const MaintenanceCostRow = React.memo(function MaintenanceCostRow({
    cost,
    isEditing,
    isLast,
    ratio,
    editName,
    editValue,
    onChangeEditName,
    onChangeEditValue,
    onSaveEdit,
    onCancelEdit,
    onStartEdit,
    onDelete,
}) {
    return (
        <View
            className={`flex-row items-center py-3 ${isLast ? "" : "border-b border-gray-50"}`}
        >
            {/* Name */}
            <View className="flex-[2] pr-2">
                {isEditing ? (
                    <TextInput
                        value={editName}
                        onChangeText={onChangeEditName}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800"
                        autoFocus
                    />
                ) : (
                    <View className="flex-row items-center gap-1.5">
                        <ChevronRight size={12} color={colors.gray[300]} />
                        <Text className="text-gray-800 font-medium text-sm flex-shrink" numberOfLines={1}>
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
                        onChangeText={onChangeEditValue}
                        keyboardType="numeric"
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-700 w-full"
                    />
                ) : (
                    <Text className="text-right text-gray-700 text-sm" numberOfLines={1}>
                        {fmt(cost.value)}
                    </Text>
                )}
                <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] text-gray-500">{ratio}</Text>
                </View>
            </View>

            {/* Actions */}
            <View className="flex-row items-center justify-end gap-1" style={{ width: 72 }}>
                {isEditing ? (
                    <>
                        <Pressable onPress={onSaveEdit} className="p-1.5 rounded-lg">
                            <Check size={14} color={colors.green[600]} />
                        </Pressable>
                        <Pressable onPress={onCancelEdit} className="p-1.5 rounded-lg">
                            <X size={14} color={colors.gray[400]} />
                        </Pressable>
                    </>
                ) : (
                    <>
                        <Pressable onPress={onStartEdit} className="p-1.5 rounded-lg">
                            <Edit2 size={14} color={colors.gray[400]} />
                        </Pressable>
                        <Pressable onPress={onDelete} className="p-1.5 rounded-lg">
                            <Trash2 size={14} color={colors.gray[400]} />
                        </Pressable>
                    </>
                )}
            </View>
        </View>
    );
});

// ─── MaintenanceCostsCard ───────────────────────────────────────────────
const MaintenanceCostsCard = React.memo(function MaintenanceCostsCard({
    costs,
    totalMaintenance,
    costRatioMap,
    editingId,
    editName,
    editValue,
    onChangeEditName,
    onChangeEditValue,
    onSaveEdit,
    onCancelEdit,
    onStartEdit,
    onDelete,
    newName,
    newValue,
    onChangeNewName,
    onChangeNewValue,
    onAddCost,
}) {
    return (
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
                        <Text className="text-sm font-semibold text-gray-700">{fmt(totalMaintenance)}</Text>
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

                        {costs.map((cost, idx) => (
                            <MaintenanceCostRow
                                key={cost.id}
                                cost={cost}
                                isLast={idx === costs.length - 1}
                                isEditing={editingId === cost.id}
                                ratio={costRatioMap.get(cost.id) ?? "—"}
                                editName={editName}
                                editValue={editValue}
                                onChangeEditName={onChangeEditName}
                                onChangeEditValue={onChangeEditValue}
                                onSaveEdit={onSaveEdit}
                                onCancelEdit={onCancelEdit}
                                onStartEdit={() => onStartEdit(cost)}
                                onDelete={() => onDelete(cost.id)}
                            />
                        ))}

                        {/* Footer total */}
                        <View
                            className="flex-row items-center pt-3"
                            style={{ borderTopWidth: 2, borderTopColor: colors.gray[200] }}
                        >
                            <Text className="flex-[2] text-sm font-semibold text-gray-600">Tổng chi phí</Text>
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
                        onChangeText={onChangeNewName}
                        onSubmitEditing={onAddCost}
                        placeholder="Tên chi phí (VD: Tiền thuê mặt bằng...)"
                        placeholderTextColor={colors.gray[300]}
                        className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800"
                    />
                    <View className="flex-row items-center gap-3">
                        <TextInput
                            value={newValue}
                            onChangeText={onChangeNewValue}
                            onSubmitEditing={onAddCost}
                            keyboardType="numeric"
                            placeholder="Số tiền (đ)"
                            placeholderTextColor={colors.gray[300]}
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800"
                        />
                        <Pressable
                            onPress={onAddCost}
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
    );
});

export default function CashFlowPage() {
    const [days, setDays] = useState(7);

    // Remote data
    const [foodWeights, setFoodWeights] = useState([]);
    const [foodWeightsPage, setFoodWeightsPage] = useState(1);
    const [foodWeightsHasMore, setFoodWeightsHasMore] = useState(true);
    const [loadingMoreWeights, setLoadingMoreWeights] = useState(false);
    const [compositeMargin, setCompositeMargin] = useState(0);
    const [avgBillValue, setAvgBillValue] = useState(80000);
    const [loadingFetch, setLoadingFetch] = useState(false);
    const [loadingUpdate, setLoadingUpdate] = useState(false);
    const [updateMsg, setUpdateMsg] = useState("");

    // Revenue estimation
    const [customers, setCustomers] = useState("");
    const [customersFocused, setCustomersFocused] = useState(false);

    // Maintenance costs (không có API lưu ở BE — persist trên máy qua
    // AsyncStorage, xem 2 useEffect load/save bên dưới)
    const [costs, setCosts] = useState([]);
    const [costsLoaded, setCostsLoaded] = useState(false);
    const [newName, setNewName] = useState("");
    const [newValue, setNewValue] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editValue, setEditValue] = useState("");

    // ── Fetch ──────────────────────────────────────────────────────────────
    // GHI CHÚ CHO BACKEND [CẦN SỬA]:
    // Endpoint `/analyst/food-weights` giờ được gọi kèm `page` và `limit`
    // (limit = FOOD_WEIGHTS_PAGE_SIZE = 5) để phân trang thay vì trả hết
    // toàn bộ danh sách một lần. Yêu cầu BE:
    //   1. Sort theo `aiTrainingWeight` GIẢM DẦN TRƯỚC khi cắt trang (để
    //      thứ hạng #1, #2, #3... đúng xuyên suốt các trang).
    //   2. Trả đúng tối đa `limit` item cho `data.weights` của trang `page`.
    //   3. Thêm field `data.hasMore` (boolean) cho biết còn trang kế tiếp
    //      hay không.
    // Trong lúc chờ BE cập nhật, FE tự suy ra `hasMore` bằng
    // `received.length === limit` và tự lọc trùng `foodId` khi nối trang —
    // xoá 2 phần fallback này sau khi BE trả đúng field `hasMore` + phân
    // trang chuẩn.
    const fetchFoodWeightsPage1 = useCallback(async () => {
        const res = await getData({
            url: "/analyst/food-weights/paginated",
            params: { days, page: 1, limit: FOOD_WEIGHTS_PAGE_SIZE },
        });
        return res;
    }, [days]);

    const fetchAll = useCallback(async () => {
        setLoadingFetch(true);
        try {
            const [wRes, mRes, bRes] = await Promise.all([
                fetchFoodWeightsPage1(),
                getData({ url: "/analyst/margin", params: { days } }),
                getData({ url: "/analyst/avg-bill-value", params: { days } }),
            ]);
            if (wRes.success && mRes.success && bRes.success) {
                const received = wRes.data.weights ?? [];
                // BE đã sort + phân trang (xem ghi chú phía trên) — không
                // sort lại ở FE nữa.
                setFoodWeights(received);
                setFoodWeightsPage(1);
                setFoodWeightsHasMore(
                    typeof wRes.data.hasMore === "boolean"
                        ? wRes.data.hasMore
                        : received.length === FOOD_WEIGHTS_PAGE_SIZE
                );
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
    }, [fetchFoodWeightsPage1, days]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // "Thêm" — tải trang kế tiếp (5 món tiếp theo) và nối vào list hiện có.
    // Guard bằng `loadingMoreWeights`/`foodWeightsHasMore` để tránh bấm dồn
    // dập gây gọi API trùng lặp.
    const handleLoadMoreWeights = useCallback(async () => {
        if (loadingMoreWeights || !foodWeightsHasMore) return;
        setLoadingMoreWeights(true);
        try {
            const nextPage = foodWeightsPage + 1;
            const res = await getData({
                url: "/analyst/food-weights/paginated",
                params: { days, page: nextPage, limit: FOOD_WEIGHTS_PAGE_SIZE },
            });
            if (res.success) {
                const received = res.data.weights ?? [];
                setFoodWeights((prev) => {
                    // Fallback dedup — xoá khi BE đã phân trang chuẩn (xem ghi chú ở fetchAll).
                    const seen = new Set(prev.map((f) => f.foodId));
                    return [...prev, ...received.filter((f) => !seen.has(f.foodId))];
                });
                setFoodWeightsPage(nextPage);
                setFoodWeightsHasMore(
                    typeof res.data.hasMore === "boolean"
                        ? res.data.hasMore
                        : received.length === FOOD_WEIGHTS_PAGE_SIZE
                );
            } else {
                console.error("CashFlow loadMoreWeights: request thất bại");
            }
        } catch (err) {
            console.error("CashFlow loadMoreWeights:", err);
        } finally {
            setLoadingMoreWeights(false);
        }
    }, [days, foodWeightsPage, foodWeightsHasMore, loadingMoreWeights]);

    // ── Maintenance costs persistence (AsyncStorage) ──────────────────────
    // Load 1 lần khi mount. `costsLoaded` chặn effect ghi (bên dưới) chạy
    // trước khi load xong, để không bị ghi đè dữ liệu đã lưu bằng mảng [].
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(MAINTENANCE_COSTS_STORAGE_KEY);
                if (mounted && raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) setCosts(parsed);
                }
            } catch (err) {
                console.error("CashFlow loadCosts:", err);
            } finally {
                if (mounted) setCostsLoaded(true);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Ghi lại mỗi khi `costs` đổi (thêm/sửa/xoá), chỉ sau khi đã load xong.
    useEffect(() => {
        if (!costsLoaded) return;
        AsyncStorage.setItem(MAINTENANCE_COSTS_STORAGE_KEY, JSON.stringify(costs)).catch(
            (err) => {
                console.error("CashFlow saveCosts:", err);
            }
        );
    }, [costs, costsLoaded]);

    // ── Update weights ────────────────────────────────────────────────────
    const handleUpdateWeights = useCallback(async () => {
        setLoadingUpdate(true);
        setUpdateMsg("");
        try {
            const res = await getData({ url: "/analyst/food-weights/paginated", params: { days } });
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
    }, [days, fetchAll]);

    // ── Derived numbers ───────────────────────────────────────────────────
    // useMemo: trước đây các giá trị này được tính lại ở MỌI lần render của
    // page (kể cả khi chỉ customersFocused hay editName đổi). Giờ chỉ tính
    // lại khi input liên quan thực sự đổi.
    const numCustomers = useMemo(() => parseInt(customers) || 0, [customers]);
    const revenue = useMemo(() => avgBillValue * numCustomers, [avgBillValue, numCustomers]);
    const tax = useMemo(() => revenue * 0.045, [revenue]);
    const totalMaintenance = useMemo(
        () => costs.reduce((s, c) => s + (parseFloat(c.value) || 0), 0),
        [costs]
    );
    const estimatedProfit = useMemo(
        () => revenue - tax - totalMaintenance,
        [revenue, tax, totalMaintenance]
    );

    // Tỉ lệ % từng chi phí — trước đây hàm `costRatio(val)` được gọi lại
    // (và tính lại phép chia) cho từng dòng ở mọi lần render của page. Giờ
    // tính một lần thành Map, chỉ khi `costs`/`totalMaintenance` đổi, mỗi
    // dòng tra cứu O(1).
    const costRatioMap = useMemo(() => {
        const map = new Map();
        for (const c of costs) {
            const val = parseFloat(c.value) || 0;
            map.set(c.id, totalMaintenance > 0 ? pct((val / totalMaintenance) * 100) : "—");
        }
        return map;
    }, [costs, totalMaintenance]);

    // ── Maintenance CRUD ──────────────────────────────────────────────────
    const addCost = useCallback(() => {
        if (!newName.trim() || !newValue) return;
        setCosts((prev) => [
            ...prev,
            { id: Date.now(), name: newName.trim(), value: parseFloat(newValue) || 0 },
        ]);
        setNewName("");
        setNewValue("");
    }, [newName, newValue]);

    const deleteCost = useCallback((id) => setCosts((prev) => prev.filter((c) => c.id !== id)), []);

    const startEdit = useCallback((cost) => {
        setEditingId(cost.id);
        setEditName(cost.name);
        setEditValue(String(cost.value));
    }, []);

    const cancelEdit = useCallback(() => setEditingId(null), []);

    const saveEdit = useCallback(() => {
        setCosts((prev) =>
            prev.map((c) =>
                c.id === editingId
                    ? { ...c, name: editName.trim(), value: parseFloat(editValue) || 0 }
                    : c
            )
        );
        setEditingId(null);
    }, [editingId, editName, editValue]);

    // Stable input handlers — giữ nguyên identity giữa các lần render của
    // page, để các card con (đã bọc React.memo) không bị coi là "props đổi"
    // một cách giả tạo.
    const handleSelectDay = useCallback((d) => setDays(d), []);
    const handleChangeCustomers = useCallback((t) => setCustomers(t.replace(/[^0-9]/g, "")), []);
    const handleFocusCustomers = useCallback(() => setCustomersFocused(true), []);
    const handleBlurCustomers = useCallback(() => setCustomersFocused(false), []);
    const handleChangeNewValue = useCallback((t) => setNewValue(t.replace(/[^0-9.]/g, "")), []);

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
                    <DaySelector days={days} onSelect={handleSelectDay} />

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

                {/* ── Revenue Estimation ──────────────────────────────────────── */}
                <RevenueEstimationCard
                    days={days}
                    avgBillValue={avgBillValue}
                    customers={customers}
                    customersFocused={customersFocused}
                    onChangeCustomers={handleChangeCustomers}
                    onFocusCustomers={handleFocusCustomers}
                    onBlurCustomers={handleBlurCustomers}
                    revenue={revenue}
                    compositeMargin={compositeMargin}
                    tax={tax}
                    estimatedProfit={estimatedProfit}
                />

                {/* ── Maintenance Costs ───────────────────────────────────────── */}
                <MaintenanceCostsCard
                    costs={costs}
                    totalMaintenance={totalMaintenance}
                    costRatioMap={costRatioMap}
                    editingId={editingId}
                    editName={editName}
                    editValue={editValue}
                    onChangeEditName={setEditName}
                    onChangeEditValue={setEditValue}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onStartEdit={startEdit}
                    onDelete={deleteCost}
                    newName={newName}
                    newValue={newValue}
                    onChangeNewName={setNewName}
                    onChangeNewValue={handleChangeNewValue}
                    onAddCost={addCost}
                />

                {/* ── Food Weights (đã chuyển xuống dưới) ─────────────────────── */}
                <FoodWeightsCard
                    foodWeights={foodWeights}
                    loadingFetch={loadingFetch}
                    hasMore={foodWeightsHasMore}
                    loadingMore={loadingMoreWeights}
                    onLoadMore={handleLoadMoreWeights}
                />
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