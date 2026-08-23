// src/zustand/useFoodZustand.js
// [GIU-NGUYEN] Toàn bộ business logic (staged add/update/remove, save-all,
// discard, immediate mutations...) giữ nguyên 100% hành vi so với bản gốc.
//
// [RQ-INTEGRATION] Tương tự useFruitZustand.js — xem chú thích chi tiết ở đó.
// Tóm tắt: refreshFoods() giờ đọc qua queryClient.fetchQuery (cache theo
// staleTime dùng chung + dedupe request trùng), saveAllChanges() invalidate
// cache "foods" trước khi refetch để không dính cache cũ sau khi lưu,
// refreshCosts() ghi thẳng data mới vào cache bằng setQueryData để tránh 1
// lần fetch thừa. Toàn bộ tên field/action export ra giữ NGUYÊN SI — App.js
// và các màn hình khác đang dùng store này không cần sửa gì.
//
// Guard `if (get().foods.length > 0) return;` trong getFoods() được GIỮ
// NGUYÊN như bản gốc (không thay bằng "luôn gọi refreshFoods rồi để
// react-query tự quyết định fresh/stale") vì refreshFoods() reset
// pendingChanges mỗi lần chạy — bỏ guard sẽ vô tình xoá draft chưa lưu của
// người dùng mỗi khi màn hình mount lại.
import { create } from "zustand";
import FoodService from "../service/FoodService";
import { queryClient } from "../config/queryClient";

const FOODS_QUERY_KEY = ["foods"];

// ─── Helpers ──────────────────────────────────────────────────────────────
const replaceById = (arr, updated) => arr.map((f) => (f._id === updated._id ? updated : f));
const pendingKey = (type, id) => `${type}:${id}`;

// ─── Store ────────────────────────────────────────────────────────────────
const useFoodZustand = create((set, get) => ({
  foods: [],
  categories: [],
  loading: false,
  error: null,

  /**
   * Queue các thay đổi chưa được đồng bộ lên server.
   * Shape: Map<string, { type: 'add'|'update'|'delete', food?, imageFile? }>
   */
  pendingChanges: new Map(),

  // ─── Foods ───────────────────────────────────────────────────────────
  getFoods: async () => {
    if (get().foods.length > 0) return;
    await get().refreshFoods();
  },

  refreshFoods: async () => {
    set({ loading: true, error: null });
    try {
      const foods = await queryClient.fetchQuery({
        queryKey: FOODS_QUERY_KEY,
        queryFn: () => FoodService.getAllFoods(),
      });
      set({ foods, loading: false, pendingChanges: new Map() });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── Local-only mutations (staged, chưa gửi server) ──────────────────
  stageAddFood: (food, imageFile = null) => {
    const tempId = `temp_${Date.now()}`;
    const draft = { ...food, _id: tempId, __isNew: true };
    set((state) => {
      const next = new Map(state.pendingChanges);
      next.set(pendingKey("add", tempId), { type: "add", food: draft, imageFile });
      return { foods: [draft, ...state.foods], pendingChanges: next };
    });
    return draft;
  },

  stageUpdateFood: (food, imageFile = null) => {
    set((state) => {
      const next = new Map(state.pendingChanges);
      const key = pendingKey("update", food._id);
      const existing = next.get(pendingKey("add", food._id));
      if (existing) {
        next.set(pendingKey("add", food._id), { ...existing, food, imageFile });
      } else {
        next.set(key, { type: "update", food, imageFile });
      }
      return { foods: replaceById(state.foods, food), pendingChanges: next };
    });
  },

  stageRemoveFood: (id) => {
    set((state) => {
      const next = new Map(state.pendingChanges);
      if (next.has(pendingKey("add", id))) {
        next.delete(pendingKey("add", id));
      } else {
        next.delete(pendingKey("update", id));
        next.set(pendingKey("delete", id), { type: "delete", id });
      }
      return {
        foods: state.foods.filter((f) => f._id !== id),
        pendingChanges: next,
      };
    });
  },

  pendingCount: () => get().pendingChanges.size,

  // ─── Save all (flush to server) ────────────────────────────────────────
  saveAllChanges: async () => {
    const { pendingChanges } = get();
    if (pendingChanges.size === 0) return;
    set({ loading: true, error: null });

    const entries = Array.from(pendingChanges.entries());

    const tasks = entries.map(([key, entry]) => {
      if (entry.type === "add") {
        return FoodService.createFood(entry.food, entry.imageFile).then(() => key);
      }
      if (entry.type === "update") {
        return FoodService.updateFood(entry.food, entry.imageFile).then(() => key);
      }
      return FoodService.deleteFood(entry.id).then(() => key);
    });

    const results = await Promise.allSettled(tasks);
    const failed = results.filter((r) => r.status === "rejected");

    // [RQ-INTEGRATION] Đánh dấu cache "foods" đã cũ để refreshFoods() ngay
    // sau đây bắt buộc gọi lại server, không trả nhầm bản cache từ trước khi lưu.
    await queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY });
    await get().refreshFoods();

    if (failed.length > 0) {
      set({
        error: `${failed.length}/${entries.length} thay đổi lưu thất bại, vui lòng kiểm tra và thử lại`,
      });
      throw new Error("Một số thay đổi không thể lưu");
    }
  },

  // [RQ-INTEGRATION] Không cần invalidate: huỷ thay đổi chỉ bỏ draft cục bộ,
  // dữ liệu server chưa hề đổi nên dùng lại cache hiện có (nếu còn mới) là
  // đúng và nhanh hơn so với luôn phải gọi lại server.
  discardChanges: async () => {
    await get().refreshFoods();
  },

  // ─── Immediate (non-staged) helpers ────────────────────────────────────
  addFood: async (food, imageFile = null) => {
    set({ loading: true, error: null });
    try {
      const newFood = await FoodService.createFood(food, imageFile);
      set((state) => ({ foods: [newFood, ...state.foods], loading: false }));
      queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY });
      return newFood;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateFood: async (food, imageFile = null) => {
    const prev = get().foods;
    set((state) => ({ foods: replaceById(state.foods, food) }));
    try {
      const updated = await FoodService.updateFood(food, imageFile);
      set((state) => ({ foods: replaceById(state.foods, updated) }));
      queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY });
      return updated;
    } catch (err) {
      set({ foods: prev, error: err.message });
      throw err;
    }
  },

  removeFood: async (id) => {
    const prev = get().foods;
    set((state) => ({ foods: state.foods.filter((f) => f._id !== id) }));
    try {
      await FoodService.deleteFood(id);
      queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY });
    } catch (err) {
      set({ foods: prev, error: err.message });
      throw err;
    }
  },

  refreshCosts: async () => {
    set({ loading: true, error: null });
    try {
      const { updatedCount, foods } = await FoodService.refreshIngredientPrices();
      set({ foods, loading: false });
      // [RQ-INTEGRATION] Đã có data mới nhất trong tay ngay tại đây — ghi
      // thẳng vào cache bằng setQueryData thay vì invalidate rồi phải fetch
      // lại, tránh 1 network request thừa cho lần đọc "foods" tiếp theo.
      queryClient.setQueryData(FOODS_QUERY_KEY, foods);
      return { updatedCount };
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useFoodZustand;