import { useState, useEffect, useCallback } from "react";
import { getTopFruitCombos } from "../api/fruitApi";

export function useTopFruitCombos(limit = 6) {
  const [topCombos, setTopCombos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTopCombos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTopFruitCombos(limit);
      setTopCombos(data);
    } catch {
      // Không chặn trải nghiệm chính nếu gợi ý lỗi — khách vẫn tự chọn được
      setTopCombos([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchTopCombos();
  }, [fetchTopCombos]);

  return { topCombos, loading, refetch: fetchTopCombos };
}
