import { useState, useEffect, useCallback } from "react";
import { getFoods } from "../api/foodApi";

// Y hệt bản web — gọi API qua axiosClient, không có gì đặc thù nền tảng.
export function useFoods() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFoods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFoods();
      setFoods(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  return { foods, loading, error, refetch: fetchFoods };
}
