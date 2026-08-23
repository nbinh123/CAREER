// src/hooks/useSaveAllIngredientChanges.js
// [TỐI ƯU - react-query] Chuyển saveAllChanges() từ Zustand action (tự
// quản lý isSaving/saveError thủ công bằng set()) sang useMutation —
// isPending/error có sẵn từ react-query, không cần viết tay.
//
// [GIỮ NGUYÊN 100% LOGIC GỐC] Thứ tự xử lý bên dưới bám sát ĐÚNG
// saveAllChanges() gốc trong useIngredientZustand.js:
//   1. Chạy tất cả task tạo/sửa/xóa bằng Promise.allSettled — không dừng
//      giữa chừng nếu 1 task lỗi.
//   2. LUÔN cố refetch danh sách mới nhất từ server sau đó, bất kể bước 1
//      có task nào lỗi hay không.
//      - Nếu refetch fail: throw lỗi riêng ("Lưu xong nhưng không tải lại
//        được dữ liệu..."), KHÔNG xoá pending draft (để người dùng còn cơ
//        hội bấm lưu lại).
//      - Nếu refetch OK: đồng bộ cache react-query + xoá pending draft —
//        ĐÚNG hành vi gốc (dữ liệu mới nhất từ server được coi là "chốt",
//        pending list vẫn bị xoá dù có task ở bước 1 thất bại — đây là
//        hành vi có sẵn, tôi không tự ý "sửa" lại).
//   3. Nếu có task ở bước 1 bị lỗi, throw lỗi báo số lượng task thất bại
//      (dù bước 2 đã refetch xong).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import IngredientService from "../service/IngredientService";
import useIngredientDraftZustand from "../zustand/useIngredientDraftZustand";
import { INGREDIENTS_QUERY_KEY } from "./useIngredientsQuery";

export default function useSaveAllIngredientChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Đọc state MỚI NHẤT tại thời điểm mutation thực sự chạy (không
      // phải state được "chụp" lúc hook này khởi tạo) — dùng getState()
      // của zustand vanilla store thay vì selector, tránh đọc phải bản
      // pendingChanges cũ nếu người dùng vừa sửa thêm trước khi bấm lưu.
      const { pendingChanges, clearPending } = useIngredientDraftZustand.getState();

      const hasChanges =
        pendingChanges.added.length > 0 ||
        pendingChanges.updated.length > 0 ||
        pendingChanges.deleted.length > 0;
      if (!hasChanges) return;

      const tasks = [
        ...pendingChanges.added.map(({ _id, _isNew, ...rest }) =>
          IngredientService.createIngredient(rest)
        ),
        ...pendingChanges.updated.map((ing) => IngredientService.updateIngredient(ing)),
        ...pendingChanges.deleted.map((id) => IngredientService.deleteIngredient(id)),
      ];

      const results = await Promise.allSettled(tasks);
      const failed = results.filter((r) => r.status === "rejected");

      let freshData;
      try {
        freshData = await IngredientService.getAllIngredients();
      } catch (err) {
        console.error("saveAllChanges refetch error:", err);
        throw new Error("Lưu xong nhưng không tải lại được dữ liệu, vui lòng làm mới trang.");
      }

      queryClient.setQueryData(INGREDIENTS_QUERY_KEY, freshData);
      clearPending();

      if (failed.length > 0) {
        throw new Error(
          `${failed.length}/${tasks.length} thay đổi lưu thất bại, vui lòng kiểm tra và thử lại.`
        );
      }
    },
  });
}