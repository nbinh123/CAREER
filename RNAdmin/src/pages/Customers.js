import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import Animated, {
  FadeInDown,
  FadeOutDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  Search,
  RefreshCw,
  Lock,
  LockOpen,
  KeyRound,
  History,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Users,
} from "lucide-react-native";
import { getData, patchData, postData } from "../utils/callAPI";
import StatCard from "../components/StatCard";
import colors from "../theme/tokens";

const LIMIT = 10;

/* ════════════════════════════════════════════════════════════
   API HELPERS [GIU-NGUYEN]
════════════════════════════════════════════════════════════ */
function normalizeResponse(data) {
  if (data && typeof data.success === "boolean") return data;
  return { success: true, data };
}
async function apiGet(url, params) {
  const res = await getData({ url, params });
  return res.success
    ? normalizeResponse(res.data)
    : { success: false, message: res.message || "Lỗi kết nối server" };
}
async function apiPatch(url, data) {
  const res = await patchData({ url, data });
  return res.success
    ? normalizeResponse(res.data)
    : { success: false, message: res.message || "Lỗi kết nối server" };
}
async function apiPost(url, data) {
  const res = await postData({ url, data });
  return res.success
    ? normalizeResponse(res.data)
    : { success: false, message: res.message || "Lỗi kết nối server" };
}

/* ════════════════════════════════════════════════════════════
   REACT QUERY HOOKS
   Query key convention: ["customers", {page, search, statusFilter}]
   và ["customerOrders", customerId] — mọi cache invalidation/update
   nên khớp với 2 prefix này.
════════════════════════════════════════════════════════════ */
function useCustomersQuery({ page, search, statusFilter }) {
  return useQuery({
    queryKey: ["customers", { page, search, statusFilter }],
    queryFn: async () => {
      const res = await apiGet("/customers", {
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      if (!res.success) {
        throw new Error(res.message || "Không thể tải danh sách khách hàng");
      }
      // BE trả phẳng { success, total, page, limit, customers } — không bọc
      // trong "data", nên fallback về chính res khi res.data không tồn tại.
      const payload = res.data ?? res;
      const rawItems = payload.customers ?? payload.items ?? (Array.isArray(payload) ? payload : []);
      const items = Array.isArray(rawItems) ? rawItems.filter(Boolean) : [];
      return {
        items,
        total: payload.total ?? items.length,
        totalPages: payload.totalPages ?? Math.max(1, Math.ceil((payload.total ?? items.length) / LIMIT)),
      };
    },
    // Giữ data trang/tab cũ hiển thị trong lúc trang/tab mới đang tải, thay
    // cho cơ chế hasLoadedOnceRef thủ công trước đây — cùng mục đích chống
    // chớp skeleton khi đổi trang/tab/tìm kiếm.
    placeholderData: keepPreviousData,
  });
}

function useCustomerOrdersQuery(customerId) {
  return useInfiniteQuery({
    queryKey: ["customerOrders", customerId],
    queryFn: async ({ pageParam }) => {
      const res = await apiGet(`/customers/${customerId}/orders`, {
        page: pageParam,
        limit: ORDERS_PAGE_SIZE,
      });
      if (!res.success) {
        throw new Error(res.message || "Không thể tải đơn hàng");
      }
      // BE có thể trả phẳng { success, orders } hoặc bọc { success, data: { orders } }
      const payload = res.data ?? res;
      const rawOrders = payload.orders ?? (Array.isArray(payload) ? payload : []);
      const orders = Array.isArray(rawOrders) ? rawOrders.filter(Boolean) : [];
      const total = payload.total ?? orders.length;
      const totalPages = payload.totalPages ?? Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
      return { orders, page: pageParam, totalPages };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
  });
}

/* ════════════════════════════════════════════════════════════
   HELPERS [GIU-NGUYEN, thuần JS, không đụng DOM]
════════════════════════════════════════════════════════════ */
const AVATAR_COLORS = [
  ["#059669", "#34d399"], ["#7c3aed", "#a78bfa"], ["#ea580c", "#fb923c"],
  ["#0284c7", "#38bdf8"], ["#be123c", "#fb7185"], ["#0f766e", "#2dd4bf"],
];
function avatarColor(seed = "") {
  const idx = typeof seed === "string" && seed ? seed.charCodeAt(seed.length - 1) % AVATAR_COLORS.length : 0;
  return AVATAR_COLORS[idx];
}
function initials(name = "") {
  if (typeof name !== "string" || !name) return "?";
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}
function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "Chưa đăng nhập";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "Chưa đăng nhập";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtMoney(n) {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}
const ORDER_STATUS_META = {
  pending: { label: "Chờ xác nhận", cls: "pending" },
  confirmed: { label: "Đã xác nhận", cls: "processing" },
  preparing: { label: "Đang chuẩn bị", cls: "processing" },
  delivering: { label: "Đang giao", cls: "delivering" },
  completed: { label: "Hoàn thành", cls: "completed" },
  cancelled: { label: "Đã huỷ", cls: "cancelled" },
};
function orderStatusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status || "—", cls: "default" };
}
// [UI] Màu badge trạng thái đơn — quy đổi trực tiếp từ .cm-order-status.*
// gốc, cần hex literal vì đây là style={{backgroundColor}} chứ không phải
// className.
const ORDER_STATUS_COLORS = {
  completed: { bg: "#dcfce7", fg: "#166534" },
  cancelled: { bg: "#fee2e2", fg: "#b91c1c" },
  pending: { bg: "#fef3c7", fg: "#b45309" },
  processing: { bg: "#dbeafe", fg: "#1d4ed8" },
  delivering: { bg: "#ccfbf1", fg: "#0f766e" },
  default: { bg: "#f3f4f6", fg: "#4b5563" },
};
const PAYMENT_LABELS = { CASH: "Tiền mặt", BANKING: "Chuyển khoản", MOMO: "Momo", ZALOPAY: "ZaloPay" };
function paymentLabel(pm) {
  return PAYMENT_LABELS[pm] || pm || "—";
}
function orderItemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const clean = items.filter(Boolean);
  const shown = clean.slice(0, 2).map((it) => `${it.foodName || "Món"} ×${it.quantity ?? 1}`);
  const rest = clean.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest} món khác` : shown.join(", ");
}
function statusOf(c) {
  if (!c) return "active";
  if (c.isLocked) return "locked";
  const until = c.lockedUntil ? new Date(c.lockedUntil) : null;
  if (until && !isNaN(until.getTime()) && until > new Date()) return "templock";
  return "active";
}
const STATUS_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang hoạt động" },
  { key: "locked", label: "Đã khoá" },
];
// [UI] Quy đổi .cm-status-badge.* — dot dùng background:currentColor ở bản
// gốc, RN không có currentColor cho View nên ghi hex tường minh khớp với
// textClass tương ứng.
const STATUS_META = {
  active: { label: "Đang hoạt động", bgClass: "bg-green-100", textClass: "text-green-800", dot: "#166534" },
  locked: { label: "Đã khoá", bgClass: "bg-red-100", textClass: "text-red-700", dot: "#b91c1c" },
  templock: { label: "Tạm khoá (sai MK)", bgClass: "bg-amber-100", textClass: "text-amber-700", dot: "#b45309" },
};
// [UI] Quy đổi .cm-confirm-icon.*/.cm-confirm-btn.* — 3 sắc thái dùng
// chung cho ConfirmModal (khoá=rose / mở khoá=green / reset=amber).
const TONE_STYLES = {
  rose: { iconBg: "bg-red-100", iconColor: "#b91c1c", btnBg: "bg-rose-600" },
  green: { iconBg: "bg-green-100", iconColor: "#166534", btnBg: "bg-emerald-600" },
  amber: { iconBg: "bg-amber-100", iconColor: "#b45309", btnBg: "bg-amber-600" },
};

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════════════════ */
function Avatar({ name, seed }) {
  const [c1, c2] = avatarColor(seed);
  return (
    <LinearGradient
      colors={[c1, c2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: colors.white, fontWeight: "900", fontSize: 14 }}>{initials(name)}</Text>
    </LinearGradient>
  );
}

function StatusBadge({ customer, status }) {
  const meta = STATUS_META[status];
  return (
    <View style={{ gap: 5, alignSelf: "flex-start" }}>
      <View className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${meta.bgClass}`}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
        <Text className={`text-[11px] font-extrabold ${meta.textClass}`}>{meta.label}</Text>
      </View>
      {customer.mustChangePassword && (
        <Text className="text-[10px] font-extrabold text-amber-600">⚠ Cần đổi mật khẩu</Text>
      )}
    </View>
  );
}

/* ── Overlay dùng chung cho cả 3 modal ────────────────────────────────── */
/* [FIX] Trước dùng Pressable lồng Pressable (Pressable ngoài đóng modal +
   Pressable trong onPress={() => {}} chặn tap lọt xuống, tương đương
   e.stopPropagation() bên web). Cách này ép Pressable trong giành JS
   responder ngay lúc chạm, ScrollView native bên trong không có cách đàm
   phán lại responder một cách đáng tin cậy → vuốt để cuộn nội dung dài
   (lịch sử đơn, nội dung modal xác nhận dài...) trong modal bị "nuốt" mất
   — đúng lỗi đã gặp và đã sửa ở MenuPage.js/OrdersPage.js bằng cùng 1 kỹ
   thuật.
   Thay bằng 2 lớp CHỒNG NHAU kiểu anh em (không lồng cha-con): lớp dưới là
   Pressable nền phủ kín màn hình lo việc tap-outside-to-close, lớp trên là
   View nội dung không có touch handler riêng nào — chạm/vuốt vào nội dung
   sẽ trúng thẳng View đó (và ScrollView bên trong), không đi qua Pressable
   nền, nên cuộn hoạt động bình thường; chạm ra ngoài nội dung mới trúng
   Pressable nền và đóng modal (vẫn giữ tap-outside-to-close như cũ).

   [GIU-NGUYEN] maxHeight ở đây vẫn LÀ SỐ PX THẬT (winHeight * 0.85, không
   phải chuỗi "%") — đây là fix cho 1 lỗi KHÁC, không liên quan gì tới lỗi
   cuộn ở trên: nếu để "85%" thì nó chỉ resolve đúng khi CHÍNH cha của View
   này cũng có kích thước xác định, còn để hẳn 1 số cụ thể thì luôn resolve
   đúng bất kể cha là gì (ở đây cha là 1 View flex:1 canh giữa, không có
   height xác định). Nhờ vậy các modal con chỉ cần dùng maxHeight:"100%" +
   ScrollView flexShrink:1 là tự co theo nội dung và cuộn được khi tràn —
   không cần sửa gì thêm ở ConfirmModal/ResetResultModal/OrdersModal. */
function ModalOverlay({ onClose, children }) {
  const { height: winHeight } = useWindowDimensions();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(6,78,59,0.35)",
          }}
        />
        <View style={{ width: "100%", maxWidth: 420, maxHeight: winHeight * 0.85 }}>{children}</View>
      </View>
    </Modal>
  );
}

/* ── Confirm modal dùng chung: khoá / mở khoá / reset mật khẩu ─────────── */
function ConfirmModal({ tone, icon: Icon, title, sub, message, confirmLabel, loading, onConfirm, onClose }) {
  const t = TONE_STYLES[tone];
  return (
    <ModalOverlay onClose={onClose}>
      <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "100%" }}>
        <ScrollView
          style={{ flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6 pb-4 flex-row items-start justify-between border-b border-gray-100">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="text-base font-black text-emerald-900">{title}</Text>
              {!!sub && <Text className="text-xs font-semibold text-gray-400 mt-0.5">{sub}</Text>}
            </View>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
              <X size={16} color={colors.gray[400]} />
            </Pressable>
          </View>

          <View className="px-6 pt-6 pb-6 items-center">
            <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-4 ${t.iconBg}`}>
              <Icon size={24} color={t.iconColor} />
            </View>
            <Text className="text-[13.5px] font-semibold text-gray-500 text-center" style={{ lineHeight: 20 }}>
              {message}
            </Text>

            <View className="flex-row gap-2.5 mt-5" style={{ width: "100%" }}>
              <Pressable
                onPress={onClose}
                disabled={loading}
                style={{ flex: 1, paddingVertical: 13 }}
                className="bg-gray-50 border-2 border-gray-100 rounded-2xl items-center"
              >
                <Text className="text-emerald-800 font-extrabold text-sm">Huỷ</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={loading}
                style={{ flex: 2, paddingVertical: 13, opacity: loading ? 0.6 : 1 }}
                className={`rounded-2xl items-center justify-center flex-row gap-2 ${t.btnBg}`}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text className="text-white font-black text-sm">{confirmLabel}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </ModalOverlay>
  );
}

/* ── Kết quả reset mật khẩu (bước 2, sau khi confirm) ───────────────────── */
function ResetResultModal({ customer, tempPassword, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copy() {
    try {
      await Clipboard.setStringAsync(tempPassword || "");
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "100%" }}>
        <ScrollView
          style={{ flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6 pb-4 flex-row items-start justify-between border-b border-gray-100">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="text-base font-black text-emerald-900">Đã reset mật khẩu</Text>
              <Text className="text-xs font-semibold text-gray-400 mt-0.5">{customer.fullName}</Text>
            </View>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
              <X size={16} color={colors.gray[400]} />
            </Pressable>
          </View>

          <View className="px-6 pt-6 pb-6 items-center">
            <View className="w-14 h-14 rounded-2xl bg-green-100 items-center justify-center mb-4">
              <Check size={26} color={colors.green[800]} />
            </View>
            <Text className="text-xs font-bold text-gray-400" style={{ letterSpacing: 0.4 }}>MẬT KHẨU TẠM MỚI</Text>

            <View
              className="flex-row items-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-2xl mt-3 mb-4"
              style={{ width: "100%", padding: 14 }}
            >
              <Text
                className="flex-1 text-center font-black text-emerald-900"
                style={{ fontSize: 26, letterSpacing: 6 }}
                numberOfLines={1}
              >
                {tempPassword || "——————"}
              </Text>
              {!!tempPassword && (
                <Pressable
                  onPress={copy}
                  className={`w-10 h-10 rounded-xl border-2 items-center justify-center ${copied ? "bg-green-50 border-green-300" : "bg-white border-gray-200"}`}
                >
                  {copied ? <Check size={16} color={colors.green[600]} /> : <Copy size={16} color="#065f46" />}
                </Pressable>
              )}
            </View>

            {copyError && (
              <Text className="text-xs font-semibold text-red-700 text-center mb-3">
                Không thể sao chép tự động, vui lòng bôi đen và chép thủ công.
              </Text>
            )}

            <Text className="text-xs font-semibold text-gray-400 text-center" style={{ lineHeight: 18 }}>
              {tempPassword
                ? "Đọc mã này cho khách qua điện thoại/chat hỗ trợ. Khách sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập kế tiếp."
                : "Reset thành công nhưng server không trả về mật khẩu tạm — kiểm tra lại field phản hồi của API reset-password."}
            </Text>

            <Pressable
              onPress={onClose}
              className="bg-emerald-600 rounded-2xl items-center justify-center mt-5"
              style={{ width: "100%", paddingVertical: 13 }}
            >
              <Text className="text-white font-black text-sm">Đã đọc, đóng lại</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </ModalOverlay>
  );
}

/* ── Lịch sử đơn hàng ────────────────────────────────────────────────────── */
const ORDERS_PAGE_SIZE = 3;
const ORDERS_PREFILL_PAGES = 3; // tự động tải trước tối đa 3 trang (9 đơn) khi mở modal

function OrdersModal({ customer, onClose }) {
  const {
    data,
    isLoading, // true chỉ ở lần tải trang đầu tiên (chưa có cache cho customer này)
    isError, // trang đầu lỗi
    isFetchingNextPage,
    isFetchNextPageError, // load-more lỗi — khác isError, không xoá list đã có
    hasNextPage,
    fetchNextPage,
  } = useCustomerOrdersQuery(customer._id);

  const orders = useMemo(() => (data ? data.pages.flatMap((p) => p.orders) : []), [data]);
  const loadedPages = data?.pages?.length ?? 0;

  const handleLoadMore = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) return;
    fetchNextPage();
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  const handleScroll = useCallback((e) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (distanceFromBottom < 80) handleLoadMore();
  }, [handleLoadMore]);

  // limit=3 rất nhỏ -> trang đầu thường không đủ cao để tràn khỏi khung nhìn,
  // khiến onScroll không bao giờ bắn. Bản trước dùng onLayout/onContentSizeChange
  // để TỰ ĐO xem nội dung đã tràn khung chưa rồi mới quyết định tải thêm — nhưng
  // việc đo layout dễ lệch timing giữa lúc React render xong và lúc native đo
  // xong kích thước thật, khiến ScrollView có thể đã đủ nội dung nhưng effect
  // vẫn tưởng chưa, hoặc ngược lại — kẹt cuộn. Giờ tải trước một số trang CỐ
  // ĐỊNH (không đo gì cả, dựa thẳng vào số trang đã tải trong data.pages),
  // sau đó việc cuộn tiếp hoàn toàn do onScroll đảm nhiệm như bình thường.
  useEffect(() => {
    if (
      !isLoading &&
      !isFetchingNextPage &&
      !isFetchNextPageError &&
      hasNextPage &&
      loadedPages < ORDERS_PREFILL_PAGES
    ) {
      handleLoadMore();
    }
  }, [isLoading, isFetchingNextPage, isFetchNextPageError, hasNextPage, loadedPages, handleLoadMore]);

  return (
    <ModalOverlay onClose={onClose}>
      <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "100%" }}>
        <ScrollView
          style={{ flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={100}
        >
          <View className="px-6 pt-6 pb-4 flex-row items-start justify-between border-b border-gray-100">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="text-base font-black text-emerald-900">Lịch sử đơn hàng</Text>
              <Text className="text-xs font-semibold text-gray-400 mt-0.5">{customer.fullName} · {customer.phone}</Text>
            </View>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
              <X size={16} color={colors.gray[400]} />
            </Pressable>
          </View>

          <View className="px-4" style={{ paddingVertical: 14, gap: 8 }}>
            {isLoading ? (
              <View className="items-center py-10">
                <ActivityIndicator color={colors.gray[400]} />
                <Text className="text-[13px] font-bold text-gray-400 mt-2">Đang tải đơn hàng…</Text>
              </View>
            ) : isError ? (
              <View className="items-center py-10">
                <Text style={{ fontSize: 36 }}>🛠️</Text>
                <Text className="text-sm font-bold text-gray-300 mt-2 text-center">Chưa lấy được dữ liệu đơn hàng.</Text>
              </View>
            ) : orders.length === 0 ? (
              <View className="items-center py-10">
                <Text style={{ fontSize: 36 }}>🧾</Text>
                <Text className="text-sm font-bold text-gray-300 mt-2 text-center">Khách hàng chưa có đơn hàng nào.</Text>
              </View>
            ) : (
              orders.filter(Boolean).map((o, i) => {
                const meta = orderStatusMeta(o.status);
                const mc = ORDER_STATUS_COLORS[meta.cls] || ORDER_STATUS_COLORS.default;
                const itemsLine = orderItemsSummary(o.items);
                return (
                  <View
                    key={o._id || i}
                    className="bg-gray-50 border border-gray-100 rounded-2xl flex-row items-start justify-between"
                    style={{ padding: 14, gap: 10 }}
                  >
                    <View style={{ flex: 1 }}>
                      <View className="flex-row items-center gap-2 mb-0.5" style={{ flexWrap: "wrap" }}>
                        <Text className="text-[13px] font-black text-emerald-900">
                          #{o.orderCode || (typeof o._id === "string" ? o._id.slice(-6) : o._id) || i + 1}
                        </Text>
                        <View style={{ backgroundColor: mc.bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 }}>
                          <Text style={{ color: mc.fg, fontSize: 10, fontWeight: "800" }}>{meta.label.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text className="text-[11px] font-semibold text-gray-400">
                        {fmtDateTime(o.createdAt)} · {paymentLabel(o.paymentMethod)}
                      </Text>
                      {!!itemsLine && (
                        <Text className="text-[11px] font-semibold text-gray-500 mt-1" style={{ lineHeight: 15 }}>
                          {itemsLine}
                        </Text>
                      )}
                      {String(o.status).toLowerCase() === "cancelled" && o.cancelReason && (
                        <Text className="text-[11px] font-semibold text-red-700 mt-1" style={{ fontStyle: "italic" }}>
                          Lý do huỷ: {o.cancelReason}
                        </Text>
                      )}
                    </View>
                    <Text className="text-emerald-700 font-black text-sm" numberOfLines={1}>
                      {fmtMoney(o.totalAmount ?? o.totalPrice ?? o.total)}
                    </Text>
                  </View>
                );
              })
            )}
            {!isLoading && !isError && orders.length > 0 && (
              isFetchingNextPage ? (
                <View className="items-center py-4">
                  <ActivityIndicator color={colors.gray[400]} size="small" />
                </View>
              ) : isFetchNextPageError ? (
                <Text className="text-center text-[11px] font-bold text-red-400 py-2">
                  Không tải được thêm — kéo lại để thử lại
                </Text>
              ) : !hasNextPage ? (
                <Text className="text-center text-[11px] font-bold text-gray-300 py-2">— Đã hết đơn hàng —</Text>
              ) : null
            )}
          </View>
        </ScrollView>
      </View>
    </ModalOverlay>
  );
}

/* ── 1 khách hàng = 1 card (thay cho 1 hàng <tr> ở bản gốc) ─────────────── */
const CustomerCard = React.memo(function CustomerCard({ customer, isLast, onViewOrders, onLock, onUnlock, onReset }) {
  const st = statusOf(customer);
  return (
    <View className={`px-4 py-4 ${isLast ? "" : "border-b border-gray-50"}`} style={{ gap: 10 }}>
      <View className="flex-row items-center gap-3">
        <Avatar name={customer.fullName} seed={customer._id} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text className="text-[13.5px] font-black text-emerald-900" numberOfLines={1}>
            {customer.fullName || "Chưa đặt tên"}
          </Text>
          <Text className="text-xs font-semibold text-gray-400">{customer.phone}</Text>
        </View>
      </View>

      <StatusBadge customer={customer} status={st} />

      <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
        <Text className="text-[11px] font-semibold text-gray-400">Tạo: {fmtDate(customer.createdAt)}</Text>
        <Text className="text-[11px] text-gray-200">·</Text>
        <Text className="text-[11px] font-semibold text-gray-400">Đăng nhập: {fmtDateTime(customer.lastLoginAt)}</Text>
        <Text className="text-[11px] text-gray-200">·</Text>
        <View className="bg-green-50 px-2 py-0.5 rounded-full">
          <Text className="text-[11px] font-black text-green-700">
            {customer.orderCount === undefined || customer.orderCount === null ? "—" : customer.orderCount} đơn
          </Text>
        </View>
      </View>

      <View className="flex-row justify-end items-center" style={{ gap: 6 }}>
        <Pressable
          onPress={() => onViewOrders(customer)}
          className="w-9 h-9 rounded-xl border-2 border-gray-200 bg-gray-50 items-center justify-center"
        >
          <History size={15} color="#065f46" />
        </Pressable>
        {st === "locked" ? (
          <Pressable
            onPress={() => onUnlock(customer)}
            className="w-9 h-9 rounded-xl border-2 border-gray-200 bg-gray-50 items-center justify-center"
          >
            <LockOpen size={15} color={colors.green[600]} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => onLock(customer)}
            className="w-9 h-9 rounded-xl border-2 border-gray-200 bg-gray-50 items-center justify-center"
          >
            <Lock size={15} color="#b91c1c" />
          </Pressable>
        )}
        <Pressable
          onPress={() => onReset(customer)}
          className="w-9 h-9 rounded-xl border-2 border-gray-200 bg-gray-50 items-center justify-center"
        >
          <KeyRound size={15} color="#065f46" />
        </Pressable>
      </View>
    </View>
  );
});

/* ── Skeleton card lúc loading (thay .cm-skel-row) ──────────────────────── */
function SkeletonCard() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={animStyle} className="px-4 py-4 border-b border-gray-50">
      <View className="flex-row items-center gap-3">
        <View className="bg-gray-200 rounded-xl" style={{ width: 40, height: 40 }} />
        <View style={{ gap: 6 }}>
          <View className="bg-gray-200 rounded" style={{ width: 130, height: 12 }} />
          <View className="bg-gray-200 rounded" style={{ width: 90, height: 10 }} />
        </View>
      </View>
      <View className="bg-gray-200 rounded-full mt-3" style={{ width: 110, height: 18 }} />
      <View className="bg-gray-200 rounded mt-3" style={{ width: 200, height: 10 }} />
    </Animated.View>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function CustomersPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [confirmAction, setConfirmAction] = useState(null); // { type: 'lock'|'unlock'|'reset', customer }
  const [resetResult, setResetResult] = useState(null); // { customer, tempPassword }
  const [ordersCustomer, setOrdersCustomer] = useState(null);

  const [toast, setToast] = useState(null); // { msg, error }
  const toastTimer = useRef(null);
  const searchDebounce = useRef(null);

  /* debounce search */
  useEffect(() => {
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(searchDebounce.current);
  }, [searchInput]);

  /* dọn toast timer khi unmount, tránh setState sau khi unmount */
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function showToast(msg, isError = false) {
    clearTimeout(toastTimer.current);
    setToast({ msg, error: isError });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const {
    data: customersData,
    isLoading, // chỉ true ở lần tải đầu tiên (chưa có data/placeholder nào)
    isFetching, // true cho MỌI lần fetch (đổi trang/tab/tìm kiếm + bấm làm mới)
    isError: customersError,
    error: customersErrorObj,
    refetch: refetchCustomers,
  } = useCustomersQuery({ page, search, statusFilter });

  const list = customersData?.items ?? [];
  const total = customersData?.total ?? 0;
  const totalPages = customersData?.totalPages ?? 1;

  useEffect(() => {
    if (customersError) {
      showToast(customersErrorObj?.message || "Không thể tải danh sách khách hàng", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customersError, customersErrorObj]);

  /* Cập nhật MỌI trang/tab đang cache trong react-query cho 1 khách hàng cụ
     thể, thay vì chỉ sửa list đang hiển thị — tránh trang khác bị data cũ khi
     quay lại. */
  function patchCachedCustomer(customerId, patch) {
    queryClient.setQueriesData({ queryKey: ["customers"] }, (old) => {
      if (!old) return old;
      return { ...old, items: old.items.map((c) => (c._id === customerId ? { ...c, ...patch } : c)) };
    });
  }

  const lockUnlockMutation = useMutation({
    mutationFn: async ({ customer, type }) => {
      const res = await apiPatch(`/customers/${customer._id}/${type}`);
      if (!res.success) throw new Error(res.message || "Thao tác thất bại");
      return { customer, type };
    },
    onSuccess: ({ customer, type }) => {
      patchCachedCustomer(customer._id, { isLocked: type === "lock" });
      showToast(type === "lock" ? "✅ Đã khoá tài khoản" : "✅ Đã mở khoá tài khoản");
      setConfirmAction(null);
    },
    onError: (err) => showToast(err.message || "Thao tác thất bại", true),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (customer) => {
      const res = await apiPost(`/customers/${customer._id}/reset-password`);
      if (!res.success) throw new Error(res.message || "Reset mật khẩu thất bại");
      // Tương tự: BE có thể trả phẳng { success, tempPassword } thay vì bọc trong "data"
      const payload = res.data ?? res;
      const tempPassword = payload.tempPassword ?? payload.newPassword ?? payload.password ?? null;
      return { customer, tempPassword };
    },
    onSuccess: ({ customer, tempPassword }) => {
      patchCachedCustomer(customer._id, { mustChangePassword: true });
      setConfirmAction(null);
      setResetResult({ customer, tempPassword });
    },
    onError: (err) => showToast(err.message || "Reset mật khẩu thất bại", true),
  });

  const confirmLoading =
    confirmAction?.type === "reset" ? resetPasswordMutation.isPending : lockUnlockMutation.isPending;

  /* ── lock / unlock / reset execution ── */
  function runConfirmAction() {
    if (!confirmAction) return;
    const { type, customer } = confirmAction;
    if (type === "reset") {
      resetPasswordMutation.mutate(customer);
    } else {
      lockUnlockMutation.mutate({ customer, type });
    }
  }

  /* ── stats (derived data) ── */
  const mustChangeCount = useMemo(
    () => list.filter((c) => c.mustChangePassword).length,
    [list]
  );

  /* ── handlers ổn định cho CustomerCard (React.memo) ──
     Trước đây được tạo mới bên trong list.map() ở mỗi lần render, khiến
     memo của CustomerCard vô nghĩa vì prop function luôn đổi reference. */
  const handleLock = useCallback((cust) => setConfirmAction({ type: "lock", customer: cust }), []);
  const handleUnlock = useCallback((cust) => setConfirmAction({ type: "unlock", customer: cust }), []);
  const handleReset = useCallback((cust) => setConfirmAction({ type: "reset", customer: cust }), []);

  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 18 }} keyboardShouldPersistTaps="handled">

        {/* ── header ── */}
        <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
          <View>
            <Text className="text-2xl font-black text-green-900">Quản lý khách hàng</Text>
            <Text className="text-sm text-gray-500 mt-0.5">{total} khách hàng trong hệ thống</Text>
          </View>
          <Pressable
            onPress={() => refetchCustomers()}
            disabled={isFetching}
            className="flex-row items-center gap-1.5 bg-white border-2 border-gray-200 rounded-2xl"
            style={{ paddingHorizontal: 14, paddingVertical: 10 }}
          >
            {isFetching ? (
              <ActivityIndicator size="small" color={colors.gray[600]} />
            ) : (
              <RefreshCw size={14} color={colors.gray[600]} />
            )}
            <Text className="text-gray-600 font-extrabold text-xs">{isFetching ? "Đang tải…" : "Làm mới"}</Text>
          </Pressable>
        </View>

        {/* ── stats ── */}
        <View className="flex-row flex-wrap gap-3">
          <StatCard icon={Users} label="Tổng khách hàng" value={total} sub="Toàn hệ thống" color="green" />
          <StatCard icon={KeyRound} label="Cần đổi mật khẩu" value={mustChangeCount} sub="Sau khi admin reset (trang này)" color="amber" />
        </View>

        {/* ── toolbar ── */}
        <View style={{ gap: 10 }}>
          <View style={{ position: "relative", justifyContent: "center" }}>
            <View style={{ position: "absolute", left: 13, zIndex: 1 }}>
              <Search size={15} color={colors.gray[400]} />
            </View>
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Tìm theo tên hoặc số điện thoại…"
              placeholderTextColor={colors.gray[300]}
              className="bg-white border-2 border-gray-200 rounded-2xl text-emerald-900 font-semibold"
              style={{ paddingLeft: 38, paddingRight: 14, paddingVertical: 11, fontSize: 14 }}
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => { setStatusFilter(t.key); setPage(1); }}
                style={{ paddingHorizontal: 14, paddingVertical: 9 }}
                className={`rounded-xl ${statusFilter === t.key ? "bg-emerald-600" : "bg-white border-2 border-gray-200"}`}
              >
                <Text className={`text-xs font-extrabold ${statusFilter === t.key ? "text-white" : "text-emerald-800"}`}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── list ── */}
        <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : list.length === 0 ? (
            <View className="items-center py-14 px-6">
              <Text style={{ fontSize: 36 }}>🔍</Text>
              <Text className="text-sm font-bold text-gray-300 mt-2">Không tìm thấy khách hàng nào</Text>
            </View>
          ) : (
            list.map((c, i) => (
              <CustomerCard
                key={c._id || c.phone || i}
                customer={c}
                isLast={i === list.length - 1}
                onViewOrders={setOrdersCustomer}
                onLock={handleLock}
                onUnlock={handleUnlock}
                onReset={handleReset}
              />
            ))
          )}

          {/* ── pagination ── */}
          {!isLoading && list.length > 0 && (
            <View className="flex-row items-center justify-between px-4 py-3.5 border-t border-gray-100">
              <Text className="text-xs font-bold text-gray-400">{total} khách hàng · {LIMIT}/trang</Text>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                  style={{ opacity: page <= 1 ? 0.4 : 1 }}
                  className="w-8 h-8 rounded-xl bg-gray-50 border-2 border-gray-200 items-center justify-center"
                >
                  <ChevronLeft size={16} color="#065f46" />
                </Pressable>
                <Text className="text-[13px] font-extrabold text-emerald-900" style={{ minWidth: 80, textAlign: "center" }}>
                  Trang {page} / {totalPages}
                </Text>
                <Pressable
                  onPress={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  style={{ opacity: page >= totalPages ? 0.4 : 1 }}
                  className="w-8 h-8 rounded-xl bg-gray-50 border-2 border-gray-200 items-center justify-center"
                >
                  <ChevronRight size={16} color="#065f46" />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── modals ── */}
      {confirmAction?.type === "lock" && (
        <ConfirmModal
          tone="rose"
          icon={Lock}
          title="Khoá tài khoản khách hàng"
          sub={confirmAction.customer.fullName}
          confirmLabel="Khoá tài khoản"
          loading={confirmLoading}
          onConfirm={runConfirmAction}
          onClose={() => setConfirmAction(null)}
          message={
            <>
              Khách hàng{" "}
              <Text style={{ fontWeight: "900", color: colors.emerald[900] }}>{confirmAction.customer.fullName}</Text>
              {" "}({confirmAction.customer.phone}) sẽ không thể đăng nhập cho tới khi được mở khoá lại. Bạn có chắc chắn?
            </>
          }
        />
      )}
      {confirmAction?.type === "unlock" && (
        <ConfirmModal
          tone="green"
          icon={LockOpen}
          title="Mở khoá tài khoản"
          sub={confirmAction.customer.fullName}
          confirmLabel="Mở khoá"
          loading={confirmLoading}
          onConfirm={runConfirmAction}
          onClose={() => setConfirmAction(null)}
          message={
            <>
              Khách hàng{" "}
              <Text style={{ fontWeight: "900", color: colors.emerald[900] }}>{confirmAction.customer.fullName}</Text>
              {" "}({confirmAction.customer.phone}) sẽ có thể đăng nhập lại bình thường. Xác nhận mở khoá?
            </>
          }
        />
      )}
      {confirmAction?.type === "reset" && (
        <ConfirmModal
          tone="amber"
          icon={ShieldAlert}
          title="Reset mật khẩu"
          sub={confirmAction.customer.fullName}
          confirmLabel="Reset mật khẩu"
          loading={confirmLoading}
          onConfirm={runConfirmAction}
          onClose={() => setConfirmAction(null)}
          message={
            <>
              Hệ thống sẽ tạo mật khẩu tạm 6 số mới cho{" "}
              <Text style={{ fontWeight: "900", color: colors.emerald[900] }}>{confirmAction.customer.fullName}</Text>
              {" "}và buộc đổi mật khẩu ở lần đăng nhập kế tiếp. Mật khẩu cũ sẽ không còn dùng được.
            </>
          }
        />
      )}
      {resetResult && (
        <ResetResultModal
          customer={resetResult.customer}
          tempPassword={resetResult.tempPassword}
          onClose={() => setResetResult(null)}
        />
      )}
      {ordersCustomer && (
        <OrdersModal customer={ordersCustomer} onClose={() => setOrdersCustomer(null)} />
      )}

      {/* ── toast ── */}
      {toast && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOutDown.duration(300)}
          style={{ position: "absolute", left: 0, right: 0, bottom: 20, alignItems: "center" }}
        >
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 11,
              borderRadius: 100,
              backgroundColor: toast.error ? "#7f1d1d" : colors.emerald[900],
            }}
          >
            <Text style={{ color: toast.error ? "#fecaca" : "#d1fae5", fontSize: 13, fontWeight: "800" }}>
              {toast.msg}
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}