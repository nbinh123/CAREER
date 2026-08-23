// src/hooks/useIngredientsQuery.js
// [TỐI ƯU - react-query] Bọc useQuery quanh đúng IngredientService.getAllIngredients
// đã có sẵn — không đổi API contract, không bypass IngredientService/callAPI.js.
// react-query lo phần cache, dedupe request trùng (nhiều màn hình cùng gọi
// hook này chỉ bắn 1 request), tự retry theo cấu hình trong queryClient.js,
// và tự refetch khi mất mạng có lại / quay lại app (nhờ useOnlineManager và
// useAppState đã gắn ở App.js).
import { useQuery } from "@tanstack/react-query";
import IngredientService from "../service/IngredientService";

export const INGREDIENTS_QUERY_KEY = ["ingredients"];

export default function useIngredientsQuery() {
  return useQuery({
    queryKey: INGREDIENTS_QUERY_KEY,
    queryFn: IngredientService.getAllIngredients,
  });
}