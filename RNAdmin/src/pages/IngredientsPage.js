import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Edit2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  Upload,
} from "lucide-react-native";
import fmtVND from "../utils/fmtVND";
import importJSON, { pickJSONFile } from "../utils/importJSON";
import { API_URL } from "../config/api";
import useIngredientsQuery, { INGREDIENTS_QUERY_KEY } from "../hooks/useIngredientsQuery";
import useSaveAllIngredientChanges from "../hooks/useSaveAllIngredientChanges";
import useIngredientDraftZustand from "../zustand/useIngredientDraftZustand";
import colors from "../theme/tokens";

// ─── Constants [GIU-NGUYEN] ─────────────────────────────────────────────
const EMPTY_ING = {
  displayOrder: 0,
  ingredientName: "",
  quantity: 0,
  smallUnit: "",
  largeUnit: "",
  pricePerLargeUnit: 0,
  expiryDays: 0,
  note: "",
  needContinuousRestock: false,
};

const EMPTY_PENDING = { added: [], updated: [], deleted: [] };

const NUMERIC_FIELDS = ["displayOrder", "quantity", "pricePerLargeUnit", "expiryDays"];

// [TỐI ƯU] Thời gian debounce cho ô tìm kiếm (ms).
const SEARCH_DEBOUNCE_MS = 300;

// [TỐI ƯU] Hoist các giá trị/element KHÔNG phụ thuộc props/state ra ngoài
// component — tránh bị tạo mới (object/array/JSX mới) trên MỌI lần render
// của IngredientsPage. Cùng tinh thần với EMPTY_ING/EMPTY_PENDING đã có.
const EMPTY_LIST = [];
const COLUMN_WRAPPER_STYLE = { justifyContent: "space-between" };
const LIST_CONTENT_CONTAINER_STYLE = { padding: 16, paddingBottom: 40, flexGrow: 1 };
const EMPTY_STATE = (
  <View className="bg-white rounded-2xl border border-gray-100 items-center py-14 px-6">
    <Text style={{ fontSize: 34 }}>🥬</Text>
    <Text className="text-sm text-gray-300 font-bold mt-2">Không tìm thấy nguyên liệu nào</Text>
  </View>
);

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ (thay Btn/Modal/FormInput dùng chung ở bản web)
════════════════════════════════════════════════════════════ */
const ACTION_VARIANTS = {
  primary: { box: "bg-green-600", text: "text-white" },
  secondary: { box: "bg-white border border-gray-200", text: "text-gray-700" },
  outline: { box: "bg-gray-50 border border-gray-200", text: "text-gray-500" },
  danger: { box: "bg-red-600", text: "text-white" },
};

// ─── Hiệu ứng bấm nút (co nhẹ khi nhấn) ─────────────────────────────────
// ActionBtn/IconBtn giờ bọc trong Animated.View + scale qua Reanimated,
// giữ đúng convention "Reanimated animations" đã thống nhất cho RNAdmin.
//
// [TỐI ƯU] Bọc React.memo: đây là các nút tái sử dụng nhiều lần trong toolbar
// và trong từng thẻ nguyên liệu (IconBtn). Không memo thì mỗi lần component
// cha re-render (gõ tìm kiếm, mở modal...) toàn bộ nút cũng re-render theo dù
// props không đổi — cùng nguyên nhân chính khiến trang bị giật khi danh sách
// nguyên liệu dài.
const ActionBtn = React.memo(function ActionBtn({ icon: Icon, label, onPress, variant = "secondary", disabled, loading, badge }) {
  const v = ACTION_VARIANTS[variant] ?? ACTION_VARIANTS.secondary;
  const iconColor = variant === "primary" || variant === "danger" ? colors.white : colors.gray[600];
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        style={{ opacity: disabled ? 0.5 : 1 }}
        className={`flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-xl ${v.box}`}
      >
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          !!Icon && <Icon size={14} color={iconColor} />
        )}
        <Text className={`text-xs font-bold ${v.text}`}>{label}</Text>
        {!!badge && (
          <View className="ml-0.5 w-4 h-4 rounded-full bg-amber-500 items-center justify-center">
            <Text className="text-white text-[9px] font-black">{badge}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

// Nút Sửa/Xóa: to hơn (w-10 h-10, icon 18) + hiệu ứng co khi bấm
// [TỐI ƯU] React.memo — mỗi thẻ nguyên liệu có 2 IconBtn, danh sách càng dài
// thì phần này càng nhân lên; memo giúp chỉ re-render đúng nút bị đổi props.
const IconBtn = React.memo(function IconBtn({ icon: Icon, onPress, danger }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.9, { duration: 80 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        className={`w-10 h-10 rounded-lg items-center justify-center ${danger ? "bg-red-50" : "bg-gray-50"}`}
      >
        <Icon size={18} color={danger ? colors.red[600] : colors.gray[500]} />
      </Pressable>
    </Animated.View>
  );
});

// [TỐI ƯU] React.memo — form Thêm/Sửa có 8 field, mỗi lần gõ 1 ô thì cả 7 ô
// còn lại không cần vẽ lại nếu value/onChangeText của chúng không đổi.
//
// [TỐI ƯU] `field` + `onChange` thay vì nhận thẳng `onChangeText` đã bind
// sẵn: handler onChangeText giờ được tạo NGAY BÊN TRONG FieldInput qua
// useCallback, phụ thuộc `field` (string cố định) và `onChange` (chính là
// `setField` ở component cha — đã ổn định qua useCallback). Nhờ vậy gõ 1
// ô chỉ đúng 1 FieldInput đó vẽ lại, 7 ô còn lại giữ nguyên.
const FieldInput = React.memo(function FieldInput({ label, required, field, value, onChange, keyboardType = "default", multiline, full }) {
  const handleChangeText = useCallback((t) => onChange(field, t), [onChange, field]);

  return (
    <View className={full ? "w-full" : "w-[47%]"} style={{ marginBottom: 12 }}>
      <Text className="text-xs font-semibold text-gray-500 mb-1.5">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.gray[300]}
        className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800"
        style={multiline ? { minHeight: 64, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
});

/* Overlay dùng chung cho cả 3 modal.
   [SỬA LỖI] Backdrop (đóng khi bấm ra ngoài) và nội dung modal là 2 phần
   tử NGANG HÀNG (anh em) thay vì cha–con, để không có Pressable nào bọc
   quanh nội dung "nuốt" mất cử chỉ kéo khi bắt đầu từ vùng trống bên
   trong ScrollView của form. */
function ModalOverlay({ onClose, children }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(20,83,45,0.35)",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Pressable
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{ width: "100%", maxWidth: 440 }} pointerEvents="box-none">
          {children}
        </View>
      </View>
    </Modal>
  );
}

/* ── Trạng thái pending của 1 thẻ nguyên liệu ────────────────────────────
   Trước đây chỉ tô viền trái (borderLeft) vì các hàng nằm sát nhau trong
   1 khối bảng. Giờ mỗi nguyên liệu là 1 thẻ độc lập có viền bao quanh
   (theo yêu cầu), nên trạng thái pending đổi màu toàn bộ viền + nền. */
const ROW_ACCENT = {
  added: { backgroundColor: colors.green[50], borderColor: colors.green[400] },
  updated: { backgroundColor: "#fffbeb", borderColor: "#fbbf24" },
  normal: { backgroundColor: colors.white, borderColor: colors.gray[100] },
};

function RowStatusBadge({ status }) {
  if (status === "added") {
    return (
      <View className="bg-green-100 px-1.5 py-0.5 rounded-md">
        <Text className="text-[10px] font-bold text-green-600">Mới</Text>
      </View>
    );
  }
  if (status === "updated") {
    return (
      <View className="bg-amber-100 px-1.5 py-0.5 rounded-md">
        <Text className="text-[10px] font-bold text-amber-600">Đã sửa</Text>
      </View>
    );
  }
  return null;
}

function expiryMeta(expiryDays) {
  if (expiryDays === null || expiryDays === undefined) {
    return { label: "—", bg: "bg-gray-100", text: "text-gray-500" };
  }
  if (expiryDays <= 1) return { label: `${expiryDays}d`, bg: "bg-red-100", text: "text-red-600" };
  if (expiryDays <= 7) return { label: `${expiryDays}d`, bg: "bg-amber-100", text: "text-amber-700" };
  return { label: `${expiryDays}d`, bg: "bg-green-100", text: "text-green-700" };
}

/* ── 1 nguyên liệu = 1 thẻ có viền riêng, xếp lưới 2 cột ─────────────────
   [TỐI ƯU] React.memo — component nặng nhất vì lặp lại theo số nguyên
   liệu. Memo chỉ có tác dụng khi props (ing, status, onEdit, onDelete)
   giữ nguyên tham chiếu giữa các lần render. */
const IngredientCard = React.memo(function IngredientCard({ ing, status, onEdit, onDelete }) {
  const quantity = ing.quantity ?? 0;
  const expiry = expiryMeta(ing.expiryDays);
  const accent = ROW_ACCENT[status] ?? ROW_ACCENT.normal;

  // [TỐI ƯU] useCallback theo `ing`/`onEdit`/`onDelete` — tránh tạo hàm
  // onPress mới cho IconBtn mỗi lần IngredientCard render lại (kể cả khi
  // chỉ đổi `status`), giữ đúng tác dụng React.memo trên IconBtn.
  const handleEditPress = useCallback(() => onEdit(ing), [onEdit, ing]);
  const handleDeletePress = useCallback(() => onDelete(ing._id), [onDelete, ing._id]);

  return (
    <View
      style={[
        { width: "100%", borderWidth: 1, borderRadius: 16, marginBottom: 12 },
        accent,
      ]}
      className="px-4 py-3.5"
    >
      <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
            <Text className="text-[11px] text-gray-400">#{ing.displayOrder}</Text>
            <RowStatusBadge status={status} />
          </View>
          <Text className="text-sm font-bold text-gray-800 mt-0.5" numberOfLines={1}>
            {ing.ingredientName || "—"}
          </Text>
        </View>
        <View className="flex-row" style={{ gap: 6 }}>
          <IconBtn icon={Edit2} onPress={handleEditPress} />
          <IconBtn icon={Trash2} danger onPress={handleDeletePress} />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center mt-2" style={{ gap: 12 }}>
        <Text className="text-xs text-gray-500">
          SL: <Text className="font-semibold text-gray-700">{quantity.toLocaleString("vi-VN")} {ing.smallUnit}</Text>
        </Text>
        <Text className="text-xs text-gray-500">
          ĐVL: <Text className="font-semibold text-gray-700">{ing.largeUnit || "—"}</Text>
        </Text>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-xs text-gray-500">
          Giá/ĐVL: <Text className="font-semibold text-gray-700">{fmtVND(ing.pricePerLargeUnit)}</Text>
        </Text>
        <View className={`px-2 py-0.5 rounded-full ${expiry.bg}`}>
          <Text className={`text-[11px] font-bold ${expiry.text}`}>{expiry.label}</Text>
        </View>
      </View>

      {!!ing.note && (
        <Text className="text-xs text-gray-400 mt-2" numberOfLines={2}>
          Ghi chú: {ing.note}
        </Text>
      )}

      {ing.needContinuousRestock && (
        <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
          <AlertTriangle size={12} color="#ea580c" />
          <Text className="text-xs font-semibold text-orange-600">Cần bổ sung liên tục</Text>
        </View>
      )}
    </View>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function IngredientsPage() {
  // ─── Dữ liệu server: react-query [TỐI ƯU - react-query] ───────────────
  // Danh sách nguyên liệu từ server giờ do react-query quản lý: fetch,
  // cache, dedupe request trùng, tự retry theo cấu hình trong
  // queryClient.js, tự refetch khi mất mạng có lại/quay lại app (nhờ
  // useOnlineManager/useAppState đã gắn ở App.js). Không cần tự viết
  // isLoading/getIngredients() + useEffect gọi lúc mount như trước.
  //
  // [GLOBAL - LƯU Ý] useIngredientZustand.js gốc (ingredients/isLoading/
  // getIngredients...) được GIỮ NGUYÊN, không đụng tới — rất có thể còn
  // màn hình khác (vd IngredientPicker trong form món ăn/trái cây, theo
  // comment trong chính store đó) đang phụ thuộc đúng interface cũ. Trang
  // này chuyển sang nguồn dữ liệu MỚI, độc lập, không ảnh hưởng màn hình
  // khác. Muốn migrate toàn app sang react-query cần rà từng nơi dùng
  // useIngredientZustand — nằm ngoài phạm vi trang này.
  const ingredientsQuery = useIngredientsQuery();
  const serverIngredients = ingredientsQuery.data ?? EMPTY_LIST;
  const isLoading = ingredientsQuery.isLoading;

  const queryClient = useQueryClient();

  // ─── Bản nháp thêm/sửa/xóa chưa lưu: Zustand (store mới, tách riêng) ──
  const pendingChanges = useIngredientDraftZustand((s) => s.pendingChanges);
  const addLocal = useIngredientDraftZustand((s) => s.addLocal);
  const editLocal = useIngredientDraftZustand((s) => s.editLocal);
  const deleteLocal = useIngredientDraftZustand((s) => s.deleteLocal);
  const clearPending = useIngredientDraftZustand((s) => s.clearPending);

  // ─── Lưu tất cả thay đổi: react-query mutation ────────────────────────
  // isPending/error có sẵn từ react-query, không cần tự quản lý
  // isSaving/saveError thủ công như bản Zustand cũ.
  const saveAllMutation = useSaveAllIngredientChanges();
  const isSaving = saveAllMutation.isPending;
  const saveError = saveAllMutation.error?.message ?? null;
  const resetSaveError = saveAllMutation.reset;

  // ─── Dữ liệu, ép kiểu an toàn [GIU-NGUYEN tinh thần bản gốc] ──────────
  const safePending =
    pendingChanges &&
    Array.isArray(pendingChanges.added) &&
    Array.isArray(pendingChanges.updated) &&
    Array.isArray(pendingChanges.deleted)
      ? pendingChanges
      : EMPTY_PENDING;

  // [TỐI ƯU - react-query] "ingredients" hiển thị = dữ liệu server (từ
  // react-query) đè thêm bản nháp pending (added/updated/deleted) — đúng
  // 1:1 kết quả mà bản Zustand cũ tạo ra bằng cách mutate incremental,
  // chỉ khác là giờ tính lại (useMemo) từ 2 nguồn thay vì lưu sẵn 1 bản
  // trộn sẵn. Thứ tự giữ nguyên: nguyên liệu cũ giữ đúng vị trí, nguyên
  // liệu mới thêm nối vào cuối — khớp hành vi addIngredientLocal gốc.
  const safeIngredients = useMemo(() => {
    const deletedSet = new Set(safePending.deleted);
    const updatedMap = new Map(safePending.updated.map((i) => [i._id, i]));
    const base = serverIngredients
      .filter((i) => !deletedSet.has(i._id))
      .map((i) => updatedMap.get(i._id) ?? i);
    return [...base, ...safePending.added];
  }, [serverIngredients, safePending]);

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const [search, setSearch] = useState("");
  // [TỐI ƯU] Debounce search — `search` phản ánh tức thời những gì người
  // dùng gõ (để ô input mượt, không giật), còn `debouncedSearch` mới là
  // giá trị dùng để lọc danh sách, chỉ cập nhật 300ms sau khi người dùng
  // ngừng gõ.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "add" | "edit"
  const [form, setForm] = useState(EMPTY_ING);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  // [TỐI ƯU] Debounce timer cho search — huỷ timer cũ mỗi khi `search`
  // đổi, chỉ set `debouncedSearch` sau khi người dùng dừng gõ đủ
  // SEARCH_DEBOUNCE_MS.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Thống kê pending ───────────────────────────────────────────────
  const pendingCount = safePending.added.length + safePending.updated.length + safePending.deleted.length;
  const hasPending = pendingCount > 0;

  // ─── Danh sách sau khi lọc tìm kiếm ───────────────────────────────────
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return safeIngredients;
    return safeIngredients.filter((i) =>
      (i.ingredientName || "").toLowerCase().includes(q)
    );
  }, [safeIngredients, debouncedSearch]);

  // ─── Tra trạng thái pending theo id — O(1) thay vì .some() từng phần tử ─
  const pendingStatusMap = useMemo(() => {
    const map = new Map();
    safePending.added.forEach((i) => map.set(i._id, "added"));
    safePending.updated.forEach((i) => map.set(i._id, "updated"));
    return map;
  }, [safePending.added, safePending.updated]);

  const getRowStatus = useCallback(
    (ing) => pendingStatusMap.get(ing._id) || "normal",
    [pendingStatusMap]
  );

  // ─── Helpers form ───────────────────────────────────────────────────
  const setField = useCallback((key, val) => setForm((prev) => ({ ...prev, [key]: val })), []);

  // [LƯU Ý - đổi hành vi nhỏ] Bản gốc gọi lại getIngredients() (cache-
  // first) sau khi import — vì ingredients thường đã có sẵn dữ liệu từ
  // trước, hàm đó gần như không làm gì (bug có sẵn từ trước, không phải
  // do bước tối ưu này gây ra: comment "tải lại danh sách mới nhất từ
  // server" không khớp hành vi thực tế). invalidateQueries ở đây đảm bảo
  // LUÔN tải lại đúng như ý đồ ban đầu của comment — báo trước để bạn xác
  // nhận đây là thay đổi mong muốn.
  const handleImportPick = useCallback(async () => {
    setImportError(null);
    setIsImporting(true);
    try {
      const data = await pickJSONFile();
      if (!data) return; // người dùng huỷ chọn file
      await importJSON(`${API_URL}/api/ingredients`, data, "ingredients");
      await queryClient.invalidateQueries({ queryKey: INGREDIENTS_QUERY_KEY });
    } catch (err) {
      setImportError(err?.message || "Import thất bại");
    } finally {
      setIsImporting(false);
    }
  }, [queryClient]);

  const openAdd = useCallback(() => {
    setForm(EMPTY_ING);
    setModal("add");
  }, []);

  const openEdit = useCallback((ing) => {
    setForm({ ...EMPTY_ING, ...ing });
    setEditId(ing._id);
    setModal("edit");
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    setEditId(null);
  }, []);

  // ─── CRUD local (chưa gọi API) ────────────────────────────────────────
  const handleSave = useCallback(() => {
    const name = (form.ingredientName || "").trim();
    if (!name) return;

    const payload = { ...form, ingredientName: name };
    NUMERIC_FIELDS.forEach((key) => {
      payload[key] = Number(payload[key]) || 0;
    });

    if (modal === "add") {
      addLocal(payload);
    } else {
      editLocal({ ...payload, _id: editId });
    }
    closeModal();
  }, [form, modal, editId, addLocal, editLocal, closeModal]);

  const handleDelete = useCallback(() => {
    deleteLocal(deleteId);
    setDeleteId(null);
  }, [deleteLocal, deleteId]);

  // ─── Lưu tất cả lên server: react-query mutation ──────────────────────
  // [TỐI ƯU - react-query] mutate() tự nuốt lỗi nội bộ (lưu vào
  // saveAllMutation.error) — không cần try/catch thủ công như trước.
  const handleSaveAll = useCallback(() => {
    saveAllMutation.mutate();
  }, [saveAllMutation]);

  const openDiscard = useCallback(() => setDiscardOpen(true), []);
  const closeDiscard = useCallback(() => setDiscardOpen(false), []);
  const closeDeleteModal = useCallback(() => setDeleteId(null), []);
  const closeImportError = useCallback(() => setImportError(null), []);

  // [TỐI ƯU - react-query] Huỷ thay đổi = ép tải lại dữ liệu server mới
  // nhất (refetchQueries bỏ qua staleTime, luôn gọi API — đúng ý đồ gốc
  // "tải lại từ server") + xoá bản nháp pending.
  const confirmDiscard = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: INGREDIENTS_QUERY_KEY });
    clearPending();
    setDiscardOpen(false);
  }, [queryClient, clearPending]);

  // [TỐI ƯU] renderItem bọc useCallback để giữ nguyên tham chiếu hàm giữa
  // các lần render — FlatList dùng identity của renderItem khi quyết định
  // có cần vẽ lại cell hay không.
  const renderItem = useCallback(
    ({ item }) => (
      <IngredientCard
        ing={item}
        status={getRowStatus(item)}
        onEdit={openEdit}
        onDelete={setDeleteId}
      />
    ),
    [getRowStatus, openEdit]
  );

  // [TỐI ƯU] Header (tiêu đề, toolbar, banner lỗi, legend, ô tìm kiếm) tách
  // riêng làm ListHeaderComponent, bọc useMemo với dependency chính xác —
  // loại trừ hoàn toàn state của modal Thêm/Sửa (form, modal, editId,
  // deleteId, discardOpen) nên gõ trong modal KHÔNG còn làm toolbar/ô tìm
  // kiếm/legend vẽ lại.
  const listHeader = useMemo(
    () => (
      <View style={{ gap: 14, marginBottom: 14 }}>
        {/* ── Header ────────────────────────────────────────────────── */}
        <View>
          <Text className="text-2xl font-black text-green-900">Nguyên liệu</Text>
          <Text className="text-gray-500 text-sm mt-0.5">
            {safeIngredients.length} nguyên liệu trong kho
            {hasPending && (
              <Text className="text-amber-600 font-semibold"> • {pendingCount} thay đổi chưa lưu</Text>
            )}
          </Text>
        </View>

        {/* ── Toolbar hành động ────────────────────────────────────── */}
        <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
          {hasPending && (
            <ActionBtn icon={X} label="Huỷ thay đổi" variant="outline" onPress={openDiscard} />
          )}
          <ActionBtn
            icon={Save}
            label={isSaving ? "Đang lưu..." : "Lưu tất cả thay đổi"}
            variant={hasPending ? "primary" : "secondary"}
            disabled={!hasPending || isSaving}
            loading={isSaving}
            badge={!isSaving ? pendingCount : 0}
            onPress={handleSaveAll}
          />
          <ActionBtn icon={Plus} label="Thêm nguyên liệu" onPress={openAdd} />
          <ActionBtn
            icon={Upload}
            label={isImporting ? "Đang tải lên..." : "Tải lên JSON"}
            loading={isImporting}
            onPress={handleImportPick}
          />
        </View>

        {/* ── Banner lỗi lưu ───────────────────────────────────────── */}
        {!!saveError && (
          <View className="flex-row items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="flex-1 text-red-700 text-sm">{saveError}</Text>
            <Pressable onPress={resetSaveError}>
              <X size={16} color={colors.red[600]} />
            </Pressable>
          </View>
        )}
        {!!importError && (
          <View className="flex-row items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="flex-1 text-red-700 text-sm">{importError}</Text>
            <Pressable onPress={closeImportError}>
              <X size={16} color={colors.red[600]} />
            </Pressable>
          </View>
        )}

        {/* ── Legend pending ───────────────────────────────────────── */}
        {hasPending && (
          <View className="flex-row flex-wrap items-center bg-white border border-gray-100 rounded-xl px-4 py-2.5" style={{ gap: 12 }}>
            <Text className="text-xs font-semibold text-gray-600">Trạng thái chưa lưu:</Text>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.green[400] }} />
              <Text className="text-xs text-gray-500">Mới thêm ({safePending.added.length})</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "#fbbf24" }} />
              <Text className="text-xs text-gray-500">Đã sửa ({safePending.updated.length})</Text>
            </View>
            <Text className="text-xs text-red-500">Sẽ xóa ({safePending.deleted.length})</Text>
          </View>
        )}

        {/* ── Search ───────────────────────────────────────────────── */}
        <View style={{ position: "relative", justifyContent: "center" }}>
          <View style={{ position: "absolute", left: 14, zIndex: 1 }}>
            <Search size={15} color={colors.gray[400]} />
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm nguyên liệu..."
            placeholderTextColor={colors.gray[300]}
            className="bg-white border border-gray-200 rounded-xl text-sm text-gray-800"
            style={{ paddingLeft: 38, paddingRight: 16, paddingVertical: 11 }}
          />
        </View>

        {isLoading && (
          <View className="bg-white rounded-2xl border border-gray-100 flex-row items-center justify-center py-16" style={{ gap: 8 }}>
            <ActivityIndicator size="small" color={colors.gray[400]} />
            <Text className="text-sm text-gray-400">Đang tải nguyên liệu...</Text>
          </View>
        )}
      </View>
    ),
    [
      safeIngredients.length,
      hasPending,
      pendingCount,
      openDiscard,
      isSaving,
      handleSaveAll,
      openAdd,
      isImporting,
      handleImportPick,
      saveError,
      resetSaveError,
      importError,
      closeImportError,
      safePending.added.length,
      safePending.updated.length,
      safePending.deleted.length,
      search,
      isLoading,
    ]
  );

  // ──────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      {/* ── Danh sách: lưới 2 cột, mỗi nguyên liệu 1 thẻ có viền riêng ── */}
      <FlatList
        data={isLoading ? EMPTY_LIST : filtered}
        keyExtractor={(ing, idx) => ing._id || String(idx)}
        numColumns={2}
        columnWrapperStyle={COLUMN_WRAPPER_STYLE}
        contentContainerStyle={LIST_CONTENT_CONTAINER_STYLE}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={isLoading ? null : EMPTY_STATE}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
      />

      {/* ── Modal Thêm / Sửa ─────────────────────────────────────────── */}
      {!!modal && (
        <ModalOverlay onClose={closeModal}>
          <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "85%" }}>
            <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100">
              <Text className="text-base font-black text-green-900">
                {modal === "add" ? "Thêm nguyên liệu mới" : "Chỉnh sửa nguyên liệu"}
              </Text>
              <Pressable onPress={closeModal} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
                <X size={16} color={colors.gray[400]} />
              </Pressable>
            </View>

            {/* [SỬA LỖI - lần 2] Chỉ tách backdrop (lần sửa trước) là chưa đủ.
                Nguyên nhân thật: ScrollView không có kích thước RÕ RÀNG của
                riêng nó — nó chỉ nằm trong 1 View cha có `maxHeight: "85%"`
                + `overflow: hidden`. Không có `style={{flex:1}}`, ScrollView
                có thể tự đo chiều cao theo ĐÚNG nội dung bên trong nó (không
                bị giới hạn), trong khi phần HIỂN THỊ thật sự đã bị View cha
                cắt bớt qua overflow-hidden — 2 vùng "chiều cao mà ScrollView
                tự nghĩ nó có" và "chiều cao thật sự hiển thị" bị lệch nhau,
                khiến việc bắt đầu kéo ở nhiều vùng (nhãn field, khoảng trống
                giữa 2 cột) không kích hoạt đúng cơ chế cuộn nội bộ. Kéo từ
                TextInput vẫn hoạt động vì nó đi qua cơ chế "tự cuộn tới ô
                đang focus" riêng của RN, không qua path bị lệch này — che
                giấu mất vấn đề. `style={{flex:1}}` buộc ScrollView tự biết
                đúng kích thước khả dụng (phần còn lại sau khi trừ header +
                footer, trong giới hạn maxHeight 85% của View cha), khớp
                đúng với vùng hiển thị thật — đây là fix được xác nhận trong
                chính issue #48822 của facebook/react-native cho lỗi
                "ScrollView trong Modal không cuộn được". Thêm
                `nestedScrollEnabled` để tăng độ ổn định nhận diện cử chỉ
                cuộn trên Android trong layout lồng nhau kiểu này. */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <View className="flex-row flex-wrap justify-between">
                <FieldInput
                  label="Tên nguyên liệu"
                  required
                  full
                  field="ingredientName"
                  value={form.ingredientName}
                  onChange={setField}
                />
                <FieldInput
                  label="Số thứ tự"
                  keyboardType="number-pad"
                  field="displayOrder"
                  value={String(form.displayOrder)}
                  onChange={setField}
                />
                <FieldInput
                  label="Số lượng"
                  keyboardType="decimal-pad"
                  field="quantity"
                  value={String(form.quantity)}
                  onChange={setField}
                />
                <FieldInput
                  label="Đơn vị nhỏ"
                  field="smallUnit"
                  value={form.smallUnit}
                  onChange={setField}
                />
                <FieldInput
                  label="Đơn vị lớn"
                  field="largeUnit"
                  value={form.largeUnit}
                  onChange={setField}
                />
                <FieldInput
                  label="Giá / ĐVL (₫)"
                  keyboardType="decimal-pad"
                  field="pricePerLargeUnit"
                  value={String(form.pricePerLargeUnit)}
                  onChange={setField}
                />
                <FieldInput
                  label="Hạn sử dụng (ngày)"
                  keyboardType="number-pad"
                  field="expiryDays"
                  value={String(form.expiryDays)}
                  onChange={setField}
                />
                <FieldInput
                  label="Ghi chú"
                  full
                  field="note"
                  value={form.note}
                  onChange={setField}
                />
              </View>

              <View className="flex-row items-center justify-between mb-4 px-0.5">
                <Text className="text-sm font-medium text-gray-600">Cần bổ sung liên tục</Text>
                <Switch
                  value={!!form.needContinuousRestock}
                  onValueChange={(v) => setField("needContinuousRestock", v)}
                  trackColor={{ false: colors.gray[200], true: colors.green[400] }}
                  thumbColor={colors.white}
                />
              </View>
            </ScrollView>

            <View className="flex-row justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <Pressable onPress={closeModal} className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <Text className="text-sm font-bold text-gray-600">Hủy</Text>
              </Pressable>
              <Pressable onPress={handleSave} className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-600">
                <Check size={14} color={colors.white} />
                <Text className="text-sm font-bold text-white">
                  {modal === "add" ? "Thêm vào danh sách" : "Cập nhật"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ── Modal Xác nhận xóa ──────────────────────────────────────── */}
      {!!deleteId && (
        <ModalOverlay onClose={closeDeleteModal}>
          <View className="bg-white rounded-3xl overflow-hidden">
            <View className="px-6 pt-6 pb-4 border-b border-gray-100">
              <Text className="text-base font-black text-green-900">Xác nhận xóa</Text>
            </View>
            <View className="px-6 py-5">
              <Text className="text-sm text-gray-600" style={{ lineHeight: 20 }}>
                Nguyên liệu sẽ bị đánh dấu xóa và sẽ được xóa khỏi database khi bạn bấm{" "}
                <Text style={{ fontWeight: "800" }}>Lưu tất cả thay đổi</Text>.
              </Text>
            </View>
            <View className="flex-row justify-end gap-2 px-5 pb-5">
              <Pressable onPress={closeDeleteModal} className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <Text className="text-sm font-bold text-gray-600">Hủy</Text>
              </Pressable>
              <Pressable onPress={handleDelete} className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600">
                <Trash2 size={14} color={colors.white} />
                <Text className="text-sm font-bold text-white">Xác nhận xóa</Text>
              </Pressable>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ── Modal Huỷ thay đổi ──────────────────────────────────────── */}
      {discardOpen && (
        <ModalOverlay onClose={closeDiscard}>
          <View className="bg-white rounded-3xl overflow-hidden">
            <View className="px-6 pt-6 pb-4 border-b border-gray-100">
              <Text className="text-base font-black text-green-900">Huỷ tất cả thay đổi?</Text>
            </View>
            <View className="px-6 py-5">
              <Text className="text-sm text-gray-600" style={{ lineHeight: 20 }}>
                Tất cả {pendingCount} thay đổi chưa lưu sẽ bị huỷ và dữ liệu sẽ được tải lại từ server.
              </Text>
            </View>
            <View className="flex-row justify-end gap-2 px-5 pb-5">
              <Pressable onPress={closeDiscard} className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <Text className="text-sm font-bold text-gray-600">Không</Text>
              </Pressable>
              <Pressable
                onPress={confirmDiscard}
                className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600"
              >
                <RefreshCw size={14} color={colors.white} />
                <Text className="text-sm font-bold text-white">Huỷ thay đổi & tải lại</Text>
              </Pressable>
            </View>
          </View>
        </ModalOverlay>
      )}
    </View>
  );
}