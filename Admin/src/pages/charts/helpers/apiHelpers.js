import { API_URL } from "../../../config/api";
import useAuthZustand from "../../../zustand/useAuthZustand"; // sửa lại đúng đường dẫn tương đối

export const API_BASE = `${API_URL}/api/analyst`;

export async function apiFetch(path) {
    const token = useAuthZustand.getState().accessToken;

    const res = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
}