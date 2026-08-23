import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
    useQuery,
    useInfiniteQuery,
    useMutation,
    useQueryClient,
    keepPreviousData,
} from "@tanstack/react-query";
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

// getData() (callAPI.js) trả `{ success, data }` chứ không throw khi BE báo
// lỗi. react-query cần queryFn/mutationFn THROW để tự set isError/error và
// áp dụng `retry` từ queryClient dùng chung — helper này là điểm chuyển đổi
// duy nhất giữa 2 kiểu đó, dùng lại cho mọi query/mutation trong file.
async function fetchOrThrow(url, params) {
    const res = await getData({ url, params });
    if (!res?.success) {
        throw new Error(res?.data?.message || `Request failed: ${url}`);
    }
    return res.data;
}

const DAY_OPTIONS = [7, 14, 21, 30];

// Số món/trang khi phân trang "Trọng số món ăn".
const FOOD_WEIGHTS_PAGE_SIZE = 5;

// Key lưu "Chi phí duy trì" trên máy (AsyncStorage) — dữ liệu này KHÔNG có
// API lưu ở BE, chỉ tồn tại phía client nên phải tự persist (react-query chỉ
// cache server state, không thay được persistence cho state thuần client).
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
// onStartEdit/onSaveEdit/onDelete nhận vào PHẢI là hàm ổn định (page truyền
// xuống với useCallback deps rỗng) — việc "curry" cost/cost.id/editName/
// editValue được làm NGAY TẠI ĐÂY, bên trong onPress, chứ không phải ở
// component cha lúc .map(). Nếu curry ở cha kiểu
// `onDelete={() => onDelete(cost.id)}` trong .map(), mỗi lần cha render sẽ
// tạo ra 1 closure MỚI cho MỖI dòng — khiến React.memo của TẤT CẢ các dòng
// (không chỉ dòng đổi) bị vô hiệu hoá. Curry ở đây (component lá, không có
// con nào được memo bên dưới) thì vô hại vì không còn ai để "phá memo" nữa.
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
                        <Pressable
                            onPress={() => onSaveEdit(cost.id, editName, editValue)}
                            className="p-1.5 rounded-lg"
                        >
                            <Check size={14} color={colors.green[600]} />
                        </Pressable>
                        <Pressable onPress={onCancelEdit} className="p-1.5 rounded-lg">
                            <X size={14} color={colors.gray[400]} />
                        </Pressable>
                    </>
                ) : (
                    <>
                        <Pressable onPress={() => onStartEdit(cost)} className="p-1.5 rounded-lg">
                            <Edit2 size={14} color={colors.gray[400]} />
                        </Pressable>
                        <Pressable onPress={() => onDelete(cost.id)} className="p-1.5 rounded-lg">
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

                        {costs.map((cost, idx) => {
                            const isEditing = editingId === cost.id;
                            return (
                                <MaintenanceCostRow
                                    key={cost.id}
                                    cost={cost}
                                    isLast={idx === costs.length - 1}
                                    isEditing={isEditing}
                                    ratio={costRatioMap.get(cost.id) ?? "—"}
                                    // Chỉ dòng ĐANG SỬA mới nhận editName/editValue "sống" —
                                    // mọi dòng khác luôn nhận `undefined` (hằng số). Nhờ vậy
                                    // gõ phím ở dòng đang sửa không làm đổi props của các
                                    // dòng còn lại → React.memo của chúng vẫn có tác dụng.
                                    editName={isEditing ? editName : undefined}
                                    editValue={isEditing ? editValue : undefined}
                                    onChangeEditName={onChangeEditName}
                                    onChangeEditValue={onChangeEditValue}
                                    // Truyền THẲNG, không bọc arrow function ở đây — xem ghi
                                    // chú ở đầu MaintenanceCostRow.
                                    onSaveEdit={onSaveEdit}
                                    onCancelEdit={onCancelEdit}
                                    onStartEdit={onStartEdit}
                                    onDelete={onDelete}
                                />
                            );
                        })}

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
    const queryClient = useQueryClient();
    const [days, setDays] = useState(7);

    // Revenue estimation
    const [customers, setCustomers] = useState("");
    const [customersFocused, setCustomersFocused] = useState(false);

    // Maintenance costs (không có API lưu ở BE — persist trên máy qua
    // AsyncStorage, xem 2 useEffect load/save bên dưới. Đây là state thuần
    // client nên KHÔNG đưa vào react-query — react-query chỉ dành cho dữ
    // liệu đến từ server.)
    const [costs, setCosts] = useState([]);
    const [costsLoaded, setCostsLoaded] = useState(false);
    const [newName, setNewName] = useState("");
    const [newValue, setNewValue] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editValue, setEditValue] = useState("");
    const [updateMsg, setUpdateMsg] = useState("");

    // ── React Query: biên lợi nhuận + giá trị bill TB (phụ thuộc `days`) ────
    // `placeholderData: keepPreviousData` — đổi `days` sẽ giữ nguyên số liệu
    // cũ trên màn hình trong lúc chờ số liệu mới, thay vì flash về giá trị
    // mặc định/0 rồi mới nhảy lên số đúng.
    const marginQuery = useQuery({
        queryKey: ["analyst", "margin", days],
        queryFn: () => fetchOrThrow("/analyst/margin", { days }),
        placeholderData: keepPreviousData,
    });

    const avgBillQuery = useQuery({
        queryKey: ["analyst", "avgBillValue", days],
        queryFn: () => fetchOrThrow("/analyst/avg-bill-value", { days }),
        placeholderData: keepPreviousData,
    });

    const compositeMargin = marginQuery.data?.compositeMarginPercent ?? 0;
    const avgBillValue = avgBillQuery.data?.avgBillValue ?? 80000;

    // ── React Query: "Trọng số món ăn" — phân trang bằng useInfiniteQuery ──
    // Không phụ thuộc `days` (xem ghi chú ở BE: aiTrainingWeight là giá trị
    // đã tính sẵn, đọc không cần khoảng ngày). `staleTime` dài hơn mặc định
    // của queryClient (10s) vì dữ liệu này chỉ đổi khi bấm "Cập nhật trọng
    // số" — không cần tự refetch thường xuyên khi quay lại app.
    const foodWeightsQuery = useInfiniteQuery({
        queryKey: ["analyst", "foodWeightsPaginated"],
        queryFn: ({ pageParam }) =>
            fetchOrThrow("/analyst/food-weights/paginated", {
                page: pageParam,
                limit: FOOD_WEIGHTS_PAGE_SIZE,
            }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
        staleTime: 60_000,
    });

    // Gộp các trang đã tải thành 1 mảng phẳng để render — chỉ tính lại khi
    // có trang mới (object `data` của useInfiniteQuery đổi identity).
    const foodWeights = useMemo(
        () => foodWeightsQuery.data?.pages.flatMap((p) => p.weights) ?? [],
        [foodWeightsQuery.data]
    );

    const handleLoadMoreWeights = useCallback(() => {
        foodWeightsQuery.fetchNextPage();
        // Guard bấm dồn dập / hết trang đã nằm trong props `disabled` của
        // nút "Thêm" (loadingMore = isFetchingNextPage, hasMore = hasNextPage).
    }, [foodWeightsQuery.fetchNextPage]);

    // ── Mutation: "Cập nhật trọng số" — trigger BE tính lại (endpoint cũ,
    // giữ nguyên /analyst/food-weights, KHÔNG đổi) ─────────────────────────
    const updateWeightsMutation = useMutation({
        mutationFn: () => fetchOrThrow("/analyst/food-weights", { days }),
        onSuccess: (data) => {
            setUpdateMsg(`Đã cập nhật ${data.updatedCount ?? 0} món`);
            // Trọng số vừa đổi toàn bộ → xoá cache các trang đã tải và
            // refetch lại từ trang 1, thay vì invalidate (sẽ refetch lại
            // TẤT CẢ trang cũ đã tải, tốn request không cần thiết).
            queryClient.resetQueries({ queryKey: ["analyst", "foodWeightsPaginated"] });
        },
        onError: (err) => {
            console.error("CashFlow updateWeights:", err);
            setUpdateMsg("Cập nhật thất bại");
        },
    });

    const handleUpdateWeights = useCallback(() => {
        updateWeightsMutation.mutate();
    }, [updateWeightsMutation.mutate]);

    // Toast tự ẩn sau 3s. Dùng useEffect (thay vì setTimeout rời trong
    // onSettled của mutation như trước) để tự clearTimeout khi component
    // unmount hoặc khi `updateMsg` đổi trước khi hết 3s — trước đây nếu rời
    // trang trong lúc toast đang chờ tắt, setTimeout cũ vẫn chạy và gọi
    // setState trên component đã unmount (React cảnh báo + rò rỉ nhỏ); nếu
    // bấm nút 2 lần liên tiếp, 2 timer cũ/mới có thể chồng nhau.
    useEffect(() => {
        if (!updateMsg) return;
        const timer = setTimeout(() => setUpdateMsg(""), 3000);
        return () => clearTimeout(timer);
    }, [updateMsg]);

    // ── Maintenance costs persistence (AsyncStorage) ──────────────────────
    // Load 1 lần khi mount. `costsLoaded` chặn effect ghi (bên dưới) chạy
    // trước khi load xong, để không bị ghi đè dữ liệu đã lưu bằng mảng [].
    // `skipNextCostsWriteRef` bỏ qua lần ghi ĐẦU TIÊN ngay sau khi load
    // xong — thời điểm đó `costs` y hệt dữ liệu vừa đọc từ AsyncStorage,
    // ghi lại là dư thừa (1 lần/mỗi lần mở app, không đáng kể nhưng thừa).
    const skipNextCostsWriteRef = useRef(true);

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

    // Ghi lại mỗi khi `costs` đổi (thêm/sửa/xoá), chỉ sau khi đã load xong —
    // và bỏ qua đúng 1 lần ngay sau khi load (xem ghi chú ở ref phía trên).
    useEffect(() => {
        if (!costsLoaded) return;
        if (skipNextCostsWriteRef.current) {
            skipNextCostsWriteRef.current = false;
            return;
        }
        AsyncStorage.setItem(MAINTENANCE_COSTS_STORAGE_KEY, JSON.stringify(costs)).catch(
            (err) => {
                console.error("CashFlow saveCosts:", err);
            }
        );
    }, [costs, costsLoaded]);

    // ── Derived numbers ───────────────────────────────────────────────────
    // useMemo: tránh tính lại ở những re-render không liên quan (vd. gõ tên
    // chi phí đang sửa không cần tính lại doanh thu/thuế/lợi nhuận).
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

    // Tỉ lệ % từng chi phí — tính một lần thành Map, chỉ khi
    // `costs`/`totalMaintenance` đổi, mỗi dòng tra cứu O(1).
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

    // Nhận (id, name, value) trực tiếp từ nơi gọi — dòng đang sửa
    // (MaintenanceCostRow) luôn có sẵn editName/editValue mới nhất trong
    // props của chính nó — thay vì đọc editingId/editName/editValue qua
    // closure. Nhờ vậy hàm này có identity ỔN ĐỊNH VĨNH VIỄN (deps rỗng).
    // TRƯỚC ĐÂY: mỗi lần gõ phím (editName/editValue đổi) → saveEdit bị tạo
    // lại → vì nó được truyền xuống MỌI dòng chi phí (không chỉ dòng đang
    // sửa) → React.memo của TẤT CẢ các dòng bị vô hiệu hoá → gõ 1 phím
    // render lại toàn bộ danh sách chi phí duy trì, dù chỉ 1 dòng thực sự
    // đổi. Đây là nguyên nhân chính khiến việc gõ vào ô sửa/thêm chi phí
    // gây khựng khi danh sách dài.
    const saveEdit = useCallback((id, name, value) => {
        setCosts((prev) =>
            prev.map((c) =>
                c.id === id ? { ...c, name: name.trim(), value: parseFloat(value) || 0 } : c
            )
        );
        setEditingId(null);
    }, []);

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
                        disabled={updateWeightsMutation.isPending || foodWeightsQuery.isLoading}
                        style={{
                            opacity: updateWeightsMutation.isPending || foodWeightsQuery.isLoading ? 0.6 : 1,
                        }}
                        className="flex-row items-center gap-2 px-4 py-2.5 bg-green-600 rounded-xl self-start"
                    >
                        {updateWeightsMutation.isPending ? (
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
                    loadingFetch={foodWeightsQuery.isLoading}
                    hasMore={Boolean(foodWeightsQuery.hasNextPage)}
                    loadingMore={foodWeightsQuery.isFetchingNextPage}
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