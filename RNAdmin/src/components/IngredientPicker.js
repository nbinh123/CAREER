// src/components/IngredientPicker.js
// [UI] Component chọn nguyên liệu cho công thức món ăn — bản web gốc dùng
// "../components/IngredientPicker" (props selectedIngredients/onChange),
// tách file riêng giống ImageUploadField.js vì đây là component thật sự
// dùng chung ở bản web (khác Btn/Modal/FormInput mà IngredientsPage.js đã
// phải dựng nội bộ vì không tồn tại sẵn trong dự án RN).
//
// KHÔNG có mã nguồn IngredientPicker.js gốc để đối chiếu 1-1 — chỉ có
// MenuPage.js gốc dùng nó qua 2 props, nên hành vi bên trong được dựng lại
// dựa trên cách MenuPage.js gốc TIÊU THỤ kết quả:
//   - normalizeFood ép ingredients[].quantity/cost/price thành Number,
//     ingredientName/smallUnit thành string.
//   - computedCostPrice = tổng ing.cost của form.ingredients (không phải
//     ing.price) → cost là nguồn tính giá vốn món.
//   - InfoModal hiển thị "{quantity} {smallUnit} — {fmtVND(price)}" cho mỗi
//     dòng nguyên liệu.
//   - Dòng DUY NHẤT còn sót lại tiết lộ công thức, trong openEdit của
//     MenuPage.js gốc:
//       pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0)
//     → suy ngược đúng công thức cost = quantity * pricePerLargeUnit, tức
//     "pricePerLargeUnit" ở MỖI DÒNG NGUYÊN LIỆU CỦA MÓN là giá cho 1 đơn vị
//     nguyên liệu dùng trong công thức (copy từ Ingredient.pricePerLargeUnit
//     lúc chọn) — KHÔNG quy đổi qua Ingredient.quantity tồn kho (trường đó
//     chỉ phục vụ cảnh báo tồn kho ở IngredientsPage.js, không liên quan
//     giá vốn món ăn).
//   - "price" không có nguồn nào khác để suy ra ngoài "cost" → tạm coi
//     price = cost (2 field tách biệt trong state như bản gốc nhưng cùng
//     giá trị). Nếu sau này tìm lại được IngredientPicker.js gốc thật, cần
//     đối chiếu lại đúng/sai của giả định này.
//
// Khác biệt platform:
//   - Không dùng FlatList cho danh sách nguyên liệu để chọn (tránh cảnh báo
//     "VirtualizedLists should never be nested inside plain ScrollViews" vì
//     component này luôn được đặt trong ScrollView của modal thêm/sửa món ở
//     MenuPage.js) — dùng ScrollView bị giới hạn chiều cao + nestedScrollEnabled,
//     đúng tinh thần "không dùng FlatList" đã nhất quán trong toàn dự án
//     (IngredientsPage.js/Customers.js đều dùng .map() thường).
//   - Ô nhập số lượng giữ dạng CHUỖI trong state lúc đang gõ (đúng pattern
//     NUMERIC_FIELDS đã dùng ở IngredientsPage.js) vì RN TextInput không có
//     buffer hiển thị riêng như <input type="number"> bên web.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { Plus, X, Search, ChevronUp } from "lucide-react-native";
import useIngredientZustand from "../zustand/useIngredientZustand";
import fmtVND from "../utils/fmtVND";
import colors from "../theme/tokens";

export default function IngredientPicker({ selectedIngredients, onChange }) {
    const ingredients = useIngredientZustand((s) => s.ingredients);
    const getIngredients = useIngredientZustand((s) => s.getIngredients);
    const [query, setQuery] = useState("");
    const [browseOpen, setBrowseOpen] = useState(false);

    useEffect(() => {
        getIngredients();
    }, [getIngredients]);

    const safeIngredients = Array.isArray(ingredients) ? ingredients : [];
    const selected = Array.isArray(selectedIngredients) ? selectedIngredients : [];

    const selectedIds = useMemo(
        () => new Set(selected.map((s) => s.ingredientId ?? s._id)),
        [selected]
    );

    const options = useMemo(() => {
        const q = query.trim().toLowerCase();
        return safeIngredients
            .filter((i) => !selectedIds.has(i._id))
            .filter((i) => !q || (i.ingredientName || "").toLowerCase().includes(q));
    }, [safeIngredients, selectedIds, query]);

    const totalCost = useMemo(
        () => selected.reduce((s, r) => s + (Number(r.cost) || 0), 0),
        [selected]
    );

    const addIngredient = (ing) => {
        const unitCost = Number(ing.pricePerLargeUnit) || 0;
        onChange([
            ...selected,
            {
                ingredientId: ing._id,
                ingredientName: ing.ingredientName,
                smallUnit: ing.smallUnit || "",
                quantity: "1",
                pricePerLargeUnit: unitCost,
                cost: unitCost,
                price: unitCost,
            },
        ]);
        setQuery("");
    };

    const setQuantity = (idx, text) => {
        const next = selected.map((row, i) => {
            if (i !== idx) return row;
            const qty = Number(text) || 0;
            const unitCost = Number(row.pricePerLargeUnit) || 0;
            const cost = qty * unitCost;
            return { ...row, quantity: text, cost, price: cost };
        });
        onChange(next);
    };

    const removeAt = (idx) => onChange(selected.filter((_, i) => i !== idx));

    return (
        <View>
            <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Nguyên liệu ({selected.length})
                </Text>
                {selected.length > 0 && (
                    <Text className="text-xs font-bold text-green-600">{fmtVND(totalCost)}</Text>
                )}
            </View>

            {/* Danh sách nguyên liệu đã chọn cho món */}
            {selected.length > 0 && (
                <View className="border border-gray-200 rounded-xl overflow-hidden mb-2">
                    {selected.map((row, idx) => (
                        <View
                            key={row.ingredientId ?? idx}
                            className={`flex-row items-center px-3 py-2.5 ${idx > 0 ? "border-t border-gray-100" : ""}`}
                            style={{ gap: 8 }}
                        >
                            <Text className="flex-1 text-xs font-semibold text-gray-700" numberOfLines={1}>
                                {row.ingredientName}
                            </Text>
                            <TextInput
                                value={String(row.quantity)}
                                onChangeText={(t) => setQuantity(idx, t)}
                                keyboardType="decimal-pad"
                                className="bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 text-center"
                                style={{ width: 52, paddingVertical: 6 }}
                            />
                            <Text className="text-[11px] text-gray-400" style={{ width: 26 }} numberOfLines={1}>
                                {row.smallUnit}
                            </Text>
                            <Text className="text-xs font-bold text-gray-600" style={{ width: 74, textAlign: "right" }}>
                                {fmtVND(row.cost)}
                            </Text>
                            <Pressable
                                onPress={() => removeAt(idx)}
                                className="w-6 h-6 rounded-md bg-red-50 items-center justify-center"
                            >
                                <X size={12} color={colors.red[600]} />
                            </Pressable>
                        </View>
                    ))}
                </View>
            )}

            {/* Mở/đóng khu vực tìm & thêm nguyên liệu */}
            <Pressable
                onPress={() => setBrowseOpen((v) => !v)}
                className="flex-row items-center justify-center border border-dashed rounded-xl py-2.5"
                style={{ borderColor: colors.green[300], gap: 6 }}
            >
                {browseOpen ? (
                    <ChevronUp size={14} color={colors.green[600]} />
                ) : (
                    <Plus size={14} color={colors.green[600]} />
                )}
                <Text className="text-xs font-bold text-green-600">
                    {browseOpen ? "Đóng danh sách" : "Thêm nguyên liệu"}
                </Text>
            </Pressable>

            {browseOpen && (
                <View className="border border-gray-200 rounded-xl mt-2 overflow-hidden">
                    <View className="flex-row items-center px-3 py-2 border-b border-gray-100" style={{ gap: 6 }}>
                        <Search size={13} color={colors.gray[400]} />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Tìm nguyên liệu..."
                            placeholderTextColor={colors.gray[300]}
                            className="flex-1 text-xs text-gray-700"
                            style={{ paddingVertical: 4 }}
                        />
                    </View>
                    <ScrollView
                        style={{ maxHeight: 220 }}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                    >
                        {options.length === 0 ? (
                            <View className="py-6 items-center">
                                <Text className="text-xs text-gray-300 font-semibold">
                                    {safeIngredients.length === 0 ? "Chưa có nguyên liệu nào trong kho" : "Không còn nguyên liệu phù hợp"}
                                </Text>
                            </View>
                        ) : (
                            options.map((ing, i) => (
                                <Pressable
                                    key={ing._id}
                                    onPress={() => addIngredient(ing)}
                                    className={`flex-row items-center justify-between px-3 py-2.5 ${i > 0 ? "border-t border-gray-50" : ""}`}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text className="text-xs font-semibold text-gray-700">{ing.ingredientName}</Text>
                                        <Text className="text-[10px] text-gray-400 mt-0.5">
                                            {fmtVND(ing.pricePerLargeUnit)} / {ing.smallUnit}
                                        </Text>
                                    </View>
                                    <Plus size={14} color={colors.green[500]} />
                                </Pressable>
                            ))
                        )}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}