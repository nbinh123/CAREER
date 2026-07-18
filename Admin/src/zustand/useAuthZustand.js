// stores/useAuthZustand.js

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { loginService } from "../service/AuthService";
import { postData } from "../utils/callAPI";   // ← thêm import

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
         Được persist để timer sống sót qua refresh trang.
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
         2. Gọi API POST /users/:id/update-work-time { workHour }
            (workHour = số phút, khớp với fmtHours trong StaffManager).
         3. Reset shiftStartTime → null.
         4. Gọi logout() để xóa session.

         Returns: { success, minutesWorked?, message? }
      ========================================================= */
      endShift: async () => {
        const { currentUser, shiftStartTime } = get();

        // Edge case: không có ca đang chạy → chỉ logout
        if (!shiftStartTime || !currentUser) {
          get().logout();
          return { success: true, minutesWorked: 0 };
        }

        const minutesWorked = Math.floor((Date.now() - shiftStartTime) / 60_000);

        try {
          // Chỉ gọi API nếu có giờ làm thực tế (> 0 phút)
          if (minutesWorked > 0) {
            const res = await postData({
              url: `/users/${currentUser._id}/work-time`,
              // workHour ở đây gửi số PHÚT, backend cộng thẳng vào
              // unpaidWorkTime (đơn vị phút, thể hiện qua fmtHours).
              // Nếu backend tính lương: salaryToAdd = workHour * hourlySalary
              // thì cần sửa thành: salaryToAdd = (workHour / 60) * hourlySalary
              data: { workHour: minutesWorked / 60 },   // ← GỬI SỐ GIỜ (float), backend tự tính phút và lương
            });

            if (!res.success) {
              return { success: false, message: res.message || "Cập nhật giờ làm thất bại" };
            }
          }

          // Reset ca + đăng xuất
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
      ========================================================= */
      logout: () => {
        set({
          currentUser: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isAdmin: false,
          // shiftStartTime không reset ở đây → do endShift tự reset
          // để tránh mất dữ liệu nếu logout bất thường
          shiftStartTime: null,
        });
      },

      /* =========================================================
         CLEAR ALL AUTH
      ========================================================= */
      clearAuth: () => {
        localStorage.removeItem("auth-storage");
        set({
          currentUser: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isAdmin: false,
          shiftStartTime: null,
        });
      },

      stopWorking: () => {
        set({
          isWorking: false,
        });
      },

      beginWorking: () => {
        set({
          isWorking: true,
        });
      }
    }),

    /* ── Persist config ───────────────────────────────────────
       Thêm shiftStartTime vào partialize để timer tồn tại
       qua refresh trang / đóng tab.
    ─────────────────────────────────────────────────────── */
    {
      name: "auth-storage",
      partialize: (state) => ({
        currentUser: state.currentUser,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.currentUser?.role === "admin",
        shiftStartTime: state.shiftStartTime,   // ← THÊM MỚI
      }),
    }
  )
);

export default useAuthZustand;