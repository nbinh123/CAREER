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
  //
  // BUGFIX (đăng nhập nhanh không ăn, phải đăng nhập lại mới gửi đơn được):
  // Bản cũ coi BẤT KỲ lỗi nào ở bước gọi /api/customers/me (kể cả rớt
  // mạng/timeout ngay lúc app vừa mở, wifi/4G chưa kịp "tỉnh" — rất hay gặp
  // lúc cold start) đều là "token hỏng", rồi XOÁ LUÔN token đang còn hạn và
  // buộc quay về màn Đăng nhập. Token vẫn hợp lệ nhưng cứ mạng chập chờn một
  // nhịp là mất phiên oan, đúng triệu chứng "phải đăng nhập lại thì mới gửi
  // đơn được". Sửa: chỉ coi là hết phiên (xoá token) khi SERVER THỰC SỰ từ
  // chối token (401/403); lỗi mạng/timeout thì thử lại vài lần thay vì đầu
  // hàng ngay, và nếu vẫn lỗi mạng thì GIỮ NGUYÊN token đã lưu (không xoá)
  // để lần mở app kế tiếp/khi có mạng lại vẫn tự đăng nhập nhanh được bình
  // thường, thay vì phải gõ lại mật khẩu chỉ vì một lần lỗi mạng thoáng qua.
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (token) {
          setAccessToken(token);
          const me = await fetchProfileWithRetry(token);
          setCustomer(me);
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          // Token thật sự không còn hợp lệ (hết hạn/bị thu hồi) -> đây mới
          // đúng là "hết phiên", cho quay lại màn Đăng nhập.
          await clearTokens();
          setAccessToken(null);
          setCustomer(null);
        }
        // Lỗi khác (mất mạng, timeout...): không đụng tới token đã lưu.
        // customer tạm thời vẫn null nên isAuthenticated vẫn false (không
        // vào Main Tab với hồ sơ rỗng dẫn tới tên/SĐT không đồng bộ khi đặt
        // đơn) — khách sẽ thấy lại màn Đăng nhập lần này, nhưng phiên chưa
        // bị xoá nên có mạng lại là đăng nhập nhanh thành công ngay, không
        // cần gõ lại mật khẩu.
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
    // Cùng 1 cấu trúc response với GET /api/customers/me ở trên -> chuẩn hoá
    // giống hệt để tránh lặp lại bug "customer rỗng field" sau khi lưu hồ sơ.
    const customerData = normalizeCustomer(res.data);
    setCustomer(customerData);
    return customerData;
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

// Dùng riêng cho bước kiểm tra đăng nhập nhanh lúc mở app: thử lại tối đa 3
// lần khi gặp lỗi MẠNG (không có response từ server), vì đây là lỗi hay tự
// khỏi (mạng vừa tỉnh dậy) chứ không phải token sai. Gặp lỗi có response
// (401/403 token bị từ chối) thì dừng ngay, không có gì để thử lại.
async function fetchProfileWithRetry(token, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await axiosClient.get("/api/customers/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return normalizeCustomer(res.data);
    } catch (err) {
      lastErr = err;
      if (err?.response) throw err; // lỗi từ server (vd 401) -> không retry
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// BUGFIX (đăng nhập nhanh vào được Menu nhưng tab Tài khoản trống tên/SĐT):
// login()/register() đọc hồ sơ từ `res.data.customer` (server bọc trong 1
// field "customer" cùng accessToken/refreshToken). Đăng nhập nhanh trước đó
// lại gán thẳng `res.data` cho customer, coi /api/customers/me trả object
// phẳng — nhưng endpoint này (theo test thực tế) CŨNG bọc dữ liệu trong
// "customer" giống login/register. Kết quả: customer state vẫn là 1 object
// có thật (nên isAuthenticated=true, vào được Menu) nhưng field cần dùng
// (fullName, phone) nằm sai 1 cấp -> rỗng, khiến tab Tài khoản trống và ô
// SĐT khoá ở Checkout cũng rỗng theo. Sửa: tự nhận diện nếu response có bọc
// trong field "customer" thì bóc ra, không thì dùng thẳng — vừa khớp đúng
// shape thật của BE, vừa không vỡ nếu sau này BE đổi cách bọc.
function normalizeCustomer(raw) {
  if (raw && typeof raw === "object" && raw.customer && typeof raw.customer === "object") {
    return raw.customer;
  }
  return raw;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng trong AuthProvider");
  return ctx;
}