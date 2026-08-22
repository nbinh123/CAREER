// src/zustand/useFruitZustand.js
// [GIU-NGUYEN] Copy nguyên vẹn 100% từ bản web — không có API DOM-only.
import { create } from "zustand";
import FruitService from "../service/FruitService";

const replaceById = (arr, updated) => arr.map((f) => (f._id === updated._id ? updated : f));
const pendingKey = (type, id) => `${type}:${id}`;

const useFruitZustand = create((set, get) => ({
  fruits: [],
  loading: false,
  error: null,

  /** Map<string, { type: 'add'|'update'|'delete', fruit?, imageFile? }> */
  pendingChanges: new Map(),

  getFruits: async () => {
    if (get().fruits.length > 0) return;
    await get().refreshFruits();
  },

  refreshFruits: async () => {
    set({ loading: true, error: null });
    try {
      const raw = await FruitService.getAllFruits();
      const fruits = Array.isArray(raw) ? raw : [];
      if (!Array.isArray(raw)) {
        console.error("[useFruitZustand] /api/fruits không trả về mảng, nhận được:", raw);
      }
      set({ fruits, loading: false, pendingChanges: new Map() });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  stageAddFruit: (fruit, imageFile = null) => {
    const tempId = `temp_${Date.now()}`;
    const draft = { ...fruit, _id: tempId, __isNew: true };
    set((state) => {
      const next = new Map(state.pendingChanges);
      next.set(pendingKey("add", tempId), { type: "add", fruit: draft, imageFile });
      return { fruits: [draft, ...state.fruits], pendingChanges: next };
    });
    return draft;
  },

  stageUpdateFruit: (fruit, imageFile = null) => {
    set((state) => {
      const next = new Map(state.pendingChanges);
      const key = pendingKey("update", fruit._id);
      const existing = next.get(pendingKey("add", fruit._id));
      if (existing) {
        next.set(pendingKey("add", fruit._id), { ...existing, fruit, imageFile });
      } else {
        next.set(key, { type: "update", fruit, imageFile });
      }
      return { fruits: replaceById(state.fruits, fruit), pendingChanges: next };
    });
  },

  stageRemoveFruit: (id) => {
    set((state) => {
      const next = new Map(state.pendingChanges);
      if (next.has(pendingKey("add", id))) {
        next.delete(pendingKey("add", id));
      } else {
        next.delete(pendingKey("update", id));
        next.set(pendingKey("delete", id), { type: "delete", id });
      }
      return {
        fruits: state.fruits.filter((f) => f._id !== id),
        pendingChanges: next,
      };
    });
  },

  pendingCount: () => get().pendingChanges.size,

  saveAllChanges: async () => {
    const { pendingChanges } = get();
    if (pendingChanges.size === 0) return;
    set({ loading: true, error: null });

    const entries = Array.from(pendingChanges.entries());

    const tasks = entries.map(([key, entry]) => {
      if (entry.type === "add") {
        return FruitService.createFruit(entry.fruit, entry.imageFile).then(() => key);
      }
      if (entry.type === "update") {
        return FruitService.updateFruit(entry.fruit, entry.imageFile).then(() => key);
      }
      return FruitService.deleteFruit(entry.id).then(() => key);
    });

    const results = await Promise.allSettled(tasks);
    const failed = results.filter((r) => r.status === "rejected");

    await get().refreshFruits();

    if (failed.length > 0) {
      set({
        error: `${failed.length}/${entries.length} thay đổi lưu thất bại, vui lòng kiểm tra và thử lại`,
      });
      throw new Error("Một số thay đổi không thể lưu");
    }
  },

  discardChanges: async () => {
    await get().refreshFruits();
  },

  addFruit: async (fruit, imageFile = null) => {
    set({ loading: true, error: null });
    try {
      const newFruit = await FruitService.createFruit(fruit, imageFile);
      set((state) => ({ fruits: [newFruit, ...state.fruits], loading: false }));
      return newFruit;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateFruit: async (fruit, imageFile = null) => {
    const prev = get().fruits;
    set((state) => ({ fruits: replaceById(state.fruits, fruit) }));
    try {
      const updated = await FruitService.updateFruit(fruit, imageFile);
      set((state) => ({ fruits: replaceById(state.fruits, updated) }));
      return updated;
    } catch (err) {
      set({ fruits: prev, error: err.message });
      throw err;
    }
  },

  removeFruit: async (id) => {
    const prev = get().fruits;
    set((state) => ({ fruits: state.fruits.filter((f) => f._id !== id) }));
    try {
      await FruitService.deleteFruit(id);
    } catch (err) {
      set({ fruits: prev, error: err.message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useFruitZustand;
