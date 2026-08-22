// src/zustand/useFoodZustand.js
// [GIU-NGUYEN] Copy nguyên vẹn 100% state + actions từ bản web. Đã rà soát
// kỹ (2.4) — không có API DOM-only nào lọt vào file này, toàn bộ chỉ gọi
// FoodService (đã tự adapt phần platform-specific ở service/FoodService.js).
import { create } from "zustand";
import FoodService from "../service/FoodService";

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
      const foods = await FoodService.getAllFoods();
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

    await get().refreshFoods();

    if (failed.length > 0) {
      set({
        error: `${failed.length}/${entries.length} thay đổi lưu thất bại, vui lòng kiểm tra và thử lại`,
      });
      throw new Error("Một số thay đổi không thể lưu");
    }
  },

  discardChanges: async () => {
    await get().refreshFoods();
  },

  // ─── Immediate (non-staged) helpers ────────────────────────────────────
  addFood: async (food, imageFile = null) => {
    set({ loading: true, error: null });
    try {
      const newFood = await FoodService.createFood(food, imageFile);
      set((state) => ({ foods: [newFood, ...state.foods], loading: false }));
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
      return { updatedCount };
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useFoodZustand;
