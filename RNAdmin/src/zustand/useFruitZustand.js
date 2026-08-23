// src/zustand/useFruitZustand.js
// [GIU-NGUYEN] Toàn bộ business logic (staged add/update/remove, save-all,
// discard, immediate mutations...) giữ nguyên 100% hành vi so với bản gốc.
//
// [RQ-INTEGRATION] Phần thay đổi DUY NHẤT: lớp đọc dữ liệu server
// (refreshFruits) giờ đi qua `queryClient.fetchQuery` của @tanstack/react-query
// thay vì gọi thẳng FruitService. Lợi ích:
//   - Cache theo `staleTime` cấu hình chung ở queryClient.js (10s) — nếu data
//     còn mới, fetchQuery trả ngay từ cache, không tốn network request.
//   - Dedupe: nếu 2 nơi trong app cùng gọi refreshFruits gần như đồng thời,
//     react-query gộp lại thành 1 request duy nhất thay vì bắn trùng.
//   - saveAllChanges() invalidate cache trước khi refetch để đảm bảo luôn lấy
//     dữ liệu MỚI NHẤT từ server sau khi lưu (không dính cache cũ).
// Toàn bộ tên field/action export ra (fruits, loading, error, getFruits,
// stageAddFruit, saveAllChanges, pendingChanges, clearError...) giữ NGUYÊN
// SI — không cần sửa bất kỳ màn hình nào đang dùng store này (FruitPage.js,
// App.js...).
//
// Lưu ý: guard `if (get().fruits.length > 0) return;` trong getFruits() vẫn
// được GIỮ NGUYÊN như bản gốc — không thay bằng việc luôn gọi refreshFruits()
// và trông chờ react-query tự quyết định fresh/stale. Lý do: refreshFruits()
// reset pendingChanges về Map rỗng mỗi lần chạy; nếu bỏ guard, mỗi lần
// FruitPage.js mount lại sẽ vô tình xoá sạch các thay đổi đang staged chưa
// lưu của người dùng. Cache của react-query chỉ có tác dụng ở những lần
// refreshFruits() THỰC SỰ chạy (lần đầu, discardChanges, sau saveAllChanges).
import { create } from "zustand";
import FruitService from "../service/FruitService";
import { queryClient } from "../config/queryClient";

const FRUITS_QUERY_KEY = ["fruits"];

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
      const raw = await queryClient.fetchQuery({
        queryKey: FRUITS_QUERY_KEY,
        queryFn: () => FruitService.getAllFruits(),
      });
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

    // [RQ-INTEGRATION] Đánh dấu cache "fruits" đã cũ để refreshFruits() ngay
    // sau đây bắt buộc gọi lại server, không trả nhầm bản cache từ trước khi lưu.
    await queryClient.invalidateQueries({ queryKey: FRUITS_QUERY_KEY });
    await get().refreshFruits();

    if (failed.length > 0) {
      set({
        error: `${failed.length}/${entries.length} thay đổi lưu thất bại, vui lòng kiểm tra và thử lại`,
      });
      throw new Error("Một số thay đổi không thể lưu");
    }
  },

  // [RQ-INTEGRATION] Không cần invalidate ở đây: huỷ thay đổi chỉ bỏ draft cục
  // bộ, dữ liệu server chưa hề đổi nên dùng lại cache hiện có (nếu còn mới)
  // là đúng và nhanh hơn hẳn so với luôn phải gọi lại server.
  discardChanges: async () => {
    await get().refreshFruits();
  },

  addFruit: async (fruit, imageFile = null) => {
    set({ loading: true, error: null });
    try {
      const newFruit = await FruitService.createFruit(fruit, imageFile);
      set((state) => ({ fruits: [newFruit, ...state.fruits], loading: false }));
      queryClient.invalidateQueries({ queryKey: FRUITS_QUERY_KEY });
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
      queryClient.invalidateQueries({ queryKey: FRUITS_QUERY_KEY });
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
      queryClient.invalidateQueries({ queryKey: FRUITS_QUERY_KEY });
    } catch (err) {
      set({ fruits: prev, error: err.message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useFruitZustand;