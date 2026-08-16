import { useState, useEffect, useCallback } from "react";
import { getFruitMixOptions } from "../api/fruitApi";

export function useFruitMix() {
    const [data, setData] = useState({
        fruits: [],
        combos: [],
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMixOptions = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await getFruitMixOptions();
            setData(result);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMixOptions();
    }, [fetchMixOptions]);

    return {
        fruits: data.fruits,
        comboFoods: data.combos,
        loading,
        error,
        refetch: fetchMixOptions,
    };
}