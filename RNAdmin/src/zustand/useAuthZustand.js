// src/zustand/useAuthZustand.js
// [GIU-NGUYEN toàn bộ action/state] Giữ nguyên 100% logic (login, logout,
// endShift, startShift, stopWorking, beginWorking...). Chỉ đổi storage engine
// của middleware persist: localStorage (web) → AsyncStorage (RN), theo đúng
// quyết định 0.7 trong progress.md.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { loginService } from "../service/AuthService";
import { postData } from "../utils/callAPI";

const useAuthZustand = create(
  persist(
    (set, get) => ({
      /* =========================================================
         STATE
      ========================================================= */
      isAdmin: null,
      currentUser: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isWorking: true,
      /* ── Shift state ────────────────────────────────────────
         shiftStartTime: timestamp (ms) khi nhân viên bắt đầu ca.
         null = chưa có ca nào đang chạy.
         Được persist để timer sống sót qua restart app.
      ─────────────────────────────────────────────────────── */
      shiftStartTime: null,

      /* =========================================================
         LOGIN
      ========================================================= */
      login: async ({ phone, password }) => {
        try {
          set({ isLoading: true });

          const result = await loginService({ phone, password });

          if (!result.success) {
            return { success: false, message: result.message };
          }

          set({
            currentUser: result.data.user,
            accessToken: result.data.token,
            refreshToken: result.data.refreshToken,
            isAuthenticated: true,
          });

          return { success: true, message: result.data.message };
        } catch {
          return { success: false, message: "Lỗi đăng nhập" };
        } finally {
          set({ isLoading: false });
        }
      },

      /* =========================================================
         UPDATE USER
      ========================================================= */
      updateUser: (updatedData) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;
        set({ currentUser: { ...currentUser, ...updatedData } });
      },

      /* =========================================================
         UPDATE ACCESS TOKEN
      ========================================================= */
      setAccessToken: (token) => set({ accessToken: token }),

      /* =========================================================
         START SHIFT
         Ghi lại thời điểm bắt đầu ca (timestamp ms).
      ========================================================= */
      startShift: () => {
        set({ shiftStartTime: Date.now() });
      },

      /* =========================================================
         END SHIFT
         1. Tính số phút đã làm từ shiftStartTime → hiện tại.
         2. Gọi API POST /users/:id/work-time { workHour } (đơn vị giờ).
         3. Reset shiftStartTime → null.
         4. Gọi logout() để xóa session.
      ========================================================= */
      endShift: async () => {
        const { currentUser, shiftStartTime } = get();

        if (!shiftStartTime || !currentUser) {
          get().logout();
          return { success: true, minutesWorked: 0 };
        }

        const minutesWorked = Math.floor((Date.now() - shiftStartTime) / 60_000);

        try {
          if (minutesWorked > 0) {
            const res = await postData({
              url: `/users/${currentUser._id}/work-time`,
              data: { workHour: minutesWorked / 60 },
            });

            if (!res.success) {
              return { success: false, message: res.message || "Cập nhật giờ làm thất bại" };
            }
          }

          set({ shiftStartTime: null });
          get().logout();

          return { success: true, minutesWorked };
        } catch (err) {
          console.error("[endShift]", err);
          return { success: false, message: "Lỗi server khi kết thúc ca làm" };
        }
      },

      /* =========================================================
         LOGOUT
         [FIX] Thêm isWorking: true — trước đó không reset field này, nên
         nếu 1 nhân viên bấm "tạm dừng ca" (stopWorking()) rồi đăng xuất mà
         KHÔNG tắt app, người đăng nhập kế tiếp trên cùng thiết bị (rất phổ
         biến với tablet/điện thoại dùng chung ở quầy) sẽ bị chặn nhầm ở
         màn Forbidden "đang tạm dừng ca" dù họ chưa từng bấm nút đó.
      ========================================================= */
      logout: () => {
        set({
          currentUser: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isAdmin: false,
          shiftStartTime: null,
          isWorking: true,
        });
      },

      /* =========================================================
         CLEAR ALL AUTH
         [THAY ĐỔI PLATFORM] localStorage.removeItem(...) (đồng bộ, web)
         → AsyncStorage.removeItem(...) (bất đồng bộ, RN). Không await ở đây
         để không chặn logic reset state đồng bộ ngay bên dưới — persist
         middleware sẽ tự ghi đè lại storage ngay sau set() nên việc xoá
         chạy nền là an toàn.
         [FIX] Cùng lý do reset isWorking: true như logout() ở trên.
      ========================================================= */
      clearAuth: () => {
        AsyncStorage.removeItem("auth-storage").catch((err) =>
          console.error("[clearAuth] AsyncStorage.removeItem lỗi:", err)
        );
        set({
          currentUser: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isAdmin: false,
          shiftStartTime: null,
          isWorking: true,
        });
      },

      stopWorking: () => {
        set({ isWorking: false });
      },

      beginWorking: () => {
        set({ isWorking: true });
      },
    }),

    /* ── Persist config ───────────────────────────────────────
       [THAY ĐỔI PLATFORM] storage: createJSONStorage(() => AsyncStorage)
       thay cho mặc định localStorage của bản web. Toàn bộ shape dữ liệu
       persist (partialize) giữ nguyên y hệt.
    ─────────────────────────────────────────────────────── */
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentUser: state.currentUser,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.currentUser?.role === "admin",
        shiftStartTime: state.shiftStartTime,
      }),
    }
  )
);

export default useAuthZustand;
