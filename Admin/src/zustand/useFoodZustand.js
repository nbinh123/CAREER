// zustand/useFoodZustand.js
import { create } from "zustand";
import FoodService from "../service/FoodService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Thay thế 1 phần tử trong mảng theo _id (immutable) */
const replaceById = (arr, updated) =>
  arr.map(f => (f._id === updated._id ? updated : f));

/** Tạo key phân biệt bản ghi đang pending */
const pendingKey = (type, id) => `${type}:${id}`;

// ─── Store ────────────────────────────────────────────────────────────────────
const useFoodZustand = create((set, get) => ({
  foods: [],
  categories: [],   // { _id, name, percentageDiscount, fixedDiscount }[]
  loading: false,
  error: null,

  /**
   * Queue các thay đổi chưa được đồng bộ lên server.
   * Shape: Map<string, { type: 'add'|'update'|'delete', food?, imageFile? }>
   */
  pendingChanges: new Map(),


  // ─── Foods ─────────────────────────────────────────────────────────────────

  /** Fetch lần đầu — bỏ qua nếu đã có dữ liệu */
  getFoods: async () => {
    if (get().foods.length > 0) return;
    await get().refreshFoods();
  },

  /** Luôn fetch lại từ server và xoá pending queue */
  refreshFoods: async () => {
    set({ loading: true, error: null });
    try {
      const foods = await FoodService.getAllFoods();
      set({ foods, loading: false, pendingChanges: new Map() });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── Local-only mutations (staged, chưa gửi server) ────────────────────────

  /**
   * Stage thêm món mới vào local state.
   * Dùng id tạm (temp_<timestamp>) để phân biệt.
   */
  stageAddFood: (food, imageFile = null) => {
    const tempId = `temp_${Date.now()}`;
    const draft = { ...food, _id: tempId, __isNew: true };
    set(state => {
      const next = new Map(state.pendingChanges);
      next.set(pendingKey("add", tempId), { type: "add", food: draft, imageFile });
      return { foods: [draft, ...state.foods], pendingChanges: next };
    });
    return draft;
  },

  /**
   * Stage chỉnh sửa món — cập nhật local ngay lập tức.
   */
  stageUpdateFood: (food, imageFile = null) => {
    set(state => {
      const next = new Map(state.pendingChanges);
      const key = pendingKey("update", food._id);
      // Nếu đây là món mới chưa gửi server → giữ type = 'add'
      const existing = next.get(pendingKey("add", food._id));
      if (existing) {
        next.set(pendingKey("add", food._id), { ...existing, food, imageFile });
      } else {
        next.set(key, { type: "update", food, imageFile });
      }
      return { foods: replaceById(state.foods, food), pendingChanges: next };
    });
  },

  /**
   * Stage xóa món — xóa khỏi local ngay lập tức.
   */
  stageRemoveFood: (id) => {
    set(state => {
      const next = new Map(state.pendingChanges);
      // Nếu là món mới chưa lên server → bỏ khỏi queue, không cần DELETE
      if (next.has(pendingKey("add", id))) {
        next.delete(pendingKey("add", id));
      } else {
        // Dọn entry "update" cũ của cùng món (nếu có) — xóa luôn ưu tiên
        // hơn 1 chỉnh sửa đang chờ, tránh gửi thừa/lỗi PUT trước khi DELETE
        next.delete(pendingKey("update", id));
        next.set(pendingKey("delete", id), { type: "delete", id });
      }
      return {
        foods: state.foods.filter(f => f._id !== id),
        pendingChanges: next,
      };
    });
  },

  /** Số thay đổi chưa lưu */
  pendingCount: () => get().pendingChanges.size,

  // ─── Save all (flush to server) ────────────────────────────────────────────

  /**
   * Gửi toàn bộ pendingChanges lên server.
   * Dùng Promise.allSettled để 1 request lỗi không chặn các request khác.
   * Sau khi hoàn thành (dù có lỗi hay không), luôn refetch từ server để
   * đồng bộ dữ liệu thật. Các thay đổi thất bại sẽ KHÔNG được giữ lại
   * trong hàng đợi — người dùng cần thao tác lại dựa trên dữ liệu mới nhất.
   */
  saveAllChanges: async () => {
    const { pendingChanges } = get();
    if (pendingChanges.size === 0) return;

    set({ loading: true, error: null });

    const entries = Array.from(pendingChanges.entries()); // [key, entry][]

    const tasks = entries.map(([key, entry]) => {
      if (entry.type === "add") {
        return FoodService.createFood(entry.food, entry.imageFile).then(() => key);
      }
      if (entry.type === "update") {
        return FoodService.updateFood(entry.food, entry.imageFile).then(() => key);
      }
      // delete
      return FoodService.deleteFood(entry.id).then(() => key);
    });

    const results = await Promise.allSettled(tasks);
    const failed = results.filter(r => r.status === "rejected");

    // Dù thành công hay thất bại, luôn refetch để đồng bộ dữ liệu thật từ server
    // (refreshFoods sẽ tự reset pendingChanges về Map rỗng)
    await get().refreshFoods();

    if (failed.length > 0) {
      set({
        error: `${failed.length}/${entries.length} thay đổi lưu thất bại, vui lòng kiểm tra và thử lại`,
      });
      throw new Error("Một số thay đổi không thể lưu");
    }
  },

  // ─── Discard all staged changes ────────────────────────────────────────────

  discardChanges: async () => {
    await get().refreshFoods();
  },

  // ─── Immediate (non-staged) helpers – dùng khi không cần batch ────────────

  addFood: async (food, imageFile = null) => {
    set({ loading: true, error: null });
    try {
      const newFood = await FoodService.createFood(food, imageFile);
      set(state => ({ foods: [newFood, ...state.foods], loading: false }));
      return newFood;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateFood: async (food, imageFile = null) => {
    const prev = get().foods;
    set(state => ({ foods: replaceById(state.foods, food) }));
    try {
      const updated = await FoodService.updateFood(food, imageFile);
      set(state => ({ foods: replaceById(state.foods, updated) }));
      return updated;
    } catch (err) {
      set({ foods: prev, error: err.message });
      throw err;
    }
  },

  removeFood: async (id) => {
    const prev = get().foods;
    set(state => ({ foods: state.foods.filter(f => f._id !== id) }));
    try {
      await FoodService.deleteFood(id);
    } catch (err) {
      set({ foods: prev, error: err.message });
      throw err;
    }
  },
  refreshCosts: async () => {
    set({ loading: true, error: null });

    const res = await FoodService.refreshIngredientPrices();

    if (!res.success) {
      set({
        error: res.message || "Không thể cập nhật giá nguyên liệu",
        loading: false,
      });
      throw new Error(res.message || "Refresh failed");
    }

    const { updatedCount, foods } = res.data; // res.data = { message, updatedCount, foods }
    set({ foods, loading: false });
    return { updatedCount };
  },

  clearError: () => set({ error: null }),
}));

export default useFoodZustand;