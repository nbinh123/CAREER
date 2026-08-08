import { useState, useEffect, useCallback } from "react";
import { getFruits } from "../api/fruitApi";

export function useFruits() {
  const [fruits, setFruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFruits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFruits();
      setFruits(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFruits();
  }, [fetchFruits]);

  return { fruits, loading, error, refetch: fetchFruits };
}
