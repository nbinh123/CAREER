import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
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
  StickyNote,
  Upload,
  FolderOpen,
} from "lucide-react-native";
import useFruitZustand from "../zustand/useFruitZustand";
import useFoodZustand from "../zustand/useFoodZustand";
import IngredientPicker from "../components/IngredientPicker";
import ImageUploadField from "../components/ImageUploadField";
import fmtVND from "../utils/fmtVND";
import extractCatName from "../utils/extractCatName";
import exportJSON from "../utils/exportJSON";
import importJSON, { pickJSONFile } from "../utils/importJSON";
import { API_URL } from "../config/api";
import colors from "../theme/tokens";

// ─── Constants [GIU-NGUYEN] ────────────────────────────────────────────────
const MIX_CATEGORY = "Trái cây mix";

const EMPTY_FRUIT = {
  fruitName: "",
  note: "",
  isAvailable: true,
  ingredients: [],
};

const EMPTY_COMBO = {
  foodName: "",
  categoryId: MIX_CATEGORY,
  costPrice: 0,
  originalPrice: 0,
  aiTrainingWeight: 0,
  isAvailable: true,
  note: "",
  ingredients: [],
};

// ─── Sub-components dùng chung ─────────────────────────────────────────────

function StatusBadge({ isAvailable }) {
  return (
    <View
      className={`rounded-full ${isAvailable ? "bg-green-100" : "bg-gray-100"}`}
      style={{ paddingHorizontal: 8, paddingVertical: 2 }}
    >
      <Text className={`text-[10px] font-bold ${isAvailable ? "text-green-700" : "text-gray-500"}`}>
        {isAvailable ? "Đang bán" : "Nghỉ"}
      </Text>
    </View>
  );
}

function AvailabilityToggle({ isAvailable, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      className={`rounded-full ${isAvailable ? "bg-green-500" : "bg-gray-300"}`}
      style={{ width: 36, height: 20, justifyContent: "center", padding: 2 }}
    >
      <View
        className="bg-white rounded-full"
        style={{
          width: 14,
          height: 14,
          transform: [{ translateX: isAvailable ? 16 : 0 }],
        }}
      />
    </Pressable>
  );
}

function MarginBar({ margin }) {
  const m = Math.max(0, Math.min(margin, 100));
  const barColor = m > 50 ? colors.green[400] : m > 30 ? colors.amber[500] : colors.red[400];
  const textClass = m > 50 ? "text-green-600" : m > 30 ? "text-amber-600" : "text-red-500";
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <View className="bg-gray-100 rounded-full overflow-hidden" style={{ width: 64, height: 6 }}>
        <View style={{ width: `${m}%`, height: "100%", backgroundColor: barColor, borderRadius: 999 }} />
      </View>
      <Text className={`font-bold text-xs ${textClass}`}>{margin}%</Text>
    </View>
  );
}

// [PERF] Memo hoá: ItemImage được dùng lặp lại trong mỗi Card của danh sách
// (và trong 2 modal chi tiết). Khi component cha (FruitPage) re-render vì lý
// do không liên quan (gõ ô tìm kiếm, gõ trong modal khác...), ItemImage vẫn
// giữ nguyên nếu props (src, name, style) không đổi — tránh phải tính lại
// state `errored` và tránh Image bị "nháy"/tải lại không cần thiết.
const ItemImage = React.memo(function ItemImage({ src, name, style }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <View
        style={style}
        className="items-center justify-center bg-green-50"
      >
        <Text className="text-4xl font-black text-green-200">{name?.[0] ?? "?"}</Text>
      </View>
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
});

/** Nhãn nhỏ dạng label + input, thay cho <FormInput> chung của bản web
 * (không có trong gói bàn giao) — chỉ dùng nội bộ trang này. */
function LabeledInput({ label, value, onChangeText, keyboardType, multiline, rows = 2 }) {
  return (
    <View>
      {!!label && (
        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.gray[300]}
        className="w-full border border-gray-200 rounded-xl text-sm text-gray-700"
        style={[
          { paddingHorizontal: 12, paddingVertical: 10 },
          multiline ? { minHeight: rows * 20, textAlignVertical: "top" } : null,
        ]}
      />
    </View>
  );
}

/** Modal card căn giữa, cùng pattern ModalOverlay đã dùng ở Customers.js —
 * thay cho <Modal open/onClose/title> chung của bản web (không có trong
 * gói bàn giao). Nội dung cuộn được (tương đương max-h-[70vh] overflow-y-
 * auto ở bản gốc). */
function FormModalCard({ visible, onClose, title, children, footer }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          style={{ flex: 1, backgroundColor: "rgba(6,78,59,0.35)", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 460 }}>
            <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "88%" }}>
              <View className="px-5 pt-5 pb-4 flex-row items-start justify-between border-b border-gray-100">
                <Text className="flex-1 text-base font-black text-gray-800" style={{ paddingRight: 12 }}>
                  {title}
                </Text>
                <Pressable onPress={onClose} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
                  <X size={16} color={colors.gray[400]} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
                {children}
              </ScrollView>
              {!!footer && (
                <View className="px-5 py-4 border-t border-gray-100 flex-row justify-end" style={{ gap: 8 }}>
                  {footer}
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalButton({ onPress, label, icon: Icon, variant = "primary", disabled }) {
  const palette = variant === "outline" ? "bg-gray-50 border border-gray-200" : "bg-green-600";
  const textClass = variant === "outline" ? "text-gray-600" : "text-white";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center rounded-xl ${palette}`}
      style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6, opacity: disabled ? 0.5 : 1 }}
    >
      {!!Icon && <Icon size={14} color={variant === "outline" ? colors.gray[500] : colors.white} />}
      <Text className={`text-sm font-bold ${textClass}`}>{label}</Text>
    </Pressable>
  );
}

// ─── Trái cây: Card + Info Modal ───────────────────────────────────────────

// [PERF] Memo hoá FruitCard: đây là item được lặp lại nhiều lần trong danh
// sách. FruitPage re-render liên tục (gõ ô tìm kiếm, gõ trong modal thêm/sửa,
// đổi trạng thái lưu...) nhưng dữ liệu của từng fruit cụ thể thường KHÔNG đổi.
// Kết hợp với việc các callback (onEdit/onInfo/onRemove/onEditNote/
// onToggleAvailable) đã được ổn định bằng useCallback bên dưới, React.memo ở
// đây sẽ chặn được phần lớn re-render thừa của từng Card.
const FruitCard = React.memo(function FruitCard({ fruit, onEdit, onInfo, onRemove, onEditNote, isPending, onToggleAvailable }) {
  return (
    <View
      className={`bg-white rounded-2xl overflow-hidden border ${
        fruit.isAvailable ? "border-gray-100" : "border-gray-200 opacity-60"
      }`}
      style={isPending ? { borderWidth: 2, borderColor: colors.amber[500] } : undefined}
    >
      <View style={{ height: 144 }}>
        <ItemImage src={fruit.imageUrl} name={fruit.fruitName} style={{ width: "100%", height: 144 }} />

        <View
          className="absolute rounded-full bg-white/90"
          style={{ top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 8, paddingRight: 4, paddingVertical: 4 }}
        >
          <Text className={`text-[10px] font-bold ${fruit.isAvailable ? "text-green-600" : "text-gray-400"}`}>
            {fruit.isAvailable ? "Hiện" : "Ẩn"}
          </Text>
          <AvailabilityToggle isAvailable={fruit.isAvailable} onToggle={() => onToggleAvailable(fruit)} />
        </View>

        {!fruit.isAvailable && (
          <View
            className="absolute items-center justify-center"
            style={{ top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(17,24,39,0.4)" }}
          >
            <View className="bg-black/50 rounded-lg" style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text className="text-xs font-bold text-white">Tạm nghỉ</Text>
            </View>
          </View>
        )}
        {isPending && (
          <View
            className="absolute rounded-full bg-amber-400"
            style={{ top: 8, right: 8, paddingHorizontal: 6, paddingVertical: 2 }}
          >
            <Text className="text-[10px] font-bold text-white">Chưa lưu</Text>
          </View>
        )}
      </View>

      <View className="p-4">
        <Text className="font-bold text-gray-800 text-sm" numberOfLines={1}>
          {fruit.fruitName}
        </Text>
        <Text className="text-xs text-gray-400 font-medium" style={{ marginTop: 2, marginBottom: 10 }}>
          {fruit.ingredients?.length || 0} nguyên liệu
        </Text>

        <View className="flex-row items-center border-t border-gray-50" style={{ paddingTop: 10, gap: 8 }}>
          <Pressable
            onPress={() => onEdit(fruit)}
            className="flex-1 flex-row items-center justify-center bg-gray-50 rounded-xl"
            style={{ paddingVertical: 8, gap: 4 }}
          >
            <Edit2 size={12} color={colors.gray[600]} />
            <Text className="text-xs font-bold text-gray-600">Sửa</Text>
          </Pressable>
          <Pressable
            onPress={() => onInfo(fruit)}
            className="flex-1 flex-row items-center justify-center bg-gray-50 rounded-xl"
            style={{ paddingVertical: 8, gap: 4 }}
          >
            <Info size={12} color={colors.gray[600]} />
            <Text className="text-xs font-bold text-gray-600">Chi tiết</Text>
          </Pressable>
          <Pressable
            onPress={() => onEditNote(fruit)}
            className={`rounded-xl ${fruit.note ? "bg-amber-50" : ""}`}
            style={{ padding: 8 }}
          >
            <StickyNote size={14} color={fruit.note ? colors.amber[500] : colors.gray[300]} />
          </Pressable>
          <Pressable onPress={() => onRemove(fruit._id)} className="rounded-xl" style={{ padding: 8 }}>
            <Trash2 size={14} color={colors.red[400]} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

function FruitInfoModal({ fruit, visible, onClose }) {
  if (!fruit) return null;
  const rows = [
    ["Tên loại trái cây", fruit.fruitName],
    ["Trạng thái", fruit.isAvailable ? "Đang bán" : "Tạm nghỉ"],
  ];
  return (
    <FormModalCard
      visible={visible}
      onClose={onClose}
      title={`Chi tiết — ${fruit.fruitName}`}
      footer={<ModalButton onPress={onClose} label="Đóng" variant="outline" />}
    >
      <ItemImage src={fruit.imageUrl} name={fruit.fruitName} style={{ width: "100%", height: 160, borderRadius: 12 }} />
      <View className="border-t border-gray-50">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between border-b border-gray-50" style={{ paddingVertical: 8 }}>
            <Text className="text-gray-500 font-medium text-sm">{label}</Text>
            <Text className="text-gray-800 font-semibold text-sm">{value}</Text>
          </View>
        ))}
      </View>
      {fruit.ingredients?.length > 0 && (
        <View>
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>
            Nguyên liệu
          </Text>
          <View style={{ gap: 6 }}>
            {fruit.ingredients.map((ing, i) => (
              <View
                key={i}
                className="flex-row justify-between bg-gray-50 rounded-lg"
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text className="text-xs text-gray-700 font-medium">{ing.ingredientName}</Text>
                <Text className="text-xs text-gray-500">
                  {ing.quantity} {ing.smallUnit || ing.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {!!fruit.note && (
        <View>
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>
            Ghi chú
          </Text>
          <Text className="text-sm text-gray-600 bg-amber-50 rounded-lg" style={{ padding: 10 }}>
            {fruit.note}
          </Text>
        </View>
      )}
    </FormModalCard>
  );
}

// ─── Combo trái cây mix: Card + Info Modal ─────────────────────────────────

// [PERF] Tương tự FruitCard — memo hoá vì đây là item lặp lại trong danh sách
// combo, và các callback truyền vào đã được ổn định bằng useCallback.
const ComboCard = React.memo(function ComboCard({ combo, onEdit, onInfo, onRemove, onEditNote, isPending }) {
  const margin =
    combo.originalPrice > 0 ? Math.round(((combo.originalPrice - combo.costPrice) / combo.originalPrice) * 100) : 0;

  return (
    <View
      className={`bg-white rounded-2xl overflow-hidden border ${
        combo.isAvailable ? "border-gray-100" : "border-gray-200 opacity-60"
      }`}
      style={isPending ? { borderWidth: 2, borderColor: colors.amber[500] } : undefined}
    >
      <View style={{ height: 144 }}>
        <ItemImage src={combo.imageUrl} name={combo.foodName} style={{ width: "100%", height: 144 }} />
        {!combo.isAvailable && (
          <View
            className="absolute items-center justify-center"
            style={{ top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(229,231,235,0.6)" }}
          >
            <View className="bg-white rounded-lg" style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text className="text-xs font-bold text-gray-500">Tạm nghỉ</Text>
            </View>
          </View>
        )}
        {isPending && (
          <View
            className="absolute rounded-full bg-amber-400"
            style={{ top: 8, right: 8, paddingHorizontal: 6, paddingVertical: 2 }}
          >
            <Text className="text-[10px] font-bold text-white">Chưa lưu</Text>
          </View>
        )}
      </View>

      <View className="p-4">
        <View className="flex-row items-start justify-between" style={{ gap: 8, marginBottom: 4 }}>
          <Text className="font-bold text-gray-800 text-sm flex-1" numberOfLines={1}>
            {combo.foodName}
          </Text>
          <StatusBadge isAvailable={combo.isAvailable} />
        </View>
        <Text className="text-xs text-gray-400 font-medium" style={{ marginBottom: 10 }}>Trái cây mix</Text>

        <View style={{ gap: 6 }}>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">Giá bán</Text>
            <Text className="text-xs font-bold text-green-600">{fmtVND(combo.originalPrice)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs text-gray-500">Giá vốn</Text>
            <Text className="text-xs text-gray-600">{fmtVND(combo.costPrice)}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-xs text-gray-500">Biên LN</Text>
            <MarginBar margin={margin} />
          </View>
        </View>

        <View className="flex-row items-center border-t border-gray-50" style={{ marginTop: 12, paddingTop: 10, gap: 8 }}>
          <Pressable
            onPress={() => onEdit(combo)}
            className="flex-1 flex-row items-center justify-center bg-gray-50 rounded-xl"
            style={{ paddingVertical: 8, gap: 4 }}
          >
            <Edit2 size={12} color={colors.gray[600]} />
            <Text className="text-xs font-bold text-gray-600">Sửa</Text>
          </Pressable>
          <Pressable
            onPress={() => onInfo(combo)}
            className="flex-1 flex-row items-center justify-center bg-gray-50 rounded-xl"
            style={{ paddingVertical: 8, gap: 4 }}
          >
            <Info size={12} color={colors.gray[600]} />
            <Text className="text-xs font-bold text-gray-600">Chi tiết</Text>
          </Pressable>
          <Pressable
            onPress={() => onEditNote(combo)}
            className={`rounded-xl ${combo.note ? "bg-amber-50" : ""}`}
            style={{ padding: 8 }}
          >
            <StickyNote size={14} color={combo.note ? colors.amber[500] : colors.gray[300]} />
          </Pressable>
          <Pressable onPress={() => onRemove(combo._id)} className="rounded-xl" style={{ padding: 8 }}>
            <Trash2 size={14} color={colors.red[400]} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

function ComboInfoModal({ combo, visible, onClose }) {
  if (!combo) return null;
  const pctOff = combo.percentageDiscount ?? 0;
  const fixed = combo.fixedDiscount ?? 0;
  const disc = Math.max(combo.originalPrice * (1 - pctOff / 100) - fixed, 0);
  const profit = disc - combo.costPrice;
  const margin = disc > 0 ? Math.round((profit / disc) * 100) : 0;

  const rows = [
    ["Tên combo", combo.foodName],
    ["Danh mục", "Trái cây mix"],
    ["Trạng thái", combo.isAvailable ? "Đang bán" : "Tạm nghỉ"],
    ["Giá bán gốc", fmtVND(combo.originalPrice)],
    ["Giá vốn", fmtVND(combo.costPrice)],
    ["Giảm %", `${pctOff}%`],
    ["Giảm cố định", fmtVND(fixed)],
    ["Giá sau ưu đãi", fmtVND(disc)],
    ["Lợi nhuận gộp", fmtVND(profit)],
    ["Biên lợi nhuận", `${margin}%`],
    ["Trọng số AI", String(combo.aiTrainingWeight ?? 0)],
  ];

  return (
    <FormModalCard
      visible={visible}
      onClose={onClose}
      title={`Chi tiết — ${combo.foodName}`}
      footer={<ModalButton onPress={onClose} label="Đóng" variant="outline" />}
    >
      <ItemImage src={combo.imageUrl} name={combo.foodName} style={{ width: "100%", height: 160, borderRadius: 12 }} />
      <View className="border-t border-gray-50">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between border-b border-gray-50" style={{ paddingVertical: 8 }}>
            <Text className="text-gray-500 font-medium text-sm">{label}</Text>
            <Text className="text-gray-800 font-semibold text-sm">{value}</Text>
          </View>
        ))}
      </View>
      {combo.ingredients?.length > 0 && (
        <View>
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>
            Nguyên liệu
          </Text>
          <View style={{ gap: 6 }}>
            {combo.ingredients.map((ing, i) => (
              <View
                key={i}
                className="flex-row justify-between bg-gray-50 rounded-lg"
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text className="text-xs text-gray-700 font-medium">{ing.ingredientName}</Text>
                <Text className="text-xs text-gray-500">
                  {ing.quantity} {ing.smallUnit} — {fmtVND(ing.price)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </FormModalCard>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FruitPage() {
  // ── Trái cây đơn lẻ ──
  const {
    fruits,
    loading: fruitLoading,
    error: fruitError,
    getFruits,
    stageAddFruit,
    stageUpdateFruit,
    stageRemoveFruit,
    saveAllChanges: saveAllFruitChanges,
    discardChanges: discardFruitChanges,
    pendingChanges: fruitPendingChanges,
    clearError: clearFruitError,
  } = useFruitZustand();

  // ── Combo trái cây mix (lưu vào bảng Food, danh mục "Trái cây mix") ──
  const {
    foods,
    loading: foodLoading,
    error: foodError,
    getFoods,
    stageAddFood,
    stageUpdateFood,
    stageRemoveFood,
    saveAllChanges: saveAllFoodChanges,
    discardChanges: discardFoodChanges,
    pendingChanges: foodPendingChanges,
    clearError: clearFoodError,
  } = useFoodZustand();

  useEffect(() => {
    getFruits();
    getFoods();
  }, [getFruits, getFoods]);

  const comboFoods = useMemo(() => foods.filter((fd) => extractCatName(fd.categoryId) === MIX_CATEGORY), [foods]);

  // ── State: Trái cây ──
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FRUIT);
  const [editId, setEditId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageFieldKey, setImageFieldKey] = useState(0);
  const [infoFruit, setInfoFruit] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [noteFruit, setNoteFruit] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  // ── State: Combo trái cây mix ──
  const [comboSearch, setComboSearch] = useState("");
  const [comboModal, setComboModal] = useState(null);
  const [comboForm, setComboForm] = useState(EMPTY_COMBO);
  const [comboEditId, setComboEditId] = useState(null);
  const [comboImageFile, setComboImageFile] = useState(null);
  const [comboImageRemoved, setComboImageRemoved] = useState(false);
  const [comboImageFieldKey, setComboImageFieldKey] = useState(0);
  const [infoCombo, setInfoCombo] = useState(null);
  const [comboSaveStatus, setComboSaveStatus] = useState(null);
  const [noteCombo, setNoteCombo] = useState(null);
  const [comboNoteDraft, setComboNoteDraft] = useState("");

  // ── Trái cây: handlers [GIU-NGUYEN logic] ──
  // [PERF] useCallback: các hàm open*/close* này được truyền xuống làm props
  // của FruitCard (đã React.memo). Nếu không ổn định tham chiếu, mỗi lần
  // FruitPage re-render (gõ ô tìm kiếm, gõ trong modal khác...) sẽ tạo hàm
  // mới → phá vỡ React.memo → toàn bộ danh sách vẫn render lại dù dữ liệu
  // không đổi. Các hàm này chỉ gọi setState nên deps rỗng là an toàn.
  const openNoteEdit = useCallback((fr) => {
    setNoteFruit(fr);
    setNoteDraft(fr.note || "");
    setModal("note");
  }, []);

  const handleSaveNote = () => {
    if (!noteFruit) return;
    stageUpdateFruit({ ...noteFruit, note: noteDraft }, null);
    setModal(null);
    setNoteFruit(null);
    setNoteDraft("");
  };

  const pendingCount = fruitPendingChanges.size;

  const computedFruitCost = useMemo(
    () => form.ingredients.reduce((s, r) => s + (r.cost || 0), 0),
    [form.ingredients]
  );

  const filtered = useMemo(
    () => fruits.filter((fr) => (fr?.fruitName || "").toLowerCase().includes(search.toLowerCase())),
    [fruits, search]
  );

  const ff = useCallback((k, v) => setForm((p) => ({ ...p, [k]: v })), []);

  const handleFruitIngredientsChange = useCallback(
    (newIngredients) => setForm((p) => ({ ...p, ingredients: newIngredients })),
    []
  );

  const handleRemoveImage = () => {
    setImageFile(null);
    setImageRemoved(true);
    setImageFieldKey((k) => k + 1);
  };

  const openAdd = useCallback(() => {
    setForm({ ...EMPTY_FRUIT });
    setImageFile(null);
    setImageRemoved(false);
    setModal("add");
  }, []);

  const exportData = () => {
    exportJSON(`${API_URL}/api/fruits`, "fruits");
  };

  const handleImportFruits = async () => {
    setImportError(null);
    setIsImporting(true);
    try {
      const data = await pickJSONFile();
      if (!data) return; // người dùng huỷ chọn file
      await importJSON(`${API_URL}/api/fruits`, data, "fruits");
      await getFruits();
    } catch (err) {
      setImportError(err.message || "Import thất bại");
    } finally {
      setIsImporting(false);
    }
  };

  const openEdit = useCallback((fr) => {
    setForm({
      ...fr,
      ingredients: (fr.ingredients || []).map((i) => ({
        ...i,
        pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0),
      })),
    });
    setImageFile(null);
    setImageRemoved(false);
    setEditId(fr._id);
    setModal("edit");
  }, []);

  const openInfo = useCallback((fr) => {
    setInfoFruit(fr);
    setModal("info");
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    setEditId(null);
    setImageFile(null);
    setImageRemoved(false);
    setNoteFruit(null);
    setNoteDraft("");
  }, []);

  const handleSave = () => {
    if (!form.fruitName.trim()) return;
    const payload = { ...form, costPrice: computedFruitCost };
    if (modal === "add") stageAddFruit(payload, imageFile);
    else stageUpdateFruit({ ...payload, _id: editId }, imageFile);
    closeModal();
  };

  const handleRemove = useCallback((id) => stageRemoveFruit(id), [stageRemoveFruit]);

  const handleToggleAvailable = useCallback(
    (fruit) => stageUpdateFruit({ ...fruit, isAvailable: !fruit.isAvailable }, null),
    [stageUpdateFruit]
  );

  const handleSaveAll = async () => {
    setSaveStatus("saving");
    try {
      await saveAllFruitChanges();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // ── Combo: handlers [GIU-NGUYEN logic] ──
  // [PERF] Tương tự nhóm handler của Trái cây ở trên — ổn định tham chiếu để
  // React.memo trên ComboCard phát huy tác dụng.
  const openComboNoteEdit = useCallback((cb) => {
    setNoteCombo(cb);
    setComboNoteDraft(cb.note || "");
    setComboModal("note");
  }, []);

  const handleComboSaveNote = () => {
    if (!noteCombo) return;
    stageUpdateFood({ ...noteCombo, note: comboNoteDraft }, null);
    setComboModal(null);
    setNoteCombo(null);
    setComboNoteDraft("");
  };

  const comboPendingCount = foodPendingChanges.size;

  const computedComboCost = useMemo(
    () => comboForm.ingredients.reduce((s, r) => s + (r.cost || 0), 0),
    [comboForm.ingredients]
  );
  const comboHasIngredients = comboForm.ingredients.length > 0;

  const filteredCombos = useMemo(
    () => comboFoods.filter((cb) => (cb?.foodName || "").toLowerCase().includes(comboSearch.toLowerCase())),
    [comboFoods, comboSearch]
  );

  const cff = useCallback((k, v) => setComboForm((p) => ({ ...p, [k]: v })), []);

  const handleComboIngredientsChange = useCallback(
    (newIngredients) => setComboForm((p) => ({ ...p, ingredients: newIngredients })),
    []
  );

  const handleComboRemoveImage = () => {
    setComboImageFile(null);
    setComboImageRemoved(true);
    setComboImageFieldKey((k) => k + 1);
  };

  const openComboAdd = useCallback(() => {
    setComboForm({ ...EMPTY_COMBO });
    setComboImageFile(null);
    setComboImageRemoved(false);
    setComboModal("add");
  }, []);

  const openComboEdit = useCallback((cb) => {
    setComboForm({
      ...cb,
      categoryId: MIX_CATEGORY,
      ingredients: (cb.ingredients || []).map((i) => ({
        ...i,
        pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0),
      })),
    });
    setComboImageFile(null);
    setComboImageRemoved(false);
    setComboEditId(cb._id);
    setComboModal("edit");
  }, []);

  const openComboInfo = useCallback((cb) => {
    setInfoCombo(cb);
    setComboModal("info");
  }, []);

  const closeComboModal = useCallback(() => {
    setComboModal(null);
    setComboEditId(null);
    setComboImageFile(null);
    setComboImageRemoved(false);
    setNoteCombo(null);
    setComboNoteDraft("");
  }, []);

  const handleComboSave = () => {
    if (!comboForm.foodName.trim()) return;
    const payload = {
      ...comboForm,
      categoryId: MIX_CATEGORY,
      costPrice: comboHasIngredients ? computedComboCost : comboForm.costPrice,
    };
    if (comboModal === "add") stageAddFood(payload, comboImageFile);
    else stageUpdateFood({ ...payload, _id: comboEditId }, comboImageFile);
    closeComboModal();
  };

  const handleComboRemove = useCallback((id) => stageRemoveFood(id), [stageRemoveFood]);

  const handleComboSaveAll = async () => {
    setComboSaveStatus("saving");
    try {
      await saveAllFoodChanges();
      setComboSaveStatus("saved");
      setTimeout(() => setComboSaveStatus(null), 2500);
    } catch {
      setComboSaveStatus("error");
      setTimeout(() => setComboSaveStatus(null), 3000);
    }
  };

  const comboMarginPreview = (() => {
    const cost = comboHasIngredients ? computedComboCost : comboForm.costPrice;
    return comboForm.originalPrice > 0 ? Math.round(((comboForm.originalPrice - cost) / comboForm.originalPrice) * 100) : 0;
  })();

  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 28 }} keyboardShouldPersistTaps="handled">
        {/* ════════════════════════ TRÁI CÂY ════════════════════════ */}
        <View style={{ gap: 14 }}>
          <View>
            <Text className="text-2xl font-black text-green-900">Trái cây</Text>
            <Text className="text-gray-500 text-sm" style={{ marginTop: 2 }}>
              {fruits.length} loại • {fruits.filter((f) => f.isAvailable).length} đang bán • nguyên liệu cho combo mix bên
              dưới
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
            <Pressable
              onPress={openAdd}
              disabled={fruitLoading}
              className="flex-row items-center bg-green-600 rounded-xl"
              style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}
            >
              <Plus size={15} color={colors.white} />
              <Text className="text-white font-bold text-sm">Thêm loại trái cây</Text>
            </Pressable>
            <Pressable
              onPress={exportData}
              disabled={fruitLoading}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl"
              style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}
            >
              <FolderOpen size={15} color={colors.gray[600]} />
              <Text className="text-gray-600 font-bold text-sm">Xuất JSON</Text>
            </Pressable>
            <Pressable
              onPress={handleImportFruits}
              disabled={fruitLoading || isImporting}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl"
              style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6, opacity: isImporting ? 0.7 : 1 }}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={colors.gray[600]} />
              ) : (
                <Upload size={15} color={colors.gray[600]} />
              )}
              <Text className="text-gray-600 font-bold text-sm">{isImporting ? "Đang tải lên..." : "Tải lên JSON"}</Text>
            </Pressable>
          </View>

          {pendingCount > 0 && (
            <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
              <Pressable
                onPress={discardFruitChanges}
                disabled={fruitLoading}
                className="flex-row items-center border border-gray-200 rounded-xl"
                style={{ paddingHorizontal: 12, paddingVertical: 9, gap: 6 }}
              >
                <RotateCcw size={14} color={colors.gray[500]} />
                <Text className="text-gray-500 font-bold text-sm">Huỷ thay đổi</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveAll}
                disabled={fruitLoading || saveStatus === "saving"}
                className={`flex-row items-center rounded-xl ${
                  saveStatus === "error" ? "bg-red-500" : "bg-amber-500"
                }`}
                style={{ paddingHorizontal: 16, paddingVertical: 9, gap: 6 }}
              >
                {saveStatus === "saving" ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Save size={14} color={colors.white} />
                )}
                <Text className="text-white font-bold text-sm">
                  {saveStatus === "saving" ? "Đang lưu…" : saveStatus === "error" ? "Lỗi, thử lại" : `Lưu ${pendingCount} thay đổi`}
                </Text>
              </Pressable>
            </View>
          )}
          {saveStatus === "saved" && pendingCount === 0 && (
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Check size={14} color={colors.green[600]} />
              <Text className="text-green-600 font-bold text-sm">Đã lưu thành công</Text>
            </View>
          )}

          {!!fruitError && (
            <View className="flex-row items-center justify-between bg-red-50 border border-red-200 rounded-xl" style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text className="text-red-700 text-sm flex-1" style={{ paddingRight: 8 }}>{fruitError}</Text>
              <Pressable onPress={clearFruitError}>
                <X size={14} color={colors.red[600]} />
              </Pressable>
            </View>
          )}
          {!!importError && (
            <View className="flex-row items-center justify-between bg-red-50 border border-red-200 rounded-xl" style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text className="text-red-700 text-sm flex-1" style={{ paddingRight: 8 }}>{importError}</Text>
              <Pressable onPress={() => setImportError(null)}>
                <X size={14} color={colors.red[600]} />
              </Pressable>
            </View>
          )}

          <View style={{ position: "relative", justifyContent: "center" }}>
            <View style={{ position: "absolute", left: 13, zIndex: 1 }}>
              <Search size={14} color={colors.gray[400]} />
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm loại trái cây..."
              placeholderTextColor={colors.gray[300]}
              className="bg-white border border-gray-200 rounded-xl text-sm text-gray-700"
              style={{ paddingLeft: 36, paddingRight: 14, paddingVertical: 11 }}
            />
          </View>

          {fruitLoading && fruits.length === 0 ? (
            <View style={{ gap: 12 }}>
              {[...Array(3)].map((_, i) => (
                <View key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <View style={{ height: 144 }} className="bg-gray-100" />
                  <View className="p-4" style={{ gap: 8 }}>
                    <View className="bg-gray-100 rounded" style={{ height: 16, width: "70%" }} />
                    <View className="bg-gray-100 rounded" style={{ height: 12, width: "45%" }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filtered.map((fruit) => (
                <FruitCard
                  key={fruit._id}
                  fruit={fruit}
                  onEdit={openEdit}
                  onInfo={openInfo}
                  onRemove={handleRemove}
                  onEditNote={openNoteEdit}
                  onToggleAvailable={handleToggleAvailable}
                  isPending={
                    fruitPendingChanges.has(`add:${fruit._id}`) || fruitPendingChanges.has(`update:${fruit._id}`)
                  }
                />
              ))}
              {filtered.length === 0 && (
                <View className="items-center" style={{ paddingVertical: 48 }}>
                  <Text className="text-base font-medium text-gray-400">Không tìm thấy loại trái cây</Text>
                  <Text className="text-sm text-gray-400" style={{ marginTop: 4 }}>Thử thay đổi từ khoá tìm kiếm</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ════════════════════════ COMBO TRÁI CÂY MIX ════════════════════════ */}
        <View style={{ gap: 14, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.gray[100] }}>
          <View>
            <Text className="text-2xl font-black text-green-900">Combo trái cây mix</Text>
            <Text className="text-gray-500 text-sm" style={{ marginTop: 2 }}>
              {comboFoods.length} combo • {comboFoods.filter((c) => c.isAvailable).length} đang bán
            </Text>
          </View>

          <Pressable
            onPress={openComboAdd}
            disabled={foodLoading}
            className="flex-row items-center justify-center bg-green-600 rounded-xl self-start"
            style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}
          >
            <Plus size={15} color={colors.white} />
            <Text className="text-white font-bold text-sm">Thêm combo mix</Text>
          </Pressable>

          {comboPendingCount > 0 && (
            <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
              <Pressable
                onPress={discardFoodChanges}
                disabled={foodLoading}
                className="flex-row items-center border border-gray-200 rounded-xl"
                style={{ paddingHorizontal: 12, paddingVertical: 9, gap: 6 }}
              >
                <RotateCcw size={14} color={colors.gray[500]} />
                <Text className="text-gray-500 font-bold text-sm">Huỷ thay đổi</Text>
              </Pressable>
              <Pressable
                onPress={handleComboSaveAll}
                disabled={foodLoading || comboSaveStatus === "saving"}
                className={`flex-row items-center rounded-xl ${
                  comboSaveStatus === "error" ? "bg-red-500" : "bg-amber-500"
                }`}
                style={{ paddingHorizontal: 16, paddingVertical: 9, gap: 6 }}
              >
                {comboSaveStatus === "saving" ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Save size={14} color={colors.white} />
                )}
                <Text className="text-white font-bold text-sm">
                  {comboSaveStatus === "saving"
                    ? "Đang lưu…"
                    : comboSaveStatus === "error"
                    ? "Lỗi, thử lại"
                    : `Lưu ${comboPendingCount} thay đổi`}
                </Text>
              </Pressable>
            </View>
          )}
          {comboSaveStatus === "saved" && comboPendingCount === 0 && (
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Check size={14} color={colors.green[600]} />
              <Text className="text-green-600 font-bold text-sm">Đã lưu thành công</Text>
            </View>
          )}

          {!!foodError && (
            <View className="flex-row items-center justify-between bg-red-50 border border-red-200 rounded-xl" style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text className="text-red-700 text-sm flex-1" style={{ paddingRight: 8 }}>{foodError}</Text>
              <Pressable onPress={clearFoodError}>
                <X size={14} color={colors.red[600]} />
              </Pressable>
            </View>
          )}

          <View style={{ position: "relative", justifyContent: "center" }}>
            <View style={{ position: "absolute", left: 13, zIndex: 1 }}>
              <Search size={14} color={colors.gray[400]} />
            </View>
            <TextInput
              value={comboSearch}
              onChangeText={setComboSearch}
              placeholder="Tìm combo mix..."
              placeholderTextColor={colors.gray[300]}
              className="bg-white border border-gray-200 rounded-xl text-sm text-gray-700"
              style={{ paddingLeft: 36, paddingRight: 14, paddingVertical: 11 }}
            />
          </View>

          {foodLoading && comboFoods.length === 0 ? (
            <View style={{ gap: 12 }}>
              {[...Array(2)].map((_, i) => (
                <View key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <View style={{ height: 144 }} className="bg-gray-100" />
                  <View className="p-4" style={{ gap: 8 }}>
                    <View className="bg-gray-100 rounded" style={{ height: 16, width: "70%" }} />
                    <View className="bg-gray-100 rounded" style={{ height: 12, width: "45%" }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filteredCombos.map((combo) => (
                <ComboCard
                  key={combo._id}
                  combo={combo}
                  onEdit={openComboEdit}
                  onInfo={openComboInfo}
                  onRemove={handleComboRemove}
                  onEditNote={openComboNoteEdit}
                  isPending={
                    foodPendingChanges.has(`add:${combo._id}`) || foodPendingChanges.has(`update:${combo._id}`)
                  }
                />
              ))}
              {filteredCombos.length === 0 && (
                <View className="items-center" style={{ paddingVertical: 48 }}>
                  <Text className="text-base font-medium text-gray-400">Chưa có combo trái cây mix nào</Text>
                  <Text className="text-sm text-gray-400" style={{ marginTop: 4 }}>
                    Bấm "Thêm combo mix" để tạo combo đầu tiên
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── Modal thêm / sửa trái cây ─────────────────────────────────────── */}
      {/* [PERF] Chỉ mount nội dung modal (bao gồm ImageUploadField, IngredientPicker
          có thể khá nặng) khi thực sự đang mở. Modal của RN chỉ ẩn phần hiển thị
          native khi visible=false, còn cây React con vẫn được render nếu vẫn nằm
          trong JSX — nên bọc điều kiện ở đây để tránh re-render "vô hình" mỗi khi
          FruitPage render lại (gõ ô tìm kiếm, đổi trạng thái lưu...). */}
      {(modal === "add" || modal === "edit") && (
        <FormModalCard
          visible
          onClose={closeModal}
          title={modal === "add" ? "Thêm loại trái cây" : "Chỉnh sửa loại trái cây"}
          footer={
            <>
              <ModalButton onPress={closeModal} label="Hủy" variant="outline" />
              <ModalButton onPress={handleSave} label="Xác nhận" icon={Check} disabled={!form.fruitName.trim()} />
            </>
          }
        >
          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>Ảnh</Text>
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
                <Text className="text-xs text-red-400 font-medium">Xoá ảnh</Text>
              </Pressable>
            )}
          </View>

          <LabeledInput label="Tên loại trái cây *" value={form.fruitName} onChangeText={(t) => ff("fruitName", t)} />

          <IngredientPicker selectedIngredients={form.ingredients} onChange={handleFruitIngredientsChange} />

          <LabeledInput
            label="Ghi chú"
            value={form.note}
            onChangeText={(t) => ff("note", t)}
            multiline
            rows={2}
          />

          <Pressable
            onPress={() => ff("isAvailable", !form.isAvailable)}
            className="flex-row items-center"
            style={{ gap: 8 }}
          >
            <AvailabilityToggle isAvailable={form.isAvailable} onToggle={() => ff("isAvailable", !form.isAvailable)} />
            <Text className="text-sm font-medium text-gray-600">Đang bán</Text>
          </Pressable>
        </FormModalCard>
      )}

      {/* ─── Modal chi tiết trái cây ────────────────────────────────────────── */}
      {modal === "info" && <FruitInfoModal fruit={infoFruit} visible onClose={closeModal} />}

      {/* ─── Modal sửa ghi chú trái cây ─────────────────────────────────────── */}
      {modal === "note" && (
        <FormModalCard
          visible
          onClose={closeModal}
          title={`Ghi chú — ${noteFruit?.fruitName ?? ""}`}
          footer={<ModalButton onPress={handleSaveNote} label="Lưu ghi chú" icon={Check} />}
        >
          <LabeledInput label="Ghi chú" value={noteDraft} onChangeText={setNoteDraft} multiline rows={4} />
        </FormModalCard>
      )}

      {/* ─── Modal thêm / sửa combo mix ─────────────────────────────────────── */}
      {(comboModal === "add" || comboModal === "edit") && (
        <FormModalCard
          visible
          onClose={closeComboModal}
          title={comboModal === "add" ? "Thêm combo trái cây mix" : "Chỉnh sửa combo trái cây mix"}
          footer={
            <>
              <ModalButton onPress={closeComboModal} label="Hủy" variant="outline" />
              <ModalButton onPress={handleComboSave} label="Xác nhận" icon={Check} disabled={!comboForm.foodName.trim()} />
            </>
          }
        >
          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>
              Ảnh combo
            </Text>
            <ImageUploadField
              key={comboImageFieldKey}
              currentUrl={comboImageRemoved ? null : comboForm.imageUrl ?? null}
              onSelect={(file) => {
                setComboImageFile(file);
                setComboImageRemoved(false);
              }}
            />
            {(comboImageFile || (!comboImageRemoved && comboForm.imageUrl)) && (
              <Pressable onPress={handleComboRemoveImage} style={{ marginTop: 6 }}>
                <Text className="text-xs text-red-400 font-medium">Xoá ảnh</Text>
              </Pressable>
            )}
          </View>

          <LabeledInput label="Tên combo *" value={comboForm.foodName} onChangeText={(t) => cff("foodName", t)} />

          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 6 }}>Danh mục</Text>
            <View className="bg-gray-50 border border-gray-200 rounded-xl" style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text className="text-sm text-gray-500 font-medium">Trái cây mix</Text>
            </View>
          </View>

          <IngredientPicker selectedIngredients={comboForm.ingredients} onChange={handleComboIngredientsChange} />

          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 6 }}>Giá vốn (₫)</Text>
            {comboHasIngredients ? (
              <View className="bg-green-50 border border-green-200 rounded-xl" style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text className="text-sm font-semibold text-green-700">
                  {fmtVND(computedComboCost)} <Text className="text-xs font-normal text-green-500">(tự tính)</Text>
                </Text>
              </View>
            ) : (
              <LabeledInput
                value={String(comboForm.costPrice)}
                onChangeText={(t) => cff("costPrice", Number(t) || 0)}
                keyboardType="numeric"
              />
            )}
          </View>

          <LabeledInput
            label="Giá bán (₫)"
            value={String(comboForm.originalPrice)}
            onChangeText={(t) => cff("originalPrice", Number(t) || 0)}
            keyboardType="numeric"
          />

          <LabeledInput
            label="Trọng số AI [0–1]"
            value={String(comboForm.aiTrainingWeight)}
            onChangeText={(t) => cff("aiTrainingWeight", Number(t) || 0)}
            keyboardType="decimal-pad"
          />

          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 6 }}>Biên LN dự kiến</Text>
            <MarginBar margin={comboMarginPreview} />
          </View>

          <LabeledInput
            label="Ghi chú"
            value={comboForm.note}
            onChangeText={(t) => cff("note", t)}
            multiline
            rows={2}
          />

          <Pressable
            onPress={() => cff("isAvailable", !comboForm.isAvailable)}
            className="flex-row items-center"
            style={{ gap: 8 }}
          >
            <AvailabilityToggle
              isAvailable={comboForm.isAvailable}
              onToggle={() => cff("isAvailable", !comboForm.isAvailable)}
            />
            <Text className="text-sm font-medium text-gray-600">Đang bán</Text>
          </Pressable>
        </FormModalCard>
      )}

      {/* ─── Modal chi tiết combo mix ───────────────────────────────────────── */}
      {comboModal === "info" && <ComboInfoModal combo={infoCombo} visible onClose={closeComboModal} />}

      {/* ─── Modal sửa ghi chú combo mix ────────────────────────────────────── */}
      {comboModal === "note" && (
        <FormModalCard
          visible
          onClose={closeComboModal}
          title={`Ghi chú — ${noteCombo?.foodName ?? ""}`}
          footer={<ModalButton onPress={handleComboSaveNote} label="Lưu ghi chú" icon={Check} />}
        >
          <LabeledInput label="Ghi chú" value={comboNoteDraft} onChangeText={setComboNoteDraft} multiline rows={4} />
        </FormModalCard>
      )}
    </View>
  );
}