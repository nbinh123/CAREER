import { API_URL } from "../../../config/api";
export const API_BASE = `${API_URL}/api/analyst`;

export async function apiFetch(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
}