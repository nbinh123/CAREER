// pages/FruitPage.js
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Button from "../components/Button";
import FormInput from "../components/FormInput";
import Modal from "../components/Modal";
import ImageUploadField from "../components/ImageUploadField";
import IngredientPicker from "../components/IngredientPicker";

import {
  Edit2, Plus, Search, Check, Info, Save, RotateCcw,
  Trash2, X, StickyNote, Upload, Loader2, FolderOpen
} from "lucide-react";
import fmtVND from "../utils/fmtVND";
import extractCatName from "../utils/extractCatName";
import useFruitZustand from "../zustand/useFruitZustand";
import useFoodZustand from "../zustand/useFoodZustand";

import exportJSON from "../utils/exportJSON";
import { API_URL } from "../config/api";
import importJSON from "../utils/importJSON";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Danh mục cố định dùng cho combo — lưu vào bảng Food, ẩn khỏi MenuPage */
const MIX_CATEGORY = "Trái cây mix";

/**
 * Trái cây đơn lẻ — không còn quan tâm giá vốn/giá bán/biên LN (combo bên dưới
 * mới là nơi định giá bán cho khách). Nguyên liệu vẫn được giữ lại để giá vốn
 * tự đồng bộ theo giá nguyên liệu mới nhất, phục vụ tính toán ở nơi khác.
 */
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

// ─── Sub-components dùng chung ─────────────────────────────────────────────────

function StatusBadge({ isAvailable }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-semibold ${isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}>
      {isAvailable ? "Đang bán" : "Nghỉ"}
    </span>
  );
}

function AvailabilityToggle({ isAvailable, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={isAvailable ? "Đang hiển thị — bấm để ẩn" : "Đang ẩn — bấm để hiển thị"}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 flex-shrink-0 ${isAvailable ? "bg-green-500" : "bg-gray-300"
        }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${isAvailable ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
      />
    </button>
  );
}

function MarginBar({ margin }) {
  const m = Math.max(0, Math.min(margin, 100));
  const bar = m > 50 ? "bg-green-400" : m > 30 ? "bg-amber-400" : "bg-red-400";
  const text = m > 50 ? "text-green-600" : m > 30 ? "text-amber-600" : "text-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div style={{ width: `${m}%` }} className={`h-full rounded-full ${bar}`} />
      </div>
      <span className={`font-bold ${text}`}>{margin}%</span>
    </div>
  );
}

function ItemImage({ src, name, className = "" }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 ${className}`}>
        <span className="text-4xl font-black text-green-200 select-none">{name?.[0] ?? "?"}</span>
      </div>
    );
  }
  return (
    <img src={src} alt={name} onError={() => setErrored(true)}
      className={`object-cover ${className}`} />
  );
}

// ─── Trái cây: Card + Info Modal ───────────────────────────────────────────────

function FruitCard({ fruit, onEdit, onInfo, onRemove, onEditNote, isPending, onToggleAvailable }) {
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5
      ${fruit.isAvailable ? "border-gray-100" : "border-gray-200 opacity-60"}
      ${isPending ? "ring-2 ring-amber-300" : ""}`}>

      <div className="relative h-36">
        <ItemImage src={fruit.imageUrl} name={fruit.fruitName} className="h-36 w-full" />

        {/* Pill nổi góc trái: nhãn trạng thái + công tắc */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full pl-2 pr-1 py-1 shadow-sm">
          <span className={`text-[10px] font-bold ${fruit.isAvailable ? "text-green-600" : "text-gray-400"}`}>
            {fruit.isAvailable ? "Hiện" : "Ẩn"}
          </span>
          <AvailabilityToggle
            isAvailable={fruit.isAvailable}
            onToggle={() => onToggleAvailable(fruit)}
          />
        </div>

        {!fruit.isAvailable && (
          <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
            <span className="text-xs font-bold text-white bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1">
              Tạm nghỉ
            </span>
          </div>
        )}
        {isPending && (
          <span className="absolute top-2 right-2 text-[10px] bg-amber-400 text-white font-bold rounded-full px-1.5 py-0.5">
            Chưa lưu
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-bold text-gray-800 text-sm leading-tight">{fruit.fruitName}</h4>
        </div>
        <p className="text-xs text-gray-400 mb-3 font-medium">
          {fruit.ingredients?.length || 0} nguyên liệu
        </p>

        <div className="pt-3 border-t border-gray-50 flex gap-2">
          <Button sm variant="secondary" className="flex-1 justify-center" onClick={() => onEdit(fruit)}>
            <Edit2 size={12} />Sửa
          </Button>
          <Button sm variant="secondary" className="flex-1 justify-center" onClick={() => onInfo(fruit)}>
            <Info size={12} />Chi tiết
          </Button>
          <button onClick={() => onEditNote(fruit)}
            className={`p-1.5 rounded-xl transition-colors ${fruit.note
              ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
              : "text-gray-300 hover:bg-gray-50 hover:text-amber-500"
              }`}
            title={fruit.note ? "Xem/sửa ghi chú" : "Thêm ghi chú"}>
            <StickyNote size={14} />
          </button>
          <button onClick={() => onRemove(fruit._id)}
            className="p-1.5 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Xóa loại trái cây">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FruitInfoModal({ fruit, open, onClose }) {
  if (!fruit) return null;

  const rows = [
    ["Tên loại trái cây", fruit.fruitName],
    ["Trạng thái", fruit.isAvailable ? "Đang bán" : "Tạm nghỉ"],
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Chi tiết — ${fruit.fruitName}`}>
      <div className="mb-4">
        <ItemImage src={fruit.imageUrl} name={fruit.fruitName} className="w-full h-44 rounded-xl" />
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-50">
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="py-2 pr-4 text-gray-500 font-medium whitespace-nowrap">{label}</td>
              <td className="py-2 text-gray-800 font-semibold text-right">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fruit.ingredients?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Nguyên liệu</p>
          <div className="space-y-1.5">
            {fruit.ingredients.map((ing, i) => (
              <div key={i} className="flex justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-700 font-medium">{ing.ingredientName}</span>
                <span className="text-gray-500">{ing.quantity} {ing.smallUnit || ing.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {fruit.note && (
        <div className="mt-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ghi chú</p>
          <p className="text-sm text-gray-600 bg-amber-50 rounded-lg px-3 py-2">{fruit.note}</p>
        </div>
      )}
      <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  );
}

// ─── Combo trái cây mix: Card + Info Modal (giống Food, lưu bảng Food) ────────

function ComboCard({ combo, onEdit, onInfo, onRemove, onEditNote, isPending }) {
  const margin = combo.originalPrice > 0
    ? Math.round((combo.originalPrice - combo.costPrice) / combo.originalPrice * 100)
    : 0;

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5
      ${combo.isAvailable ? "border-gray-100" : "border-gray-200 opacity-60"}
      ${isPending ? "ring-2 ring-amber-300" : ""}`}>

      <div className="relative h-36">
        <ItemImage src={combo.imageUrl} name={combo.foodName} className="h-36 w-full" />
        {!combo.isAvailable && (
          <div className="absolute inset-0 bg-gray-200/60 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-500 bg-white rounded-lg px-2 py-1">Tạm nghỉ</span>
          </div>
        )}
        {isPending && (
          <span className="absolute top-2 right-2 text-[10px] bg-amber-400 text-white font-bold rounded-full px-1.5 py-0.5">
            Chưa lưu
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-bold text-gray-800 text-sm leading-tight">{combo.foodName}</h4>
          <StatusBadge isAvailable={combo.isAvailable} />
        </div>
        <p className="text-xs text-gray-400 mb-3 font-medium">Trái cây mix</p>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Giá bán</span>
            <span className="font-bold text-green-600">{fmtVND(combo.originalPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Giá vốn</span>
            <span className="text-gray-600">{fmtVND(combo.costPrice)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Biên LN</span>
            <MarginBar margin={margin} />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2">
          <Button sm variant="secondary" className="flex-1 justify-center" onClick={() => onEdit(combo)}>
            <Edit2 size={12} />Sửa
          </Button>
          <Button sm variant="secondary" className="flex-1 justify-center" onClick={() => onInfo(combo)}>
            <Info size={12} />Chi tiết
          </Button>
          <button onClick={() => onEditNote(combo)}
            className={`p-1.5 rounded-xl transition-colors ${combo.note
              ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
              : "text-gray-300 hover:bg-gray-50 hover:text-amber-500"
              }`}
            title={combo.note ? "Xem/sửa ghi chú" : "Thêm ghi chú"}>
            <StickyNote size={14} />
          </button>
          <button onClick={() => onRemove(combo._id)}
            className="p-1.5 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Xóa combo">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ComboInfoModal({ combo, open, onClose }) {
  if (!combo) return null;
  const pct = combo.percentageDiscount ?? 0;
  const fixed = combo.fixedDiscount ?? 0;
  const disc = Math.max(combo.originalPrice * (1 - pct / 100) - fixed, 0);
  const profit = disc - combo.costPrice;
  const margin = disc > 0 ? Math.round((profit / disc) * 100) : 0;

  const rows = [
    ["Tên combo", combo.foodName],
    ["Danh mục", "Trái cây mix"],
    ["Trạng thái", combo.isAvailable ? "Đang bán" : "Tạm nghỉ"],
    ["Giá bán gốc", fmtVND(combo.originalPrice)],
    ["Giá vốn", fmtVND(combo.costPrice)],
    ["Giảm %", `${pct}%`],
    ["Giảm cố định", fmtVND(fixed)],
    ["Giá sau ưu đãi", fmtVND(disc)],
    ["Lợi nhuận gộp", fmtVND(profit)],
    ["Biên lợi nhuận", `${margin}%`],
    ["Trọng số AI", combo.aiTrainingWeight ?? 0],
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Chi tiết — ${combo.foodName}`}>
      <div className="mb-4">
        <ItemImage src={combo.imageUrl} name={combo.foodName} className="w-full h-44 rounded-xl" />
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-50">
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="py-2 pr-4 text-gray-500 font-medium whitespace-nowrap">{label}</td>
              <td className="py-2 text-gray-800 font-semibold text-right">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {combo.ingredients?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Nguyên liệu</p>
          <div className="space-y-1.5">
            {combo.ingredients.map((ing, i) => (
              <div key={i} className="flex justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-700 font-medium">{ing.ingredientName}</span>
                <span className="text-gray-500">{ing.quantity} {ing.smallUnit} — {fmtVND(ing.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end mt-5 pt-4 border-t border-gray-100">
        <Button variant="outline" onClick={onClose}>Đóng</Button>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FruitPage() {
  // ── Trái cây đơn lẻ ──
  const {
    fruits, loading: fruitLoading, error: fruitError,
    getFruits,
    stageAddFruit, stageUpdateFruit, stageRemoveFruit,
    saveAllChanges: saveAllFruitChanges, discardChanges: discardFruitChanges,
    pendingChanges: fruitPendingChanges, clearError: clearFruitError,
  } = useFruitZustand();

  // ── Combo trái cây mix (lưu vào bảng Food, danh mục "Trái cây mix") ──
  const {
    foods, loading: foodLoading, error: foodError,
    getFoods,
    stageAddFood, stageUpdateFood, stageRemoveFood,
    saveAllChanges: saveAllFoodChanges, discardChanges: discardFoodChanges,
    pendingChanges: foodPendingChanges, clearError: clearFoodError,
  } = useFoodZustand();

  useEffect(() => { getFruits(); getFoods(); }, [getFruits, getFoods]);

  const comboFoods = useMemo(
    () => foods.filter(fd => extractCatName(fd.categoryId) === MIX_CATEGORY),
    [foods]
  );

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
  const fileInputRef = useRef(null);
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

  // ── Trái cây: handlers ──
  const openNoteEdit = fr => {
    setNoteFruit(fr);
    setNoteDraft(fr.note || "");
    setModal("note");
  };

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

  const filtered = useMemo(() =>
    fruits.filter(fr => fr.fruitName.toLowerCase().includes(search.toLowerCase())),
    [fruits, search]
  );

  const ff = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);

  const handleFruitIngredientsChange = useCallback(
    newIngredients => setForm(p => ({ ...p, ingredients: newIngredients })),
    []
  );

  const handleRemoveImage = () => {
    setImageFile(null);
    setImageRemoved(true);
    setImageFieldKey(k => k + 1);
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FRUIT });
    setImageFile(null);
    setImageRemoved(false);
    setModal("add");
  };

  const exportData = () => {
    exportJSON(`${API_URL}/api/fruits`, "fruits");
  };
  const triggerImport = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);

    try {
      await importJSON(`${API_URL}/api/fruits`, file, "fruits");
      await getFruits();
    } catch (err) {
      setImportError(
        err.response?.data?.message || err.message || "Import thất bại"
      );
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const openEdit = fr => {
    setForm({
      ...fr,
      ingredients: (fr.ingredients || []).map(i => ({
        ...i,
        pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0),
      })),
    });
    setImageFile(null);
    setImageRemoved(false);
    setEditId(fr._id);
    setModal("edit");
  };

  const openInfo = fr => { setInfoFruit(fr); setModal("info"); };
  const closeModal = () => {
    setModal(null); setEditId(null);
    setImageFile(null); setImageRemoved(false);
    setNoteFruit(null); setNoteDraft("");
  };

  const handleSave = () => {
    if (!form.fruitName.trim()) return;
    const payload = { ...form, costPrice: computedFruitCost };
    if (modal === "add") stageAddFruit(payload, imageFile);
    else stageUpdateFruit({ ...payload, _id: editId }, imageFile);
    closeModal();
  };

  const handleRemove = useCallback(id => { stageRemoveFruit(id); }, [stageRemoveFruit]);

  const handleToggleAvailable = useCallback(
    fruit => stageUpdateFruit({ ...fruit, isAvailable: !fruit.isAvailable }, null),
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

  // ── Combo: handlers ──
  const openComboNoteEdit = cb => {
    setNoteCombo(cb);
    setComboNoteDraft(cb.note || "");
    setComboModal("note");
  };

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

  const filteredCombos = useMemo(() =>
    comboFoods.filter(cb => cb.foodName.toLowerCase().includes(comboSearch.toLowerCase())),
    [comboFoods, comboSearch]
  );

  const cff = useCallback((k, v) => setComboForm(p => ({ ...p, [k]: v })), []);

  const handleComboIngredientsChange = useCallback(
    newIngredients => setComboForm(p => ({ ...p, ingredients: newIngredients })),
    []
  );

  const handleComboRemoveImage = () => {
    setComboImageFile(null);
    setComboImageRemoved(true);
    setComboImageFieldKey(k => k + 1);
  };

  const openComboAdd = () => {
    setComboForm({ ...EMPTY_COMBO });
    setComboImageFile(null);
    setComboImageRemoved(false);
    setComboModal("add");
  };

  const openComboEdit = cb => {
    setComboForm({
      ...cb,
      categoryId: MIX_CATEGORY,
      ingredients: (cb.ingredients || []).map(i => ({
        ...i,
        pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0),
      })),
    });
    setComboImageFile(null);
    setComboImageRemoved(false);
    setComboEditId(cb._id);
    setComboModal("edit");
  };

  const openComboInfo = cb => { setInfoCombo(cb); setComboModal("info"); };
  const closeComboModal = () => {
    setComboModal(null); setComboEditId(null);
    setComboImageFile(null); setComboImageRemoved(false);
    setNoteCombo(null); setComboNoteDraft("");
  };

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

  const handleComboRemove = useCallback(id => { stageRemoveFood(id); }, [stageRemoveFood]);

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

  return (
    <div className="space-y-10">

      {/* ════════════════════════ TRÁI CÂY ════════════════════════ */}
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-green-900">Trái cây</h1>
            <p className="text-gray-500 text-sm">
              {fruits.length} loại • {fruits.filter(f => f.isAvailable).length} đang bán • nguyên liệu cho combo mix bên dưới
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pendingCount > 0 && (
              <>
                <button onClick={() => discardFruitChanges()} disabled={fruitLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  <RotateCcw size={14} />Huỷ thay đổi
                </button>
                <button onClick={handleSaveAll} disabled={fruitLoading || saveStatus === "saving"}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${saveStatus === "saving" ? "bg-amber-400 text-white"
                    : saveStatus === "error" ? "bg-red-500 text-white"
                      : "bg-amber-500 hover:bg-amber-600 text-white"
                    }`}>
                  <Save size={14} />
                  {saveStatus === "saving" ? "Đang lưu…"
                    : saveStatus === "error" ? "Lỗi, thử lại"
                      : `Lưu ${pendingCount} thay đổi`}
                </button>
              </>
            )}
            {saveStatus === "saved" && pendingCount === 0 && (
              <span className="flex items-center gap-1 text-sm text-green-600 font-semibold">
                <Check size={14} />Đã lưu thành công
              </span>
            )}
            <Button onClick={openAdd} disabled={fruitLoading}><Plus size={15} />Thêm loại trái cây</Button>
            <Button variant="secondary" onClick={exportData} disabled={fruitLoading}>
              <FolderOpen size={15} />
              Xuất JSON
            </Button>
            <Button variant="secondary" onClick={triggerImport} disabled={fruitLoading || isImporting}>
              {isImporting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {isImporting ? "Đang tải lên..." : "Tải lên JSON"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Error banner */}
        {fruitError && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <span>{fruitError}</span>
            <button onClick={clearFruitError}><X size={14} /></button>
          </div>
        )}
        {importError && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <span>{importError}</span>
            <button onClick={() => setImportError(null)}><X size={14} /></button>
          </div>
        )}

        {/* Search */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm loại trái cây..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
          </div>
        </div>

        {/* Skeleton */}
        {fruitLoading && fruits.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-36 bg-gray-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        {(!fruitLoading || fruits.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(fruit => (
              <FruitCard key={fruit._id} fruit={fruit} onEdit={openEdit} onInfo={openInfo}
                onRemove={handleRemove} onEditNote={openNoteEdit} onToggleAvailable={handleToggleAvailable}
                isPending={fruitPendingChanges.has(`add:${fruit._id}`) || fruitPendingChanges.has(`update:${fruit._id}`)} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-gray-400">
                <p className="text-lg font-medium">Không tìm thấy loại trái cây</p>
                <p className="text-sm mt-1">Thử thay đổi từ khoá tìm kiếm</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════ COMBO TRÁI CÂY MIX ════════════════════════ */}
      <div className="space-y-5 pt-6 border-t border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-green-900">Combo trái cây mix</h1>
            <p className="text-gray-500 text-sm">
              {comboFoods.length} combo • {comboFoods.filter(c => c.isAvailable).length} đang bán
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {comboPendingCount > 0 && (
              <>
                <button onClick={() => discardFoodChanges()} disabled={foodLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  <RotateCcw size={14} />Huỷ thay đổi
                </button>
                <button onClick={handleComboSaveAll} disabled={foodLoading || comboSaveStatus === "saving"}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${comboSaveStatus === "saving" ? "bg-amber-400 text-white"
                    : comboSaveStatus === "error" ? "bg-red-500 text-white"
                      : "bg-amber-500 hover:bg-amber-600 text-white"
                    }`}>
                  <Save size={14} />
                  {comboSaveStatus === "saving" ? "Đang lưu…"
                    : comboSaveStatus === "error" ? "Lỗi, thử lại"
                      : `Lưu ${comboPendingCount} thay đổi`}
                </button>
              </>
            )}
            {comboSaveStatus === "saved" && comboPendingCount === 0 && (
              <span className="flex items-center gap-1 text-sm text-green-600 font-semibold">
                <Check size={14} />Đã lưu thành công
              </span>
            )}
            <Button onClick={openComboAdd} disabled={foodLoading}><Plus size={15} />Thêm combo mix</Button>
          </div>
        </div>

        {/* Error banner */}
        {foodError && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <span>{foodError}</span>
            <button onClick={clearFoodError}><X size={14} /></button>
          </div>
        )}

        {/* Search */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={comboSearch} onChange={e => setComboSearch(e.target.value)} placeholder="Tìm combo mix..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
          </div>
        </div>

        {/* Skeleton */}
        {foodLoading && comboFoods.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-36 bg-gray-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        {(!foodLoading || comboFoods.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCombos.map(combo => (
              <ComboCard key={combo._id} combo={combo} onEdit={openComboEdit} onInfo={openComboInfo}
                onRemove={handleComboRemove} onEditNote={openComboNoteEdit}
                isPending={foodPendingChanges.has(`add:${combo._id}`) || foodPendingChanges.has(`update:${combo._id}`)} />
            ))}
            {filteredCombos.length === 0 && (
              <div className="col-span-full text-center py-16 text-gray-400">
                <p className="text-lg font-medium">Chưa có combo trái cây mix nào</p>
                <p className="text-sm mt-1">Bấm "Thêm combo mix" để tạo combo đầu tiên</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Modal thêm / sửa trái cây ─────────────────────────────────────── */}
      <Modal open={modal === "add" || modal === "edit"} onClose={closeModal}
        title={modal === "add" ? "Thêm loại trái cây" : "Chỉnh sửa loại trái cây"}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

          {/* Ảnh */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Ảnh</label>
            <ImageUploadField
              key={imageFieldKey}
              currentUrl={imageRemoved ? null : (form.imageUrl ?? null)}
              onSelect={(file) => { setImageFile(file); setImageRemoved(false); }}
            />
            {(imageFile || (!imageRemoved && form.imageUrl)) && (
              <button onClick={handleRemoveImage}
                className="mt-1 text-xs text-red-400 hover:text-red-600">
                Xoá ảnh
              </button>
            )}
          </div>

          {/* Tên */}
          <FormInput label="Tên loại trái cây *" value={form.fruitName} onChange={e => ff("fruitName", e.target.value)} />

          {/* Nguyên liệu — giữ lại để giá vốn tự đồng bộ theo giá nguyên liệu, không hiển thị giá bán/biên LN */}
          <IngredientPicker
            selectedIngredients={form.ingredients}
            onChange={handleFruitIngredientsChange}
          />

          {/* Ghi chú */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Ghi chú</label>
            <textarea
              rows={2}
              value={form.note}
              onChange={e => ff("note", e.target.value)}
              placeholder="Ghi chú thêm (không bắt buộc)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>

          {/* Trạng thái */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="fruit-avail" checked={form.isAvailable}
              onChange={e => ff("isAvailable", e.target.checked)} className="accent-green-500 w-4 h-4" />
            <label htmlFor="fruit-avail" className="text-sm font-medium text-gray-600">Đang bán</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={closeModal}>Hủy</Button>
          <Button onClick={handleSave} disabled={!form.fruitName.trim()}>
            <Check size={14} />Xác nhận
          </Button>
        </div>
      </Modal>

      {/* ─── Modal chi tiết trái cây ────────────────────────────────────────── */}
      <FruitInfoModal fruit={infoFruit} open={modal === "info"} onClose={closeModal} />

      {/* ─── Modal sửa ghi chú trái cây ─────────────────────────────────────── */}
      <Modal open={modal === "note"} onClose={closeModal} title={`Ghi chú — ${noteFruit?.fruitName ?? ""}`}>
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">Ghi chú</label>
          <textarea
            autoFocus
            rows={4}
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            placeholder="Nhập ghi chú cho loại trái cây này..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={closeModal}>Hủy</Button>
          <Button onClick={handleSaveNote}>
            <Check size={14} />Lưu ghi chú
          </Button>
        </div>
      </Modal>

      {/* ─── Modal thêm / sửa combo mix ─────────────────────────────────────── */}
      <Modal open={comboModal === "add" || comboModal === "edit"} onClose={closeComboModal}
        title={comboModal === "add" ? "Thêm combo trái cây mix" : "Chỉnh sửa combo trái cây mix"}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

          {/* Ảnh */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Ảnh combo</label>
            <ImageUploadField
              key={comboImageFieldKey}
              currentUrl={comboImageRemoved ? null : (comboForm.imageUrl ?? null)}
              onSelect={(file) => { setComboImageFile(file); setComboImageRemoved(false); }}
            />
            {(comboImageFile || (!comboImageRemoved && comboForm.imageUrl)) && (
              <button onClick={handleComboRemoveImage}
                className="mt-1 text-xs text-red-400 hover:text-red-600">
                Xoá ảnh
              </button>
            )}
          </div>

          {/* Tên + Danh mục (cố định) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FormInput label="Tên combo *" value={comboForm.foodName} onChange={e => cff("foodName", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Danh mục</label>
              <div className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-500 font-medium">
                Trái cây mix
              </div>
            </div>
          </div>

          {/* Nguyên liệu */}
          <IngredientPicker
            selectedIngredients={comboForm.ingredients}
            onChange={handleComboIngredientsChange}
          />

          {/* Giá */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Giá vốn (₫)</label>
              {comboHasIngredients ? (
                <div className="w-full border border-green-200 bg-green-50 rounded-xl px-3 py-2.5 text-sm font-semibold text-green-700">
                  {fmtVND(computedComboCost)}
                  <span className="text-xs font-normal text-green-500 ml-1">(tự tính)</span>
                </div>
              ) : (
                <FormInput type="number" value={comboForm.costPrice} onChange={e => cff("costPrice", +e.target.value)} />
              )}
            </div>

            <FormInput label="Giá bán (₫)" type="number" value={comboForm.originalPrice}
              onChange={e => cff("originalPrice", +e.target.value)} />

            <FormInput label="Trọng số AI [0–1]" type="number" step="0.01" min="0" max="1"
              value={comboForm.aiTrainingWeight} onChange={e => cff("aiTrainingWeight", +e.target.value)} />

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Biên LN dự kiến</label>
              <div className="flex items-center gap-2 pt-2">
                {(() => {
                  const cost = comboHasIngredients ? computedComboCost : comboForm.costPrice;
                  const m = comboForm.originalPrice > 0
                    ? Math.round((comboForm.originalPrice - cost) / comboForm.originalPrice * 100) : 0;
                  return <MarginBar margin={m} />;
                })()}
              </div>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Ghi chú</label>
            <textarea
              rows={2}
              value={comboForm.note}
              onChange={e => cff("note", e.target.value)}
              placeholder="Ghi chú thêm cho combo (không bắt buộc)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>

          {/* Trạng thái */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="combo-avail" checked={comboForm.isAvailable}
              onChange={e => cff("isAvailable", e.target.checked)} className="accent-green-500 w-4 h-4" />
            <label htmlFor="combo-avail" className="text-sm font-medium text-gray-600">Đang bán</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={closeComboModal}>Hủy</Button>
          <Button onClick={handleComboSave} disabled={!comboForm.foodName.trim()}>
            <Check size={14} />Xác nhận
          </Button>
        </div>
      </Modal>

      {/* ─── Modal chi tiết combo mix ───────────────────────────────────────── */}
      <ComboInfoModal combo={infoCombo} open={comboModal === "info"} onClose={closeComboModal} />

      {/* ─── Modal sửa ghi chú combo mix ────────────────────────────────────── */}
      <Modal open={comboModal === "note"} onClose={closeComboModal} title={`Ghi chú — ${noteCombo?.foodName ?? ""}`}>
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">Ghi chú</label>
          <textarea
            autoFocus
            rows={4}
            value={comboNoteDraft}
            onChange={e => setComboNoteDraft(e.target.value)}
            placeholder="Nhập ghi chú cho combo này..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={closeComboModal}>Hủy</Button>
          <Button onClick={handleComboSaveNote}>
            <Check size={14} />Lưu ghi chú
          </Button>
        </div>
      </Modal>
    </div>
  );
}