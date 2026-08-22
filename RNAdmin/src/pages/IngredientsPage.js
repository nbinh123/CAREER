import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
} from "react-native";
import {
  AlertTriangle,
  Check,
  Edit2,
  FolderOpen,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  Upload,
} from "lucide-react-native";
import fmtVND from "../utils/fmtVND";
import exportJSON from "../utils/exportJSON";
import importJSON, { pickJSONFile } from "../utils/importJSON";
import { API_URL } from "../config/api";
import useIngredientZustand from "../zustand/useIngredientZustand";
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

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ (thay Btn/Modal/FormInput dùng chung ở bản web)
════════════════════════════════════════════════════════════ */
const ACTION_VARIANTS = {
  primary: { box: "bg-green-600", text: "text-white" },
  secondary: { box: "bg-white border border-gray-200", text: "text-gray-700" },
  outline: { box: "bg-gray-50 border border-gray-200", text: "text-gray-500" },
  danger: { box: "bg-red-600", text: "text-white" },
};

function ActionBtn({ icon: Icon, label, onPress, variant = "secondary", disabled, loading, badge }) {
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
      {!!badge && (
        <View className="ml-0.5 w-4 h-4 rounded-full bg-amber-500 items-center justify-center">
          <Text className="text-white text-[9px] font-black">{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function IconBtn({ icon: Icon, onPress, danger }) {
  return (
    <Pressable
      onPress={onPress}
      className={`w-8 h-8 rounded-lg items-center justify-center ${danger ? "bg-red-50" : "bg-gray-50"}`}
    >
      <Icon size={14} color={danger ? colors.red[600] : colors.gray[500]} />
    </Pressable>
  );
}

function FieldInput({ label, required, value, onChangeText, keyboardType = "default", multiline, full }) {
  return (
    <View className={full ? "w-full" : "w-[47%]"} style={{ marginBottom: 12 }}>
      <Text className="text-xs font-semibold text-gray-500 mb-1.5">
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

/* Overlay dùng chung cho cả 3 modal — tương đương e.stopPropagation() */
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
        <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 440 }}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Trạng thái pending của 1 hàng ──────────────────────────────────────── */
const ROW_ACCENT = {
  added: { backgroundColor: colors.green[50], borderLeftWidth: 3, borderLeftColor: colors.green[400] },
  // amber-50/amber-400 không có sẵn trong tokens.js (chỉ có amber[500]) —
  // ghi hex trực tiếp, cùng tinh thần ORDER_STATUS_COLORS ở Customers.js.
  updated: { backgroundColor: "#fffbeb", borderLeftWidth: 3, borderLeftColor: "#fbbf24" },
  normal: {},
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

/* ── 1 nguyên liệu = 1 card (thay cho 1 hàng <tr> ở bản gốc) ────────────── */
function IngredientCard({ ing, status, isLast, onEdit, onDelete }) {
  const quantity = ing.quantity ?? 0;
  const expiry = expiryMeta(ing.expiryDays);

  return (
    <View
      style={[
        { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.gray[50] },
        ROW_ACCENT[status] ?? ROW_ACCENT.normal,
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
          <IconBtn icon={Edit2} onPress={() => onEdit(ing)} />
          <IconBtn icon={Trash2} danger onPress={() => onDelete(ing._id)} />
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
          {/* orange-600 không có trong tokens.js — hex trực tiếp khớp
              className text-orange-600 đang dùng cho phần chữ. */}
          <AlertTriangle size={12} color="#ea580c" />
          <Text className="text-xs font-semibold text-orange-600">Cần bổ sung liên tục</Text>
        </View>
      )}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function IngredientsPage() {
  // ─── Selectors Zustand [GIU-NGUYEN] ───────────────────────────────────
  const ingredients = useIngredientZustand((s) => s.ingredients);
  const pendingChanges = useIngredientZustand((s) => s.pendingChanges);
  const isLoading = useIngredientZustand((s) => s.isLoading);
  const isSaving = useIngredientZustand((s) => s.isSaving);
  const saveError = useIngredientZustand((s) => s.saveError);
  const getIngredients = useIngredientZustand((s) => s.getIngredients);
  const addIngredientLocal = useIngredientZustand((s) => s.addIngredientLocal);
  const editIngredientLocal = useIngredientZustand((s) => s.editIngredientLocal);
  const deleteIngredientLocal = useIngredientZustand((s) => s.deleteIngredientLocal);
  const saveAllChanges = useIngredientZustand((s) => s.saveAllChanges);
  const discardChanges = useIngredientZustand((s) => s.discardChanges);
  const clearSaveError = useIngredientZustand((s) => s.clearSaveError);

  // ─── Dữ liệu store, ép kiểu an toàn [GIU-NGUYEN] ──────────────────────
  const safeIngredients = Array.isArray(ingredients) ? ingredients : [];
  const safePending =
    pendingChanges &&
    Array.isArray(pendingChanges.added) &&
    Array.isArray(pendingChanges.updated) &&
    Array.isArray(pendingChanges.deleted)
      ? pendingChanges
      : EMPTY_PENDING;

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "add" | "edit"
  const [form, setForm] = useState(EMPTY_ING);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Fetch dữ liệu lần đầu
  useEffect(() => {
    getIngredients();
  }, [getIngredients]);

  // ─── Thống kê pending ───────────────────────────────────────────────
  const pendingCount = safePending.added.length + safePending.updated.length + safePending.deleted.length;
  const hasPending = pendingCount > 0;

  // ─── Search ─────────────────────────────────────────────────────────
  const filtered = safeIngredients.filter((i) =>
    (i.ingredientName || "").toLowerCase().includes(search.toLowerCase())
  );

  // ─── Helpers form ───────────────────────────────────────────────────
  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const exportData = () => {
    exportJSON(`${API_URL}/api/ingredients`, "ingredients").catch((err) => {
      console.error("exportData:", err);
    });
  };

  const handleImportPick = async () => {
    setImportError(null);
    setIsImporting(true);
    try {
      const data = await pickJSONFile();
      if (!data) return; // người dùng huỷ chọn file
      await importJSON(`${API_URL}/api/ingredients`, data, "ingredients");
      await getIngredients(); // tải lại danh sách mới nhất từ server
    } catch (err) {
      setImportError(err?.message || "Import thất bại");
    } finally {
      setIsImporting(false);
    }
  };

  const openAdd = () => {
    setForm(EMPTY_ING);
    setModal("add");
  };

  const openEdit = (ing) => {
    setForm({ ...EMPTY_ING, ...ing });
    setEditId(ing._id);
    setModal("edit");
  };

  const closeModal = () => {
    setModal(null);
    setEditId(null);
  };

  // ─── CRUD local (chưa gọi API) ────────────────────────────────────────
  const handleSave = () => {
    const name = (form.ingredientName || "").trim();
    if (!name) return;

    // Ép các field số (đang được giữ dạng chuỗi lúc gõ, xem ghi chú platform
    // ở đầu file) sang number đúng kiểu store mong đợi.
    const payload = { ...form, ingredientName: name };
    NUMERIC_FIELDS.forEach((key) => {
      payload[key] = Number(payload[key]) || 0;
    });

    if (modal === "add") {
      addIngredientLocal(payload);
    } else {
      editIngredientLocal({ ...payload, _id: editId });
    }
    closeModal();
  };

  const handleDelete = () => {
    deleteIngredientLocal(deleteId);
    setDeleteId(null);
  };

  // ─── Lưu tất cả lên server ──────────────────────────────────────────
  const handleSaveAll = async () => {
    try {
      await saveAllChanges();
    } catch {
      // Lỗi đã được lưu vào saveError trong zustand
    }
  };

  // ─── Trạng thái của từng hàng ───────────────────────────────────────
  const getRowStatus = (ing) => {
    if (safePending.added.some((i) => i._id === ing._id)) return "added";
    if (safePending.updated.some((i) => i._id === ing._id)) return "updated";
    return "normal";
  };

  // ──────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
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
            <ActionBtn icon={X} label="Huỷ thay đổi" variant="outline" onPress={() => setDiscardOpen(true)} />
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
          <ActionBtn icon={FolderOpen} label="Xuất JSON" onPress={exportData} />
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
            <Pressable onPress={clearSaveError}>
              <X size={16} color={colors.red[600]} />
            </Pressable>
          </View>
        )}
        {!!importError && (
          <View className="flex-row items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="flex-1 text-red-700 text-sm">{importError}</Text>
            <Pressable onPress={() => setImportError(null)}>
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

        {/* ── Danh sách (thay <table>) ─────────────────────────────── */}
        <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <View className="flex-row items-center justify-center py-16" style={{ gap: 8 }}>
              <ActivityIndicator size="small" color={colors.gray[400]} />
              <Text className="text-sm text-gray-400">Đang tải nguyên liệu...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View className="items-center py-14 px-6">
              <Text style={{ fontSize: 34 }}>🥬</Text>
              <Text className="text-sm text-gray-300 font-bold mt-2">Không tìm thấy nguyên liệu nào</Text>
            </View>
          ) : (
            filtered.map((ing, idx) => (
              <IngredientCard
                key={ing._id || idx}
                ing={ing}
                status={getRowStatus(ing)}
                isLast={idx === filtered.length - 1}
                onEdit={openEdit}
                onDelete={(id) => setDeleteId(id)}
              />
            ))
          )}
        </View>
      </ScrollView>

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

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
              <View className="flex-row flex-wrap justify-between">
                <FieldInput
                  label="Tên nguyên liệu"
                  required
                  full
                  value={form.ingredientName}
                  onChangeText={(t) => setField("ingredientName", t)}
                />
                <FieldInput
                  label="Số thứ tự"
                  keyboardType="number-pad"
                  value={String(form.displayOrder)}
                  onChangeText={(t) => setField("displayOrder", t)}
                />
                <FieldInput
                  label="Số lượng"
                  keyboardType="decimal-pad"
                  value={String(form.quantity)}
                  onChangeText={(t) => setField("quantity", t)}
                />
                <FieldInput
                  label="Đơn vị nhỏ"
                  value={form.smallUnit}
                  onChangeText={(t) => setField("smallUnit", t)}
                />
                <FieldInput
                  label="Đơn vị lớn"
                  value={form.largeUnit}
                  onChangeText={(t) => setField("largeUnit", t)}
                />
                <FieldInput
                  label="Giá / ĐVL (₫)"
                  keyboardType="decimal-pad"
                  value={String(form.pricePerLargeUnit)}
                  onChangeText={(t) => setField("pricePerLargeUnit", t)}
                />
                <FieldInput
                  label="Hạn sử dụng (ngày)"
                  keyboardType="number-pad"
                  value={String(form.expiryDays)}
                  onChangeText={(t) => setField("expiryDays", t)}
                />
                <FieldInput
                  label="Ghi chú"
                  full
                  value={form.note}
                  onChangeText={(t) => setField("note", t)}
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
        <ModalOverlay onClose={() => setDeleteId(null)}>
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
              <Pressable onPress={() => setDeleteId(null)} className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
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
        <ModalOverlay onClose={() => setDiscardOpen(false)}>
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
              <Pressable onPress={() => setDiscardOpen(false)} className="px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <Text className="text-sm font-bold text-gray-600">Không</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await discardChanges();
                  setDiscardOpen(false);
                }}
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
