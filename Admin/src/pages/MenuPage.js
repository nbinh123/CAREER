// pages/MenuPage.js
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Button from "../components/Button";
import FormInput from "../components/FormInput";
import Modal from "../components/Modal";
import ImageUploadField from "../components/ImageUploadField";
import IngredientPicker from "../components/IngredientPicker";

import {
  Edit2, Plus, Search, Check, Info, Save, RotateCcw,
  Trash2, X, FolderOpen, RefreshCcw, StickyNote, Upload, Loader2
} from "lucide-react";
import fmtVND from "../utils/fmtVND";
import extractCatName from "../utils/extractCatName";
import useFoodZustand from "../zustand/useFoodZustand";


import exportJSON from "../utils/exportJSON"
import { API_URL } from "../config/api";
import importJSON from "../utils/importJSON";
// ─── Constants ────────────────────────────────────────────────────────────────

/** Danh mục cố định — không cần API */
const CAT_OPTIONS = ["Đồ chiên", "Lẩu", "Chính", "Tráng miệng", "Nước", "Món thêm"];
const CAT_FILTER = ["Tất cả", ...CAT_OPTIONS];

/** Danh mục dùng riêng cho combo trái cây mix — quản lý & hiển thị ở FruitPage, không hiện ở đây */
const MIX_CATEGORY = "Trái cây mix";

const EMPTY_FOOD = {
  foodName: "",
  categoryId: CAT_OPTIONS[0],  // lưu tên, không phải ObjectId
  costPrice: 0,
  originalPrice: 0,
  aiTrainingWeight: 0,
  isAvailable: true,
  note: "",
  ingredients: [],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ isAvailable }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-semibold ${isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}>
      {isAvailable ? "Đang bán" : "Nghỉ"}
    </span>
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

function FoodImage({ src, name, className = "" }) {
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

function FoodCard({ food, onEdit, onInfo, onRemove, onEditNote, isPending }) {
  const margin = food.originalPrice > 0
    ? Math.round((food.originalPrice - food.costPrice) / food.originalPrice * 100)
    : 0;
  const catName = extractCatName(food.categoryId);

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5
      ${food.isAvailable ? "border-gray-100" : "border-gray-200 opacity-60"}
      ${isPending ? "ring-2 ring-amber-300" : ""}`}>

      <div className="relative h-36">
        <FoodImage src={food.imageUrl} name={food.foodName} className="h-36 w-full" />
        {!food.isAvailable && (
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
          <h4 className="font-bold text-gray-800 text-sm leading-tight">{food.foodName}</h4>
          <StatusBadge isAvailable={food.isAvailable} />
        </div>
        <p className="text-xs text-gray-400 mb-3 font-medium">{catName || "—"}</p>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Giá bán</span>
            <span className="font-bold text-green-600">{fmtVND(food.originalPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Giá vốn</span>
            <span className="text-gray-600">{fmtVND(food.costPrice)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Biên LN</span>
            <MarginBar margin={margin} />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2">
          <Button sm variant="secondary" className="flex-1 justify-center" onClick={() => onEdit(food)}>
            <Edit2 size={12} />Sửa
          </Button>
          <Button sm variant="secondary" className="flex-1 justify-center" onClick={() => onInfo(food)}>
            <Info size={12} />Chi tiết
          </Button>
          <button onClick={() => onEditNote(food)}
            className={`p-1.5 rounded-xl transition-colors ${food.note
              ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
              : "text-gray-300 hover:bg-gray-50 hover:text-amber-500"
              }`}
            title={food.note ? "Xem/sửa ghi chú" : "Thêm ghi chú"}>
            <StickyNote size={14} />
          </button>
          <button onClick={() => onRemove(food._id)}
            className="p-1.5 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Xóa món">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Info Modal ───────────────────────────────────────────────────────────────

function InfoModal({ food, open, onClose }) {
  if (!food) return null;
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
    ["Giá bán gốc", fmtVND(food.originalPrice)],
    ["Giá vốn", fmtVND(food.costPrice)],
    ["Giảm %", `${pct}%`],
    ["Giảm cố định", fmtVND(fixed)],
    ["Giá sau ưu đãi", fmtVND(disc)],
    ["Lợi nhuận gộp", fmtVND(profit)],
    ["Biên lợi nhuận", `${margin}%`],
    ["Trọng số AI", food.aiTrainingWeight ?? 0],
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Chi tiết — ${food.foodName}`}>
      <div className="mb-4">
        <FoodImage src={food.imageUrl} name={food.foodName} className="w-full h-44 rounded-xl" />
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
      {food.ingredients?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Nguyên liệu</p>
          <div className="space-y-1.5">
            {food.ingredients.map((ing, i) => (
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

export default function MenuPage() {
  const {
    foods, loading, error,
    getFoods,
    stageAddFood, stageUpdateFood, stageRemoveFood,
    saveAllChanges, discardChanges,
    pendingChanges, clearError, refreshCosts
  } = useFoodZustand();

  const [catFilter, setCatFilter] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
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
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const openNoteEdit = fd => {
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

  useEffect(() => { getFoods(); }, [getFoods]);

  const pendingCount = pendingChanges.size;

  // Món hiển thị ở thực đơn — loại trừ các combo "Trái cây mix" (quản lý riêng ở trang Trái cây)
  const visibleFoods = useMemo(
    () => foods.filter(fd => extractCatName(fd.categoryId) !== MIX_CATEGORY),
    [foods]
  );

  // Giá vốn tự tính từ nguyên liệu
  const computedCostPrice = useMemo(
    () => form.ingredients.reduce((s, r) => s + (r.cost || 0), 0),
    [form.ingredients]
  );
  const hasIngredients = form.ingredients.length > 0;

  // Filter
  const filtered = useMemo(() =>
    visibleFoods.filter(fd => {
      const catName = extractCatName(fd.categoryId);
      const matchCat = catFilter === "Tất cả" || catName === catFilter;
      const matchQ = fd.foodName.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchQ;
    }),
    [visibleFoods, catFilter, search]
  );

  // Form helpers
  const ff = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);

  const handleRemoveImage = () => {
    setImageFile(null);
    setImageRemoved(true);
    setImageFieldKey(k => k + 1); // ép ImageUploadField remount → xoá preview nội bộ
  };

  const handleIngredientsChange = useCallback(
    newIngredients => setForm(p => ({ ...p, ingredients: newIngredients })),
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
    exportJSON(`${API_URL}/api/foods`, "foods")
  }
  const triggerImport = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);

    try {
      await importJSON(`${API_URL}/api/foods`, file, "foods");
      await getFoods(); // tải lại danh sách mới nhất
    } catch (err) {
      setImportError(
        err.response?.data?.message || err.message || "Import thất bại"
      );
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const openEdit = fd => {
    setForm({
      ...fd,
      categoryId: extractCatName(fd.categoryId),
      ingredients: (fd.ingredients || []).map(i => ({
        ...i,
        pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0),
      })),
    });
    setImageFile(null);
    setImageRemoved(false);
    setEditId(fd._id);
    setModal("edit");
  };

  const openInfo = fd => { setInfoFood(fd); setModal("info"); };
  const closeModal = () => {
    setModal(null); setEditId(null);
    setImageFile(null); setImageRemoved(false);
    setNoteFood(null); setNoteDraft("");
  };

  // Staged actions
  const handleSave = () => {
    if (!form.foodName.trim()) return;
    const payload = { ...form, costPrice: hasIngredients ? computedCostPrice : form.costPrice };
    if (modal === "add") stageAddFood(payload, imageFile);
    else stageUpdateFood({ ...payload, _id: editId }, imageFile);
    closeModal();
  };

  const handleRemove = useCallback(id => { stageRemoveFood(id); }, [stageRemoveFood]);

  const handleRefreshCosts = async () => {
    try {
      const data = await refreshCosts();
      setRefreshMsg(`Đã cập nhật giá cho ${data.updatedCount} món`);
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

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-green-900">Thực đơn</h1>
          <p className="text-gray-500 text-sm">
            {visibleFoods.length} món • {visibleFoods.filter(f => f.isAvailable).length} đang bán
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <>
              <button onClick={() => discardChanges()} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
                <RotateCcw size={14} />Huỷ thay đổi
              </button>
              <button onClick={handleSaveAll} disabled={loading || saveStatus === "saving"}
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
          <Button onClick={openAdd} disabled={loading}><Plus size={15} />Thêm món mới</Button>
          {/* ← thêm nút này */}
          {refreshMsg && (
            <span className="flex items-center gap-1 text-sm text-blue-600 font-semibold">
              <Check size={14} />{refreshMsg}
            </span>
          )}
          <Button
            variant="secondary"
            onClick={handleRefreshCosts}
            disabled={loading || pendingCount > 0}
            title={pendingCount > 0
              ? "Hãy lưu hoặc huỷ thay đổi đang chờ trước khi cập nhật giá"
              : "Cập nhật giá vốn theo giá nguyên liệu mới nhất"}
          >
            <RefreshCcw size={15} className={loading ? "animate-spin" : ""} />
            Làm mới
          </Button>
          <Button variant="secondary" onClick={exportData} disabled={loading}>
            <FolderOpen size={15} />
            Xuất JSON
          </Button>

          <Button variant="secondary" onClick={triggerImport} disabled={loading || isImporting}>
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
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{error}</span>
          <button onClick={clearError}><X size={14} /></button>
        </div>
      )}
      {importError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm món ăn..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CAT_FILTER.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${catFilter === c
                ? "bg-green-500 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"
                }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Skeleton */}
      {loading && visibleFoods.length === 0 && (
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
      {(!loading || visibleFoods.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(food => (
            <FoodCard key={food._id} food={food} onEdit={openEdit} onInfo={openInfo}
              onRemove={handleRemove} onEditNote={openNoteEdit}
              isPending={pendingChanges.has(`add:${food._id}`) || pendingChanges.has(`update:${food._id}`)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400">
              <p className="text-lg font-medium">Không tìm thấy món ăn</p>
              <p className="text-sm mt-1">Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Modal thêm / sửa ──────────────────────────────────────────────── */}
      <Modal open={modal === "add" || modal === "edit"} onClose={closeModal}
        title={modal === "add" ? "Thêm món mới" : "Chỉnh sửa món ăn"}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

          {/* Ảnh */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Ảnh món ăn</label>
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

          {/* Tên + Danh mục */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FormInput label="Tên món *" value={form.foodName} onChange={e => ff("foodName", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Danh mục</label>
              <select
                value={form.categoryId ?? CAT_OPTIONS[0]}
                onChange={e => ff("categoryId", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300">
                {CAT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Nguyên liệu */}
          <IngredientPicker
            selectedIngredients={form.ingredients}
            onChange={handleIngredientsChange}
          />

          {/* Giá */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Giá vốn (₫)</label>
              {hasIngredients ? (
                <div className="w-full border border-green-200 bg-green-50 rounded-xl px-3 py-2.5 text-sm font-semibold text-green-700">
                  {fmtVND(computedCostPrice)}
                  <span className="text-xs font-normal text-green-500 ml-1">(tự tính)</span>
                </div>
              ) : (
                <FormInput type="number" value={form.costPrice} onChange={e => ff("costPrice", +e.target.value)} />
              )}
            </div>

            <FormInput label="Giá bán (₫)" type="number" value={form.originalPrice}
              onChange={e => ff("originalPrice", +e.target.value)} />

            <FormInput label="Trọng số AI [0–1]" type="number" step="0.01" min="0" max="1"
              value={form.aiTrainingWeight} onChange={e => ff("aiTrainingWeight", +e.target.value)} />

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Biên LN dự kiến</label>
              <div className="flex items-center gap-2 pt-2">
                {(() => {
                  const cost = hasIngredients ? computedCostPrice : form.costPrice;
                  const m = form.originalPrice > 0
                    ? Math.round((form.originalPrice - cost) / form.originalPrice * 100) : 0;
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
              value={form.note}
              onChange={e => ff("note", e.target.value)}
              placeholder="Ghi chú thêm cho món (không bắt buộc)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </div>
          {/* Trạng thái */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="avail" checked={form.isAvailable}
              onChange={e => ff("isAvailable", e.target.checked)} className="accent-green-500 w-4 h-4" />
            <label htmlFor="avail" className="text-sm font-medium text-gray-600">Đang bán</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={closeModal}>Hủy</Button>
          <Button onClick={handleSave} disabled={!form.foodName.trim()}>
            <Check size={14} />Xác nhận
          </Button>
        </div>
      </Modal>

      {/* ─── Modal chi tiết ─────────────────────────────────────────────────── */}
      <InfoModal food={infoFood} open={modal === "info"} onClose={closeModal} />

      {/* ─── Modal sửa ghi chú ─────────────────────────────────────────────── */}
      <Modal open={modal === "note"} onClose={closeModal} title={`Ghi chú — ${noteFood?.foodName ?? ""}`}>
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">Ghi chú</label>
          <textarea
            autoFocus
            rows={4}
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            placeholder="Nhập ghi chú cho món này..."
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
    </div>
  );
}