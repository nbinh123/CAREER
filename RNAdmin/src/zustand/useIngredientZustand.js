// src/zustand/useIngredientZustand.js
// [GIU-NGUYEN] Copy nguyên vẹn 100% từ bản web — không có API DOM-only.
import { create } from "zustand";
import IngredientService from "../service/IngredientService";

const TEMP_PREFIX = "__temp__";
const makeTempId = () => `${TEMP_PREFIX}${Date.now()}_${Math.random()}`;

const EMPTY_PENDING = { added: [], updated: [], deleted: [] };

const useIngredientZustand = create((set, get) => ({
  // ─── State ─────────────────────────────────────────────
  ingredients: [],

  // added   : ingredient mới (chưa có trong DB, id là tempId)
  // updated : ingredient đã có trong DB và bị sửa (id là _id của DB)
  // deleted : _id của ingredient cần xóa trên DB
  pendingChanges: { ...EMPTY_PENDING },

  isLoading: false,
  isSaving: false,
  saveError: null,

  // ─── Getters ───────────────────────────────────────────
  // [FIX] Đổi từ `get propName()` (accessor) sang hàm thường: zustand
  // dùng Object.assign({}, state, partial) mỗi lần set(), thao tác này đọc
  // giá trị của getter rồi gắn lại như 1 field tĩnh — kết quả bị "đông
  // cứng" ngay tại thời điểm set() đầu tiên và không cập nhật nữa. Dùng
  // hàm (gọi lại get() mỗi lần invoke) để luôn phản ánh state mới nhất,
  // đồng nhất với useFoodZustand/useFruitZustand.
  hasPendingChanges: () => {
    const { pendingChanges } = get();
    return (
      pendingChanges.added.length > 0 ||
      pendingChanges.updated.length > 0 ||
      pendingChanges.deleted.length > 0
    );
  },

  pendingCount: () => {
    const { pendingChanges } = get();
    return (
      pendingChanges.added.length + pendingChanges.updated.length + pendingChanges.deleted.length
    );
  },

  // ─── Fetch từ server ───────────────────────────────────
  getIngredients: async () => {
    set({ isLoading: true });
    try {
      const data = await IngredientService.getAllIngredients();
      set({ ingredients: data, isLoading: false });
    } catch (err) {
      console.error("getIngredients error:", err);
      set({ isLoading: false });
    }
  },

  // ─── Thay đổi cục bộ (chưa gọi API) ──────────────────
  addIngredientLocal: (ingredientData) => {
    const tempIngredient = { ...ingredientData, _id: makeTempId(), _isNew: true };
    set((state) => ({
      ingredients: [...state.ingredients, tempIngredient],
      pendingChanges: {
        ...state.pendingChanges,
        added: [...state.pendingChanges.added, tempIngredient],
      },
    }));
  },

  editIngredientLocal: (updatedIngredient) => {
    set((state) => {
      const { pendingChanges } = state;

      const isInAdded = pendingChanges.added.some((i) => i._id === updatedIngredient._id);

      const newAdded = isInAdded
        ? pendingChanges.added.map((i) => (i._id === updatedIngredient._id ? updatedIngredient : i))
        : pendingChanges.added;

      const alreadyInUpdated = pendingChanges.updated.some((i) => i._id === updatedIngredient._id);

      const newUpdated = isInAdded
        ? pendingChanges.updated
        : alreadyInUpdated
        ? pendingChanges.updated.map((i) => (i._id === updatedIngredient._id ? updatedIngredient : i))
        : [...pendingChanges.updated, updatedIngredient];

      return {
        ingredients: state.ingredients.map((i) =>
          i._id === updatedIngredient._id ? updatedIngredient : i
        ),
        pendingChanges: {
          ...pendingChanges,
          added: newAdded,
          updated: newUpdated,
        },
      };
    });
  },

  deleteIngredientLocal: (id) => {
    set((state) => {
      const { pendingChanges } = state;
      const isInAdded = pendingChanges.added.some((i) => i._id === id);

      return {
        ingredients: state.ingredients.filter((i) => i._id !== id),
        pendingChanges: {
          added: pendingChanges.added.filter((i) => i._id !== id),
          updated: pendingChanges.updated.filter((i) => i._id !== id),
          deleted: isInAdded ? pendingChanges.deleted : [...pendingChanges.deleted, id],
        },
      };
    });
  },

  // ─── Lưu tất cả thay đổi lên server ──────────────────
  saveAllChanges: async () => {
    const { pendingChanges } = get();
    const hasChanges =
      pendingChanges.added.length > 0 ||
      pendingChanges.updated.length > 0 ||
      pendingChanges.deleted.length > 0;

    if (!hasChanges) return;

    set({ isSaving: true, saveError: null });

    const tasks = [
      ...pendingChanges.added.map(({ _id, _isNew, ...rest }) =>
        IngredientService.createIngredient(rest)
      ),
      ...pendingChanges.updated.map((ing) => IngredientService.updateIngredient(ing)),
      ...pendingChanges.deleted.map((id) => IngredientService.deleteIngredient(id)),
    ];

    const results = await Promise.allSettled(tasks);
    const failed = results.filter((r) => r.status === "rejected");

    try {
      const freshData = await IngredientService.getAllIngredients();
      set({
        ingredients: freshData,
        pendingChanges: { ...EMPTY_PENDING },
        isSaving: false,
      });
    } catch (err) {
      console.error("saveAllChanges refetch error:", err);
      set({
        isSaving: false,
        saveError: "Lưu xong nhưng không tải lại được dữ liệu, vui lòng làm mới trang.",
      });
      throw err;
    }

    if (failed.length > 0) {
      set({
        saveError: `${failed.length}/${tasks.length} thay đổi lưu thất bại, vui lòng kiểm tra và thử lại.`,
      });
      throw new Error("Một số thay đổi không thể lưu");
    }
  },

  clearSaveError: () => set({ saveError: null }),

  discardChanges: async () => {
    const data = await IngredientService.getAllIngredients();
    set({ ingredients: data, pendingChanges: { ...EMPTY_PENDING } });
  },
}));

export default useIngredientZustand;
