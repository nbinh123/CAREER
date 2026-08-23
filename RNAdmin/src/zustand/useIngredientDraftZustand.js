// src/zustand/useIngredientDraftZustand.js
// [TỐI ƯU - react-query] Store MỚI, tách riêng — KHÔNG đụng tới
// useIngredientZustand.js gốc, vì file đó rất có thể đang được màn hình
// khác dùng (vd IngredientPicker trong form món ăn/trái cây, theo đúng
// comment trong store gốc). Store này chỉ giữ phần "bản nháp"
// thêm/sửa/xóa chưa lưu — phần dữ liệu server (ingredients) giờ do
// react-query quản lý (xem useIngredientsQuery.js), không lưu bản sao ở
// đây nữa.
//
// Logic add/edit/delete local bên dưới GIỮ NGUYÊN 100% so với bản gốc,
// chỉ bỏ phần mutate mảng "ingredients" (vì không còn tồn tại ở store
// này — IngredientsPage tự tính lại danh sách hiển thị bằng cách trộn dữ
// liệu server + pendingChanges qua useMemo).
import { create } from "zustand";

const TEMP_PREFIX = "__temp__";
const makeTempId = () => `${TEMP_PREFIX}${Date.now()}_${Math.random()}`;

const EMPTY_PENDING = { added: [], updated: [], deleted: [] };

const useIngredientDraftZustand = create((set) => ({
  pendingChanges: { ...EMPTY_PENDING },

  addLocal: (ingredientData) => {
    const tempIngredient = { ...ingredientData, _id: makeTempId(), _isNew: true };
    set((state) => ({
      pendingChanges: {
        ...state.pendingChanges,
        added: [...state.pendingChanges.added, tempIngredient],
      },
    }));
  },

  editLocal: (updatedIngredient) => {
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
        pendingChanges: { ...pendingChanges, added: newAdded, updated: newUpdated },
      };
    });
  },

  deleteLocal: (id) => {
    set((state) => {
      const { pendingChanges } = state;
      const isInAdded = pendingChanges.added.some((i) => i._id === id);

      return {
        pendingChanges: {
          added: pendingChanges.added.filter((i) => i._id !== id),
          updated: pendingChanges.updated.filter((i) => i._id !== id),
          deleted: isInAdded ? pendingChanges.deleted : [...pendingChanges.deleted, id],
        },
      };
    });
  },

  clearPending: () => set({ pendingChanges: { ...EMPTY_PENDING } }),
}));

export default useIngredientDraftZustand;