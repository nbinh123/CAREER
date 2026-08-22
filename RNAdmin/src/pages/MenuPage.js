import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    Modal,
    ActivityIndicator,
    Switch,
    Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from "react-native-reanimated";
import {
    Edit2,
    Plus,
    Search,
    Check,
    Info,
    Save,
    RotateCcw,
    Trash2,
    X,
    FolderOpen,
    RefreshCcw,
    StickyNote,
    Upload,
} from "lucide-react-native";
import fmtVND from "../utils/fmtVND";
import extractCatName from "../utils/extractCatName";
import useFoodZustand from "../zustand/useFoodZustand";
import exportJSON from "../utils/exportJSON";
import importJSON, { pickJSONFile } from "../utils/importJSON";
import { API_URL } from "../config/api";
import ImageUploadField from "../components/ImageUploadField";
import IngredientPicker from "../components/IngredientPicker";
import colors from "../theme/tokens";

// ─── Constants [GIU-NGUYEN] ─────────────────────────────────────────────
/** Danh mục cố định — không cần API */
const CAT_OPTIONS = ["Đồ chiên", "Lẩu", "Chính", "Tráng miệng", "Nước", "Món thêm"];
const CAT_FILTER = ["Tất cả", ...CAT_OPTIONS];

/** Danh mục dùng riêng cho combo trái cây mix — quản lý & hiển thị ở FruitPage, không hiện ở đây */
const MIX_CATEGORY = "Trái cây mix";

// costPrice/originalPrice/aiTrainingWeight giữ dạng chuỗi "0" thay vì số 0
// — lý do platform, xem ghi chú đầu file.
const EMPTY_FOOD = {
    foodName: "",
    categoryId: CAT_OPTIONS[0],
    costPrice: "0",
    originalPrice: "0",
    aiTrainingWeight: "0",
    isAvailable: true,
    note: "",
    ingredients: [],
};

// fmtVND là util bên ngoài — bọc lại kiểu safeCall (giống FoodService) để 1
// giá trị NaN/undefined lọt qua (do API trả thiếu field) không làm crash
// cả cây render. [GIU-NGUYEN]
function safeFmtVND(value) {
    try {
        return fmtVND(Number(value) || 0);
    } catch (err) {
        console.error("[fmtVND]", err);
        return "0₫";
    }
}

// ─── Chuẩn hoá dữ liệu món ăn từ API [GIU-NGUYEN] ───────────────────────
// API/DB đôi khi trả record thiếu field, sai kiểu, hoặc cả phần tử null
// (record lỗi, đang ghi dở...). Toàn bộ phần render bên dưới giả định
// food.foodName là string, food.ingredients là mảng, giá luôn là số...
// nên chuẩn hoá NGAY LÚC NHẬN — 1 chỗ duy nhất — thay vì rải fallback khắp
// nơi và lỡ sót gây crash UI (màn hình trắng khi mở Sửa/Chi tiết).
// Món không có _id thì không thể sửa/xoá/toggle nên loại bỏ luôn (drop).
function normalizeFood(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = raw._id ?? raw.id;
    if (!id) return null;

    const ingredients = Array.isArray(raw.ingredients)
        ? raw.ingredients.filter(Boolean).map((i) => ({
            ...i,
            ingredientName: i.ingredientName ?? "Nguyên liệu (không rõ tên)",
            quantity: Number(i.quantity) || 0,
            cost: Number(i.cost) || 0,
            price: Number(i.price) || 0,
            smallUnit: i.smallUnit ?? "",
        }))
        : [];

    return {
        ...raw,
        _id: id,
        foodName: raw.foodName || "Món chưa đặt tên",
        categoryId: raw.categoryId ?? CAT_OPTIONS[0],
        costPrice: Number(raw.costPrice) || 0,
        originalPrice: Number(raw.originalPrice) || 0,
        aiTrainingWeight: Number(raw.aiTrainingWeight) || 0,
        isAvailable: raw.isAvailable !== false,
        note: raw.note ?? "",
        ingredients,
    };
}

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ (thay Btn/Modal/FormInput dùng chung ở bản web —
   xem ghi chú platform ở đầu file)
════════════════════════════════════════════════════════════ */
const ACTION_VARIANTS = {
    primary: { box: "bg-green-600", text: "text-white" },
    secondary: { box: "bg-white border border-gray-200", text: "text-gray-700" },
    outline: { box: "bg-gray-50 border border-gray-200", text: "text-gray-500" },
    danger: { box: "bg-red-600", text: "text-white" },
};

function ActionBtn({ icon: Icon, label, onPress, variant = "secondary", disabled, loading }) {
    const v = ACTION_VARIANTS[variant] ?? ACTION_VARIANTS.secondary;
    const iconColor = variant === "primary" || variant === "danger" ? colors.white : colors.gray[600];
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={{ opacity: disabled ? 0.5 : 1 }}
            className={`flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-xl ${v.box}`}
        >
            {loading ? (
                <ActivityIndicator size="small" color={iconColor} />
            ) : (
                !!Icon && <Icon size={14} color={iconColor} />
            )}
            <Text className={`text-xs font-bold ${v.text}`}>{label}</Text>
        </Pressable>
    );
}

function IconBtn({ icon: Icon, onPress, tone = "default" }) {
    const TONE = {
        default: { box: "bg-gray-50", color: colors.gray[500] },
        danger: { box: "bg-red-50", color: colors.red[600] },
        active: { box: "bg-amber-50", color: "#f59e0b" },
    };
    const t = TONE[tone] ?? TONE.default;
    return (
        <Pressable onPress={onPress} className={`w-8 h-8 rounded-xl items-center justify-center ${t.box}`}>
            <Icon size={14} color={t.color} />
        </Pressable>
    );
}

function FieldInput({ label, required, value, onChangeText, keyboardType = "default", multiline, full }) {
    return (
        <View className={full ? "w-full" : "w-[47%]"} style={{ marginBottom: 12 }}>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                {label}
                {required && <Text className="text-red-500"> *</Text>}
            </Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                multiline={multiline}
                placeholderTextColor={colors.gray[300]}
                className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800"
                style={multiline ? { minHeight: 64, textAlignVertical: "top" } : undefined}
            />
        </View>
    );
}

/* Overlay dùng chung cho cả 3 modal — tương đương e.stopPropagation() bên web */
function ModalOverlay({ onClose, children }) {
    return (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: "rgba(20,83,45,0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 20,
                }}
            >
                <Pressable onPress={() => { }} style={{ width: "100%", maxWidth: 460 }}>
                    {children}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

/* ── Skeleton card lúc loading lần đầu (thay lưới 8 ô .animate-pulse) ──── */
function FoodCardSkeleton() {
    const opacity = useSharedValue(1);
    useEffect(() => {
        opacity.value = withRepeat(
            withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
        );
    }, [opacity]);
    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={animStyle} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <View className="bg-gray-100" style={{ height: 120 }} />
            <View className="p-4" style={{ gap: 8 }}>
                <View className="bg-gray-100 rounded" style={{ width: "70%", height: 14 }} />
                <View className="bg-gray-100 rounded" style={{ width: "40%", height: 10 }} />
            </View>
        </Animated.View>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function StatusBadge({ isAvailable }) {
    return (
        <View className={`px-2 py-0.5 rounded-full ${isAvailable ? "bg-green-100" : "bg-gray-100"}`}>
            <Text className={`text-[10px] font-bold ${isAvailable ? "text-green-700" : "text-gray-500"}`}>
                {isAvailable ? "Đang bán" : "Nghỉ"}
            </Text>
        </View>
    );
}

function AvailabilityToggle({ isAvailable, onToggle }) {
    return (
        <Switch
            value={isAvailable}
            onValueChange={onToggle}
            trackColor={{ false: colors.gray[200], true: colors.green[400] }}
            thumbColor={colors.white}
        />
    );
}

function MarginBar({ margin }) {
    const m = Math.max(0, Math.min(margin, 100));
    const barColor = m > 50 ? colors.green[400] : m > 30 ? "#fbbf24" : colors.red[400];
    const textClass = m > 50 ? "text-green-600" : m > 30 ? "text-amber-600" : "text-red-500";
    return (
        <View className="flex-row items-center" style={{ gap: 6 }}>
            <View className="bg-gray-100 rounded-full overflow-hidden" style={{ width: 64, height: 6 }}>
                <View style={{ width: `${m}%`, height: "100%", backgroundColor: barColor, borderRadius: 3 }} />
            </View>
            <Text className={`font-bold text-xs ${textClass}`}>{margin}%</Text>
        </View>
    );
}

function FoodImage({ src, name, style }) {
    const [errored, setErrored] = useState(false);
    if (!src || errored) {
        return (
            <LinearGradient
                colors={[colors.green[50], colors.emerald[50], "#f0fdfa"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[{ alignItems: "center", justifyContent: "center" }, style]}
            >
                <Text style={{ fontSize: 34, fontWeight: "900", color: colors.green[200] }}>
                    {name?.[0] ?? "?"}
                </Text>
            </LinearGradient>
        );
    }
    return (
        <Image
            source={{ uri: src }}
            onError={() => setErrored(true)}
            style={style}
            resizeMode="cover"
        />
    );
}

function FoodCard({ food, onEdit, onInfo, onRemove, onEditNote, isPending, onToggleAvailable }) {
    const margin =
        food.originalPrice > 0
            ? Math.round(((food.originalPrice - food.costPrice) / food.originalPrice) * 100)
            : 0;
    const catName = extractCatName(food.categoryId);

    return (
        <View
            className="bg-white rounded-2xl border overflow-hidden"
            style={[
                { borderColor: food.isAvailable ? colors.gray[100] : colors.gray[200] },
                !food.isAvailable && { opacity: 0.75 },
                isPending && { borderWidth: 2, borderColor: "#fcd34d" },
            ]}
        >
            <View style={{ height: 120, position: "relative" }}>
                <FoodImage src={food.imageUrl} name={food.foodName} style={{ width: "100%", height: 120 }} />

                {!food.isAvailable && (
                    <View
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                        className="bg-gray-200/60 items-center justify-center"
                    >
                        <View className="bg-white rounded-lg px-2 py-1">
                            <Text className="text-xs font-bold text-gray-500">Tạm nghỉ</Text>
                        </View>
                    </View>
                )}

                {isPending && (
                    <View style={{ position: "absolute", top: 8, right: 8 }} className="bg-amber-400 rounded-full px-1.5 py-0.5">
                        <Text className="text-white text-[10px] font-bold">Chưa lưu</Text>
                    </View>
                )}
            </View>

            <View className="p-4">
                <View className="flex-row items-start justify-between mb-1" style={{ gap: 8 }}>
                    <Text className="flex-1 font-bold text-gray-800 text-sm" numberOfLines={2}>
                        {food.foodName}
                    </Text>
                    <View className="items-end" style={{ gap: 4 }}>
                        <StatusBadge isAvailable={food.isAvailable} />
                        <AvailabilityToggle isAvailable={food.isAvailable} onToggle={() => onToggleAvailable(food)} />
                    </View>
                </View>
                <Text className="text-xs text-gray-400 font-semibold mb-3">{catName || "—"}</Text>

                <View style={{ gap: 6 }}>
                    <View className="flex-row justify-between">
                        <Text className="text-xs text-gray-500">Giá bán</Text>
                        <Text className="text-xs font-bold text-green-600">{safeFmtVND(food.originalPrice)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-xs text-gray-500">Giá vốn</Text>
                        <Text className="text-xs text-gray-600">{safeFmtVND(food.costPrice)}</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                        <Text className="text-xs text-gray-500">Biên LN</Text>
                        <MarginBar margin={margin} />
                    </View>
                </View>

                <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50" style={{ gap: 8 }}>
                    <Pressable
                        onPress={() => onEdit(food)}
                        className="flex-1 flex-row items-center justify-center bg-white border border-gray-200 rounded-xl"
                        style={{ paddingVertical: 8, gap: 5 }}
                    >
                        <Edit2 size={12} color={colors.gray[600]} />
                        <Text className="text-xs font-bold text-gray-700">Sửa</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => onInfo(food)}
                        className="flex-1 flex-row items-center justify-center bg-white border border-gray-200 rounded-xl"
                        style={{ paddingVertical: 8, gap: 5 }}
                    >
                        <Info size={12} color={colors.gray[600]} />
                        <Text className="text-xs font-bold text-gray-700">Chi tiết</Text>
                    </Pressable>
                    <IconBtn icon={StickyNote} tone={food.note ? "active" : "default"} onPress={() => onEditNote(food)} />
                    <IconBtn icon={Trash2} tone="danger" onPress={() => onRemove(food._id)} />
                </View>
            </View>
        </View>
    );
}

// ─── Info Modal ─────────────────────────────────────────────────────────

function InfoModal({ food, open, onClose }) {
    if (!open || !food) return null;
    const catName = extractCatName(food.categoryId);
    const pct = food.percentageDiscount ?? food.categoryId?.percentageDiscount ?? 0;
    const fixed = food.fixedDiscount ?? food.categoryId?.fixedDiscount ?? 0;
    const disc = Math.max(food.originalPrice * (1 - pct / 100) - fixed, 0);
    const profit = disc - food.costPrice;
    const margin = disc > 0 ? Math.round((profit / disc) * 100) : 0;

    const rows = [
        ["Tên món", food.foodName],
        ["Danh mục", catName || "—"],
        ["Trạng thái", food.isAvailable ? "Đang bán" : "Tạm nghỉ"],
        ["Giá bán gốc", safeFmtVND(food.originalPrice)],
        ["Giá vốn", safeFmtVND(food.costPrice)],
        ["Giảm %", `${pct}%`],
        ["Giảm cố định", safeFmtVND(fixed)],
        ["Giá sau ưu đãi", safeFmtVND(disc)],
        ["Lợi nhuận gộp", safeFmtVND(profit)],
        ["Biên lợi nhuận", `${margin}%`],
        ["Trọng số AI", food.aiTrainingWeight ?? 0],
    ];

    return (
        <ModalOverlay onClose={onClose}>
            <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "88%" }}>
                <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100">
                    <Text className="text-base font-black text-green-900 flex-1" numberOfLines={1}>
                        Chi tiết — {food.foodName}
                    </Text>
                    <Pressable onPress={onClose} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
                        <X size={16} color={colors.gray[400]} />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <FoodImage
                        src={food.imageUrl}
                        name={food.foodName}
                        style={{ width: "100%", height: 160, borderRadius: 14, marginBottom: 16, overflow: "hidden" }}
                    />

                    <View className="border border-gray-50 rounded-xl overflow-hidden">
                        {rows.map(([label, value], idx) => (
                            <View
                                key={label}
                                className={`flex-row justify-between px-3.5 py-2.5 ${idx > 0 ? "border-t border-gray-50" : ""}`}
                            >
                                <Text className="text-gray-500 font-medium text-xs">{label}</Text>
                                <Text className="text-gray-800 font-bold text-xs">{value}</Text>
                            </View>
                        ))}
                    </View>

                    {food.ingredients?.length > 0 && (
                        <View className="mt-4">
                            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Nguyên liệu</Text>
                            <View style={{ gap: 6 }}>
                                {food.ingredients.map((ing, i) => (
                                    <View key={i} className="flex-row justify-between bg-gray-50 rounded-lg px-3 py-2">
                                        <Text className="text-gray-700 font-semibold text-xs">{ing.ingredientName}</Text>
                                        <Text className="text-gray-500 text-xs">
                                            {ing.quantity} {ing.smallUnit} — {safeFmtVND(ing.price)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </ScrollView>

                <View className="flex-row justify-end px-5 py-4 border-t border-gray-100">
                    <Pressable onPress={onClose} className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                        <Text className="text-sm font-bold text-gray-600">Đóng</Text>
                    </Pressable>
                </View>
            </View>
        </ModalOverlay>
    );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function MenuPage() {
    const {
        foods,
        loading,
        error,
        getFoods,
        stageAddFood,
        stageUpdateFood,
        stageRemoveFood,
        saveAllChanges,
        discardChanges,
        pendingChanges,
        clearError,
        refreshCosts,
    } = useFoodZustand();

    const [catFilter, setCatFilter] = useState("Tất cả");
    const [search, setSearch] = useState("");
    const [modal, setModal] = useState(null); // null | "add" | "edit" | "info" | "note"
    const [form, setForm] = useState(EMPTY_FOOD);
    const [editId, setEditId] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [imageRemoved, setImageRemoved] = useState(false);
    const [imageFieldKey, setImageFieldKey] = useState(0);
    const [infoFood, setInfoFood] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null);
    const [noteFood, setNoteFood] = useState(null);
    const [noteDraft, setNoteDraft] = useState("");
    const [refreshMsg, setRefreshMsg] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState(null);

    const openNoteEdit = (fd) => {
        setNoteFood(fd);
        setNoteDraft(fd.note || "");
        setModal("note");
    };

    const handleSaveNote = () => {
        if (!noteFood) return;
        stageUpdateFood({ ...noteFood, note: noteDraft }, null); // không đổi ảnh
        setModal(null);
        setNoteFood(null);
        setNoteDraft("");
    };

    useEffect(() => {
        getFoods();
    }, [getFoods]);

    const pendingCount = pendingChanges.size;

    // Chuẩn hoá 1 lần duy nhất — mọi chỗ dưới đây đọc từ đây, không đọc `foods`
    // thô nữa, để không phải lo record lỗi/thiếu field từ API. [GIU-NGUYEN]
    const normalizedFoods = useMemo(
        () => (Array.isArray(foods) ? foods.map(normalizeFood).filter(Boolean) : []),
        [foods]
    );

    // Món hiển thị ở thực đơn — loại trừ các combo "Trái cây mix" (quản lý riêng ở trang Trái cây)
    const visibleFoods = useMemo(
        () => normalizedFoods.filter((fd) => extractCatName(fd.categoryId) !== MIX_CATEGORY),
        [normalizedFoods]
    );

    // Giá vốn tự tính từ nguyên liệu (luôn là Number, IngredientPicker tự tính ngay lúc thay đổi)
    const computedCostPrice = useMemo(
        () => form.ingredients.reduce((s, r) => s + (Number(r.cost) || 0), 0),
        [form.ingredients]
    );
    const hasIngredients = form.ingredients.length > 0;

    // Filter
    const filtered = useMemo(
        () =>
            visibleFoods.filter((fd) => {
                const catName = extractCatName(fd.categoryId);
                const matchCat = catFilter === "Tất cả" || catName === catFilter;
                const matchQ = fd.foodName.toLowerCase().includes(search.toLowerCase());
                return matchCat && matchQ;
            }),
        [visibleFoods, catFilter, search]
    );

    // Form helpers
    const ff = useCallback((k, v) => setForm((p) => ({ ...p, [k]: v })), []);

    const handleRemoveImage = () => {
        setImageFile(null);
        setImageRemoved(true);
        setImageFieldKey((k) => k + 1); // ép ImageUploadField remount → xoá preview nội bộ
    };

    const handleIngredientsChange = useCallback(
        (newIngredients) => setForm((p) => ({ ...p, ingredients: newIngredients })),
        []
    );

    // Modal controls
    const openAdd = () => {
        setForm({ ...EMPTY_FOOD });
        setImageFile(null);
        setImageRemoved(false);
        setModal("add");
    };

    const exportData = () => {
        exportJSON(`${API_URL}/api/foods`, "foods").catch((err) => {
            console.error("exportData:", err);
        });
    };

    const handleImportPick = async () => {
        setImportError(null);
        setIsImporting(true);
        try {
            const data = await pickJSONFile();
            if (!data) return; // người dùng huỷ chọn file
            await importJSON(`${API_URL}/api/foods`, data, "foods");
            await getFoods(); // tải lại danh sách mới nhất
        } catch (err) {
            setImportError(err?.message || "Import thất bại");
        } finally {
            setIsImporting(false);
        }
    };

    const openEdit = (fd) => {
        setForm({
            ...fd,
            categoryId: extractCatName(fd.categoryId),
            costPrice: String(fd.costPrice),
            originalPrice: String(fd.originalPrice),
            aiTrainingWeight: String(fd.aiTrainingWeight),
            ingredients: (fd.ingredients || []).map((i) => ({
                ...i,
                quantity: String(i.quantity),
                pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0),
            })),
        });
        setImageFile(null);
        setImageRemoved(false);
        setEditId(fd._id);
        setModal("edit");
    };

    const openInfo = (fd) => {
        setInfoFood(fd);
        setModal("info");
    };
    const closeModal = () => {
        setModal(null);
        setEditId(null);
        setImageFile(null);
        setImageRemoved(false);
        setNoteFood(null);
        setNoteDraft("");
    };

    // Staged actions
    const handleSave = () => {
        if (!form.foodName.trim()) return;
        const payload = {
            ...form,
            costPrice: hasIngredients ? computedCostPrice : Number(form.costPrice) || 0,
            originalPrice: Number(form.originalPrice) || 0,
            aiTrainingWeight: Number(form.aiTrainingWeight) || 0,
            ingredients: form.ingredients.map((i) => ({ ...i, quantity: Number(i.quantity) || 0 })),
        };
        if (modal === "add") stageAddFood(payload, imageFile);
        else stageUpdateFood({ ...payload, _id: editId }, imageFile);
        closeModal();
    };

    const handleRemove = useCallback((id) => stageRemoveFood(id), [stageRemoveFood]);

    const handleToggleAvailable = useCallback(
        (food) => stageUpdateFood({ ...food, isAvailable: !food.isAvailable }, null),
        [stageUpdateFood]
    );

    const handleRefreshCosts = async () => {
        try {
            const data = await refreshCosts();
            setRefreshMsg(`Đã cập nhật giá cho ${data?.updatedCount ?? 0} món`);
        } catch {
            setRefreshMsg("Cập nhật giá thất bại");
        } finally {
            setTimeout(() => setRefreshMsg(null), 3000);
        }
    };

    const handleSaveAll = async () => {
        setSaveStatus("saving");
        try {
            await saveAllChanges();
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus(null), 2500);
        } catch {
            setSaveStatus("error");
            setTimeout(() => setSaveStatus(null), 3000);
        }
    };

    // Margin sống trong modal thêm/sửa (theo giá vốn tạm tính, chưa lưu)
    const liveCost = hasIngredients ? computedCostPrice : Number(form.costPrice) || 0;
    const liveOriginal = Number(form.originalPrice) || 0;
    const liveMargin = liveOriginal > 0 ? Math.round(((liveOriginal - liveCost) / liveOriginal) * 100) : 0;

    return (
        <View style={{ flex: 1 }} className="bg-gray-50">
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
                {/* ── Header ────────────────────────────────────────────────── */}
                <View>
                    <Text className="text-2xl font-black text-green-900">Thực đơn</Text>
                    <Text className="text-gray-500 text-sm mt-0.5">
                        {visibleFoods.length} món • {visibleFoods.filter((f) => f.isAvailable).length} đang bán
                    </Text>
                </View>

                {/* ── Toolbar hành động ────────────────────────────────────── */}
                <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
                    {pendingCount > 0 && (
                        <>
                            <ActionBtn icon={RotateCcw} label="Huỷ thay đổi" variant="outline" disabled={loading} onPress={discardChanges} />
                            <Pressable
                                onPress={handleSaveAll}
                                disabled={loading || saveStatus === "saving"}
                                style={{ opacity: loading || saveStatus === "saving" ? 0.6 : 1 }}
                                className={`flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl ${saveStatus === "saving" ? "bg-amber-400" : saveStatus === "error" ? "bg-red-500" : "bg-amber-500"
                                    }`}
                            >
                                <Save size={14} color={colors.white} />
                                <Text className="text-sm font-bold text-white">
                                    {saveStatus === "saving" ? "Đang lưu…" : saveStatus === "error" ? "Lỗi, thử lại" : `Lưu ${pendingCount} thay đổi`}
                                </Text>
                            </Pressable>
                        </>
                    )}
                    {saveStatus === "saved" && pendingCount === 0 && (
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                            <Check size={14} color={colors.green[600]} />
                            <Text className="text-sm text-green-600 font-bold">Đã lưu thành công</Text>
                        </View>
                    )}

                    <ActionBtn icon={Plus} label="Thêm món mới" variant="primary" disabled={loading} onPress={openAdd} />

                    {refreshMsg && (
                        <View className="flex-row items-center" style={{ gap: 4 }}>
                            <Check size={14} color={colors.blue[500]} />
                            <Text className="text-sm text-blue-600 font-bold">{refreshMsg}</Text>
                        </View>
                    )}
                    <ActionBtn
                        icon={RefreshCcw}
                        label="Làm mới"
                        loading={loading}
                        disabled={loading || pendingCount > 0}
                        onPress={handleRefreshCosts}
                    />
                    <ActionBtn icon={FolderOpen} label="Xuất JSON" disabled={loading} onPress={exportData} />
                    <ActionBtn
                        icon={Upload}
                        label={isImporting ? "Đang tải lên..." : "Tải lên JSON"}
                        loading={isImporting}
                        disabled={loading || isImporting}
                        onPress={handleImportPick}
                    />
                </View>

                {/* ── Banner lỗi ───────────────────────────────────────────── */}
                {!!error && (
                    <View className="flex-row items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <Text className="flex-1 text-red-700 text-sm">{error}</Text>
                        <Pressable onPress={clearError}>
                            <X size={14} color={colors.red[600]} />
                        </Pressable>
                    </View>
                )}
                {!!importError && (
                    <View className="flex-row items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <Text className="flex-1 text-red-700 text-sm">{importError}</Text>
                        <Pressable onPress={() => setImportError(null)}>
                            <X size={14} color={colors.red[600]} />
                        </Pressable>
                    </View>
                )}

                {/* ── Search + Filter ──────────────────────────────────────── */}
                <View style={{ gap: 10 }}>
                    <View style={{ position: "relative", justifyContent: "center" }}>
                        <View style={{ position: "absolute", left: 14, zIndex: 1 }}>
                            <Search size={14} color={colors.gray[400]} />
                        </View>
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Tìm món ăn..."
                            placeholderTextColor={colors.gray[300]}
                            className="bg-white border border-gray-200 rounded-xl text-sm text-gray-800"
                            style={{ paddingLeft: 38, paddingRight: 14, paddingVertical: 11 }}
                        />
                    </View>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {CAT_FILTER.map((c) => (
                            <Pressable
                                key={c}
                                onPress={() => setCatFilter(c)}
                                style={{ paddingHorizontal: 12, paddingVertical: 7 }}
                                className={`rounded-xl ${catFilter === c ? "bg-green-500" : "bg-white border border-gray-200"}`}
                            >
                                <Text className={`text-xs font-bold ${catFilter === c ? "text-white" : "text-gray-600"}`}>{c}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* ── Skeleton ─────────────────────────────────────────────── */}
                {loading && visibleFoods.length === 0 && (
                    <View style={{ gap: 12 }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <FoodCardSkeleton key={i} />
                        ))}
                    </View>
                )}

                {/* ── Danh sách món (1 cột full-width — xem ghi chú platform) ─ */}
                {(!loading || visibleFoods.length > 0) && (
                    <View style={{ gap: 12 }}>
                        {filtered.map((food) => (
                            <FoodCard
                                key={food._id}
                                food={food}
                                onEdit={openEdit}
                                onInfo={openInfo}
                                onRemove={handleRemove}
                                onEditNote={openNoteEdit}
                                onToggleAvailable={handleToggleAvailable}
                                isPending={pendingChanges.has(`add:${food._id}`) || pendingChanges.has(`update:${food._id}`)}
                            />
                        ))}
                        {filtered.length === 0 && (
                            <View className="items-center py-16">
                                <Text className="text-base font-bold text-gray-400">Không tìm thấy món ăn</Text>
                                <Text className="text-sm text-gray-300 mt-1">Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* ─── Modal thêm / sửa ──────────────────────────────────────────── */}
            {(modal === "add" || modal === "edit") && (
                <ModalOverlay onClose={closeModal}>
                    <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "90%" }}>
                        <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100">
                            <Text className="text-base font-black text-green-900">
                                {modal === "add" ? "Thêm món mới" : "Chỉnh sửa món ăn"}
                            </Text>
                            <Pressable onPress={closeModal} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
                                <X size={16} color={colors.gray[400]} />
                            </Pressable>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
                            {/* Ảnh */}
                            <View style={{ marginBottom: 14 }}>
                                <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ảnh món ăn</Text>
                                <ImageUploadField
                                    key={imageFieldKey}
                                    currentUrl={imageRemoved ? null : form.imageUrl ?? null}
                                    onSelect={(file) => {
                                        setImageFile(file);
                                        setImageRemoved(false);
                                    }}
                                />
                                {(imageFile || (!imageRemoved && form.imageUrl)) && (
                                    <Pressable onPress={handleRemoveImage} style={{ marginTop: 6 }}>
                                        <Text className="text-xs text-red-400 font-semibold">Xoá ảnh</Text>
                                    </Pressable>
                                )}
                            </View>

                            {/* Tên */}
                            <FieldInput label="Tên món" required full value={form.foodName} onChangeText={(t) => ff("foodName", t)} />

                            {/* Danh mục — pill chọn 1/6 (không có Picker RN trong dự án) */}
                            <View style={{ marginBottom: 14 }}>
                                <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Danh mục</Text>
                                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                    {CAT_OPTIONS.map((c) => (
                                        <Pressable
                                            key={c}
                                            onPress={() => ff("categoryId", c)}
                                            style={{ paddingHorizontal: 12, paddingVertical: 7 }}
                                            className={`rounded-xl ${form.categoryId === c ? "bg-green-500" : "bg-white border border-gray-200"}`}
                                        >
                                            <Text className={`text-xs font-bold ${form.categoryId === c ? "text-white" : "text-gray-600"}`}>{c}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Nguyên liệu */}
                            <View style={{ marginBottom: 14 }}>
                                <IngredientPicker selectedIngredients={form.ingredients} onChange={handleIngredientsChange} />
                            </View>

                            {/* Giá */}
                            <View className="flex-row flex-wrap justify-between">
                                <View className="w-[47%]" style={{ marginBottom: 12 }}>
                                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Giá vốn (₫)</Text>
                                    {hasIngredients ? (
                                        <View className="border border-green-200 bg-green-50 rounded-xl px-3.5 py-2.5 flex-row items-baseline" style={{ gap: 4 }}>
                                            <Text className="text-sm font-bold text-green-700">{safeFmtVND(computedCostPrice)}</Text>
                                            <Text className="text-xs font-normal text-green-500">(tự tính)</Text>
                                        </View>
                                    ) : (
                                        <TextInput
                                            value={form.costPrice}
                                            onChangeText={(t) => ff("costPrice", t)}
                                            keyboardType="decimal-pad"
                                            className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800"
                                        />
                                    )}
                                </View>

                                <FieldInput
                                    label="Giá bán (₫)"
                                    keyboardType="decimal-pad"
                                    value={form.originalPrice}
                                    onChangeText={(t) => ff("originalPrice", t)}
                                />

                                <FieldInput
                                    label="Trọng số AI [0–1]"
                                    keyboardType="decimal-pad"
                                    value={form.aiTrainingWeight}
                                    onChangeText={(t) => ff("aiTrainingWeight", t)}
                                />

                                <View className="w-[47%]" style={{ marginBottom: 12 }}>
                                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Biên LN dự kiến</Text>
                                    <View style={{ paddingTop: 8 }}>
                                        <MarginBar margin={liveMargin} />
                                    </View>
                                </View>
                            </View>

                            {/* Ghi chú */}
                            <FieldInput label="Ghi chú" full multiline value={form.note} onChangeText={(t) => ff("note", t)} />

                            {/* Trạng thái */}
                            <View className="flex-row items-center justify-between" style={{ marginBottom: 16 }}>
                                <Text className="text-sm font-medium text-gray-600">Đang bán</Text>
                                <Switch
                                    value={form.isAvailable}
                                    onValueChange={(v) => ff("isAvailable", v)}
                                    trackColor={{ false: colors.gray[200], true: colors.green[400] }}
                                    thumbColor={colors.white}
                                />
                            </View>
                        </ScrollView>

                        <View className="flex-row justify-end gap-2 px-5 py-4 border-t border-gray-100">
                            <Pressable onPress={closeModal} className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                                <Text className="text-sm font-bold text-gray-600">Hủy</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSave}
                                disabled={!form.foodName.trim()}
                                style={{ opacity: !form.foodName.trim() ? 0.5 : 1 }}
                                className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-600"
                            >
                                <Check size={14} color={colors.white} />
                                <Text className="text-sm font-bold text-white">Xác nhận</Text>
                            </Pressable>
                        </View>
                    </View>
                </ModalOverlay>
            )}

            {/* ─── Modal chi tiết ─────────────────────────────────────────────── */}
            <InfoModal food={infoFood} open={modal === "info"} onClose={closeModal} />

            {/* ─── Modal sửa ghi chú ─────────────────────────────────────────── */}
            {modal === "note" && (
                <ModalOverlay onClose={closeModal}>
                    <View className="bg-white rounded-3xl overflow-hidden">
                        <View className="px-6 pt-6 pb-4 border-b border-gray-100">
                            <Text className="text-base font-black text-green-900" numberOfLines={1}>
                                Ghi chú — {noteFood?.foodName ?? ""}
                            </Text>
                        </View>
                        <View style={{ padding: 20 }}>
                            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Ghi chú</Text>
                            <TextInput
                                autoFocus
                                multiline
                                value={noteDraft}
                                onChangeText={setNoteDraft}
                                placeholder="Nhập ghi chú cho món này..."
                                placeholderTextColor={colors.gray[300]}
                                className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800"
                                style={{ minHeight: 90, textAlignVertical: "top" }}
                            />
                        </View>
                        <View className="flex-row justify-end gap-2 px-5 pb-5">
                            <Pressable onPress={closeModal} className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                                <Text className="text-sm font-bold text-gray-600">Hủy</Text>
                            </Pressable>
                            <Pressable onPress={handleSaveNote} className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-600">
                                <Check size={14} color={colors.white} />
                                <Text className="text-sm font-bold text-white">Lưu ghi chú</Text>
                            </Pressable>
                        </View>
                    </View>
                </ModalOverlay>
            )}
        </View>
    );
}