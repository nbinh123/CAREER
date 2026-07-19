import { create } from "zustand";
import IngredientService from "../service/IngredientService";

// Prefix phân biệt item tạo mới chưa lưu lên DB
const TEMP_PREFIX = "__temp__";
const makeTempId = () => `${TEMP_PREFIX}${Date.now()}_${Math.random()}`;

const EMPTY_PENDING = { added: [], updated: [], deleted: [] };

const useIngredientZustand = create((set, get) => ({

    // ─── State ─────────────────────────────────────────────
    ingredients: [],

    // Theo dõi thay đổi chưa lưu lên server
    // added   : ingredient mới (chưa có trong DB, id là tempId)
    // updated : ingredient đã có trong DB và bị sửa (id là _id của DB)
    // deleted : _id của ingredient cần xóa trên DB
    pendingChanges: { ...EMPTY_PENDING },

    isLoading: false,
    isSaving: false,
    saveError: null,

    // ─── Getters ───────────────────────────────────────────
    get hasPendingChanges() {
        const { pendingChanges } = get();
        return (
            pendingChanges.added.length > 0 ||
            pendingChanges.updated.length > 0 ||
            pendingChanges.deleted.length > 0
        );
    },

    get pendingCount() {
        const { pendingChanges } = get();
        return (
            pendingChanges.added.length +
            pendingChanges.updated.length +
            pendingChanges.deleted.length
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

    // Thêm nguyên liệu mới → lưu tạm với tempId
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

    // Sửa nguyên liệu → cập nhật local + ghi vào pending tương ứng
    editIngredientLocal: (updatedIngredient) => {
        set((state) => {
            const { pendingChanges } = state;

            // Nếu là item mới chưa lưu → cập nhật trong danh sách added
            const isInAdded = pendingChanges.added.some(
                (i) => i._id === updatedIngredient._id
            );

            const newAdded = isInAdded
                ? pendingChanges.added.map((i) =>
                      i._id === updatedIngredient._id ? updatedIngredient : i
                  )
                : pendingChanges.added;

            // Nếu là item DB → thêm/cập nhật trong danh sách updated
            const alreadyInUpdated = pendingChanges.updated.some(
                (i) => i._id === updatedIngredient._id
            );

            const newUpdated = isInAdded
                ? pendingChanges.updated  // item mới chưa lưu, không cần updated
                : alreadyInUpdated
                ? pendingChanges.updated.map((i) =>
                      i._id === updatedIngredient._id ? updatedIngredient : i
                  )
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

    // Xóa nguyên liệu → xóa local + ghi vào pending tương ứng
    deleteIngredientLocal: (id) => {
        set((state) => {
            const { pendingChanges } = state;
            const isInAdded = pendingChanges.added.some((i) => i._id === id);

            return {
                ingredients: state.ingredients.filter((i) => i._id !== id),
                pendingChanges: {
                    // Nếu item chưa từng lưu lên DB → chỉ cần bỏ khỏi added
                    added: pendingChanges.added.filter((i) => i._id !== id),
                    // Dọn khỏi updated (nếu có)
                    updated: pendingChanges.updated.filter((i) => i._id !== id),
                    // Chỉ thêm vào deleted nếu item thật sự tồn tại trên DB
                    deleted: isInAdded
                        ? pendingChanges.deleted
                        : [...pendingChanges.deleted, id],
                },
            };
        });
    },

    // ─── Lưu tất cả thay đổi lên server ──────────────────
    /**
     * Dùng Promise.allSettled để 1 request lỗi không chặn các request khác
     * (VD: 1 update lỗi vẫn không được cản trở các delete/add khác gửi đi).
     * Sau khi hoàn thành (dù có lỗi hay không), luôn fetch lại dữ liệu mới
     * nhất từ server. Các thay đổi thất bại sẽ KHÔNG được giữ lại trong
     * hàng đợi — người dùng cần thao tác lại dựa trên dữ liệu mới nhất.
     */
    saveAllChanges: async () => {
        const { pendingChanges } = get();
        const hasChanges =
            pendingChanges.added.length > 0 ||
            pendingChanges.updated.length > 0 ||
            pendingChanges.deleted.length > 0;

        if (!hasChanges) return;

        set({ isSaving: true, saveError: null });

        const tasks = [
            // Tạo mới: bỏ tempId trước khi gửi
            ...pendingChanges.added.map(({ _id, _isNew, ...rest }) =>
                IngredientService.createIngredient(rest)
            ),
            // Cập nhật
            ...pendingChanges.updated.map((ing) =>
                IngredientService.updateIngredient(ing)
            ),
            // Xóa
            ...pendingChanges.deleted.map((id) =>
                IngredientService.deleteIngredient(id)
            ),
        ];

        const results = await Promise.allSettled(tasks);
        const failed = results.filter((r) => r.status === "rejected");

        try {
            // Dù thành công hay thất bại, luôn fetch lại dữ liệu mới nhất
            const freshData = await IngredientService.getAllIngredients();
            set({
                ingredients: freshData,
                pendingChanges: { ...EMPTY_PENDING },
                isSaving: false,
            });
        } catch (err) {
            // Lỗi khi fetch lại — giữ nguyên state cũ, báo lỗi chung
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

    // Reset lỗi lưu
    clearSaveError: () => set({ saveError: null }),

    // Huỷ toàn bộ thay đổi chưa lưu → fetch lại từ server
    discardChanges: async () => {
        const data = await IngredientService.getAllIngredients();
        set({ ingredients: data, pendingChanges: { ...EMPTY_PENDING } });
    },
}));

export default useIngredientZustand;