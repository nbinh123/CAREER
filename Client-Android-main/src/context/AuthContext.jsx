import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import * as SecureStore from "expo-secure-store";
import axiosClient from "../api/axiosClient";

/**
 * ============================================================================
 * THAM KHẢO / DỰ PHÒNG — không phải trọng tâm của giai đoạn 5.
 * ============================================================================
 * Theo kế hoạch (mục 5.2, 5.4, 7 - giai đoạn 4), AuthContext + màn Đăng
 * nhập/Đăng ký + lưu token bằng expo-secure-store ĐÃ ĐƯỢC LÀM XONG rồi.
 * File này chỉ tồn tại để:
 *
 *   1. Các screen/context ở bộ giai đoạn 5 (CheckoutScreen, SocketContext...)
 *      có một `useAuth()` cụ thể để import và chạy thử ngay được, không bị
 *      lỗi "module not found" khi bạn ghép bộ file này vào dự án.
 *   2. Làm tài liệu tham chiếu về ĐÚNG SHAPE mà các screen bên dưới mong đợi
 *      từ hook useAuth(): { customer, accessToken, isAuthenticated, login,
 *      register, logout, logoutAll, updateProfile }.
 *
 * ⚠️ NẾU BẠN ĐÃ CÓ AuthContext THẬT từ giai đoạn 4: xoá file này, và sửa lại
 * để hook useAuth() của bạn trả về đủ các field/hàm cùng tên như trên (đổi
 * tên field cho khớp thay vì đổi tên field ở các screen dùng nó).
 * ============================================================================
 */

const AuthContext = createContext(null);

const ACCESS_TOKEN_KEY = "customer_access_token";
const REFRESH_TOKEN_KEY = "customer_refresh_token";

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null); // { id, phone, fullName, addresses... } | null
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // đang kiểm tra token đã lưu lúc mở app
  const refreshingRef = useRef(null); // Promise đang refresh dở, tránh gọi refresh-token trùng lặp

  // Khởi động: đọc token đã lưu, có thì thử lấy hồ sơ để xác nhận còn hiệu lực.
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (token) {
          setAccessToken(token);
          const res = await axiosClient.get("/api/customers/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          setCustomer(res.data);
        }
      } catch {
        // Token hỏng/hết hạn và refresh cũng thất bại (xem interceptor bên
        // dưới) -> coi như chưa đăng nhập, để Auth Stack tự xử lý.
        await clearTokens();
        setAccessToken(null);
        setCustomer(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Interceptor: tự đính Authorization header, tự refresh khi gặp 401.
  useEffect(() => {
    const reqId = axiosClient.interceptors.request.use((config) => {
      if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
      return config;
    });

    const resId = axiosClient.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          try {
            const newToken = await refreshAccessToken();
            original.headers.Authorization = `Bearer ${newToken}`;
            return axiosClient(original);
          } catch {
            await logout();
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axiosClient.interceptors.request.eject(reqId);
      axiosClient.interceptors.response.eject(resId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const refreshAccessToken = useCallback(async () => {
    if (refreshingRef.current) return refreshingRef.current;
    refreshingRef.current = (async () => {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error("Không có refresh token");
      const res = await axiosClient.post("/api/customers/refresh-token", { refreshToken });
      const nextAccess = res.data.accessToken;
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, nextAccess);
      setAccessToken(nextAccess);
      return nextAccess;
    })();
    try {
      return await refreshingRef.current;
    } finally {
      refreshingRef.current = null;
    }
  }, []);

  const login = useCallback(async (phone, password) => {
    const res = await axiosClient.post("/api/customers/login", { phone, password });
    const { accessToken: at, refreshToken: rt, customer: c } = res.data;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, at);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, rt);
    setAccessToken(at);
    setCustomer(c);
    return c;
  }, []);

  const register = useCallback(async (phone, password, fullName) => {
    const res = await axiosClient.post("/api/customers/register", { phone, password, fullName });
    console.log("register res", res.data);
    const { accessToken: at, refreshToken: rt, customer: c } = res.data;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, at);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, rt);
    setAccessToken(at);
    setCustomer(c);
    return c;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axiosClient.post("/api/customers/logout");
    } catch {
      // Bỏ qua lỗi mạng lúc logout — vẫn xoá token cục bộ để chắc chắn đăng
      // xuất được, không kẹt khách lại trong app vì server không phản hồi.
    }
    await clearTokens();
    setAccessToken(null);
    setCustomer(null);
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await axiosClient.post("/api/customers/logout-all");
    } finally {
      await clearTokens();
      setAccessToken(null);
      setCustomer(null);
    }
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const res = await axiosClient.patch("/api/customers/me", patch);
    setCustomer(res.data);
    return res.data;
  }, []);

  const value = useMemo(
    () => ({
      customer,
      accessToken,
      isAuthenticated: Boolean(accessToken && customer),
      isLoading,
      login,
      register,
      logout,
      logoutAll,
      updateProfile,
    }),
    [customer, accessToken, isLoading, login, register, logout, logoutAll, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng trong AuthProvider");
  return ctx;
}
