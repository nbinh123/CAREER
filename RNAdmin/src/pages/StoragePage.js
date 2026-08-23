import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Package, AlertTriangle, TrendingUp, Trash2 } from "lucide-react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { getData, postData } from "../utils/callAPI";
import { API_URL } from "../config/api";
import useAuthZustand from "../zustand/useAuthZustand";
import useIngredientZustand from "../zustand/useIngredientZustand";
import StatCard from "../components/StatCard";
import colors from "../theme/tokens";

/* ════════════════════════════════════════════════════════════
   GHI CHÚ BẢN CẬP NHẬT NÀY

   1. [PERF] Toàn bộ state tự quản (rows, stats, pager, loading, error,
      hàm load()) được thay bằng @tanstack/react-query:
      - Cache tự động theo (trang, tìm kiếm, loại, khoảng ngày) — quay
        lại đúng tổ hợp bộ lọc vừa xem trong 15s không cần gọi lại API.
      - placeholderData: keepPreviousData giữ nguyên danh sách cũ khi
        đang tải trang/bộ lọc mới, tránh nháy trắng màn hình.
      - Sau khi nhập kho / ghi nhận hư hỏng thành công, chỉ cần
        invalidateQueries — không tự gọi lại load() thủ công nữa.
      Yêu cầu: cần cài đặt `@tanstack/react-query` và bọc App trong
      `QueryClientProvider` ở gốc cây component (nếu dự án chưa có).
      (Bản ghi chú này giả định @tanstack/react-query v5 — nếu dự án
      đang dùng v4 thì đổi `placeholderData: keepPreviousData` thành
      `keepPreviousData: true` và đổi `isPending` thành `isLoading`.)

   2. [FIX-SCROLL] 2 modal (Nhập kho / Ghi nhận hư hỏng) trước đây kéo
      không lướt được, dù kéo ở vùng trống giữa các trường hay ở tiêu
      đề. Nguyên nhân: ScrollView bên trong modal không có `flex: 1`,
      nên theo mặc định của Yoga (flexShrink: 0), nó tự co giãn theo
      đúng chiều cao nội dung thay vì bị ép vào phần còn lại của
      `maxHeight` khung modal cha — tức là bên trong ScrollView không
      hề có phần "tràn" để cuộn (frame height == content height), mọi
      thao tác kéo đều vô tác dụng dù phần dưới bị cắt hình do
      `overflow: hidden` của View cha. Phần tiêu đề (nằm tách hẳn bên
      ngoài ScrollView) thì dĩ nhiên không thể kéo-cuộn được vì không
      thuộc vùng scroll.
      → Đã thêm `flex: 1` cho ScrollView để nó thực sự bị giới hạn
      chiều cao và có thể cuộn, đồng thời đưa tiêu đề vào làm phần tử
      đầu tiên (dùng `stickyHeaderIndices={[0]}`) của chính ScrollView
      đó — tiêu đề vẫn dính ở trên khi cuộn, nhưng kéo bắt đầu từ đó
      giờ cũng điều khiển được việc cuộn nội dung bên dưới.
════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════
   CONSTANTS [GIU-NGUYEN]
════════════════════════════════════════════════════════════ */
const DAMAGE_REASONS = [
  "Hết hạn sử dụng",
  "Hư hỏng do bảo quản không đúng cách",
  "Hư hỏng khi vận chuyển / nhập hàng",
  "Thất thoát / mất mát",
  "Khác",
];

// [PERF] Mảng tĩnh, không phụ thuộc state/props — đưa ra ngoài component
// để không bị tạo lại mỗi lần StoragePage render.
const TYPE_TABS = [
  { key: "", label: "Tất cả" },
  { key: "IMPORT", label: "Nhập kho" },
  { key: "EXPORT", label: "Hư hỏng" },
];

const fmt = {
  money: (n) => (n ? Number(n).toLocaleString("vi-VN") + "đ" : "—"),
  date: (d) =>
    new Date(d).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  num: (n) => Number(n).toLocaleString("vi-VN"),
};

// Dùng getFullYear/getMonth/getDate (giờ local) thay vì toISOString(), vì
// toISOString() quy đổi sang UTC và có thể lùi 1 ngày ở múi giờ VN (+7).
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const currentMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { fromDate: toISODate(first), toDate: toISODate(last) };
};
// [UI] chỉ dùng để hiển thị ô ngày dạng dd/mm/yyyy, không ảnh hưởng giá trị
// ISO thực sự đang lưu trong filters.
const shortDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/* ════════════════════════════════════════════════════════════
   API LAYER — thay cho `http = axios.create()` cục bộ của bản gốc
   (xem giải thích ở đầu file)
════════════════════════════════════════════════════════════ */
const txService = {
  list: (p) => getData({ url: "/ingredient-transactions", params: p }),
  exportStock: (d) => postData({ url: "/ingredient-transactions/export", data: d }),
};

// Upload multipart bằng fetch thuần — cùng pattern uploadRaw đã dùng ở
// service/FoodService.js, xem giải thích platform ở đầu file.
async function uploadInvoiceImport(formData) {
  const token = useAuthZustand.getState().accessToken;
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}/api/ingredient-transactions/import`, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch (networkErr) {
    throw new Error(networkErr.message || "Lỗi kết nối tới server");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* response không có JSON body */
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }
  return data;
}

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ
════════════════════════════════════════════════════════════ */

/* Overlay dùng chung cho mọi modal — tương đương e.stopPropagation() bên
   web, cùng pattern ModalOverlay đã dùng ở IngredientsPage.js/Customers.js.
   [FIX-SCROLL-2] Trước đây lớp "chặn tap lan ra ngoài" là 1 Pressable —
   Pressable tự nhận quyền responder ngay từ lúc chạm (để nhận biết
   press-in/press-out), nên với modal mà TOÀN BỘ nội dung (kể cả tiêu đề,
   nút hành động) đều nằm trong 1 ScrollView duy nhất như hiện tại, việc có
   thêm 1 Pressable bao NGOÀI ScrollView vẫn tiềm ẩn rủi ro tranh quyền
   responder ở đúng điểm chạm đầu tiên trên toàn bộ modal. Đổi sang View
   thường + onStartShouldSetResponder={() => true}: vẫn giữ được đúng hành
   vi "chạm bên trong modal thì không đóng, chạm ra ngoài (nền mờ) thì
   đóng", nhưng không có logic theo dõi press nào cạnh tranh với ScrollView
   — nhường hẳn quyền xử lý kéo/cuộn cho ScrollView ngay từ điểm chạm đầu
   tiên, bất kể chạm ở đâu trên modal. */
function ModalOverlay({ onClose, maxWidth = 440, children }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(10,14,20,0.55)",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <View onStartShouldSetResponder={() => true} style={{ width: "100%", maxWidth }}>
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

/* ── Ô chọn ngày, thay <input type="date"> ──────────────────────────── */
const DateField = React.memo(function DateField({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(`${value}T00:00:00`) : new Date();

  const handleChange = (event, selected) => {
    if (Platform.OS === "android") {
      setShow(false);
      if (event.type === "set" && selected) onChange(toISODate(selected));
      return;
    }
    // iOS: picker dạng spinner không tự đóng, cập nhật giá trị ngay khi
    // cuộn, đóng khi bấm "Xong" bên dưới.
    if (selected) onChange(toISODate(selected));
  };

  return (
    <View style={{ flex: 1, minWidth: 150, gap: 5 }}>
      <Text className="text-[11px] font-bold text-gray-400" style={{ letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Pressable
        onPress={() => setShow(true)}
        className="bg-[#FAFBFC] border border-gray-200 rounded-lg flex-row items-center justify-between"
        style={{ paddingHorizontal: 12, paddingVertical: 9 }}
      >
        <Text className="text-[13.5px] text-gray-800">{value ? shortDate(value) : "Chọn ngày"}</Text>
        <Text style={{ fontSize: 13 }}>📅</Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
        />
      )}
      {show && Platform.OS === "ios" && (
        <Pressable
          onPress={() => setShow(false)}
          className="items-center bg-blue-600 rounded-lg"
          style={{ paddingVertical: 8, marginTop: 4 }}
        >
          <Text className="text-white text-xs font-bold">Xong</Text>
        </Pressable>
      )}
    </View>
  );
});

/* ── Danh sách chọn nguyên liệu có tìm kiếm — thay cho IngredientSearchSelect
   (dropdown tuyệt đối định vị) VÀ <select> thường của ExportModal gốc, xem
   giải thích platform ở đầu file. Hiển thị ngay trong thân modal (đổi chế
   độ hiển thị), không dùng dropdown lơ lửng. ────────────────────────── */
const IngredientPickerBody = React.memo(function IngredientPickerBody({ ingredients, selectedId, onPick, onCancel }) {
  const [q, setQ] = useState("");
  // [PERF] chỉ lọc lại khi q hoặc danh sách ingredients thực sự đổi, thay vì
  // mỗi lần component này re-render (ví dụ do selectedId đổi).
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? ingredients.filter((i) => (i.ingredientName || "").toLowerCase().includes(needle)) : ingredients;
  }, [q, ingredients]);

  return (
    <View style={{ gap: 10 }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Gõ tên nguyên liệu..."
        placeholderTextColor={colors.gray[300]}
        autoFocus
        className="bg-[#FAFBFC] border border-gray-200 rounded-xl text-sm text-gray-800"
        style={{ paddingHorizontal: 14, paddingVertical: 10 }}
      />
      <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {filtered.length === 0 ? (
          <Text className="text-center text-gray-400 text-sm py-6">Không tìm thấy nguyên liệu</Text>
        ) : (
          filtered.map((i) => (
            <Pressable
              key={i._id}
              onPress={() => onPick(i._id)}
              className={`flex-row items-center justify-between rounded-xl ${i._id === selectedId ? "bg-blue-50" : ""}`}
              style={{ paddingHorizontal: 12, paddingVertical: 11 }}
            >
              <Text className="text-sm text-gray-800 flex-1" numberOfLines={1}>
                {i.ingredientName}
              </Text>
              <Text className="text-[11.5px] text-gray-400 font-mono">
                {fmt.num(i.quantity)} {i.smallUnit}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
      <Pressable
        onPress={onCancel}
        className="items-center bg-gray-50 border border-gray-200 rounded-xl"
        style={{ paddingVertical: 10 }}
      >
        <Text className="text-sm font-bold text-gray-600">Đóng</Text>
      </Pressable>
    </View>
  );
});

/* ── 1 giao dịch = 1 card (thay cho 1 hàng <tr> ở bản gốc) ──────────── */
// [PERF] React.memo — danh sách này re-render mỗi khi StoragePage render vì
// lý do khác (vd mở lightbox); memo giúp các card không đổi props bỏ qua
// việc render lại.
const TransactionCard = React.memo(function TransactionCard({ tx, isLast, onViewImage }) {
  const ing = tx.ingredientId;
  const user = tx.createdBy;
  const imp = tx.type === "IMPORT";

  return (
    <View
      style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.gray[50] }}
      className="px-4 py-3.5"
    >
      <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
        <Text className="text-[11px] text-gray-400 font-mono">{fmt.date(tx.createdAt)}</Text>
        <View className={`px-2 py-0.5 rounded-full ${imp ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
          <Text className={`text-[11px] font-bold ${imp ? "text-green-600" : "text-amber-600"}`}>
            {imp ? "↑ Nhập" : "↓ Hư hỏng"}
          </Text>
        </View>
      </View>

      <Text className="text-sm font-bold text-gray-800 mt-1.5" numberOfLines={1}>
        {ing?.ingredientName || "—"}
      </Text>
      {!!ing?.smallUnit && (
        <Text className="text-[11px] text-gray-400 mt-0.5">
          {ing.smallUnit} / {ing.largeUnit}
        </Text>
      )}

      <View className="flex-row items-center justify-between mt-2">
        <Text className={`text-sm font-bold font-mono ${imp ? "text-green-600" : "text-amber-600"}`}>
          {imp ? "+" : "−"}
          {fmt.num(tx.quantity)}{" "}
          <Text className="text-[11px] font-normal">{ing?.smallUnit}</Text>
        </Text>
        <Text className="text-[13px] font-semibold text-gray-600 font-mono">{fmt.money(tx.amount)}</Text>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-xs text-gray-500 flex-1" numberOfLines={1}>
          {user?.name || user?.email || "—"}
        </Text>
        {!!tx.invoiceImage && (
          <Pressable
            onPress={() => onViewImage(tx.invoiceImage)}
            className="flex-row items-center bg-white border border-gray-200 rounded-lg"
            style={{ gap: 4, paddingHorizontal: 10, paddingVertical: 5 }}
          >
            <Text className="text-xs font-bold text-gray-600">🖼️ Xem</Text>
          </Pressable>
        )}
      </View>

      {!!tx.note && (
        <Text className="text-xs text-gray-400 mt-2" numberOfLines={2}>
          Ghi chú: {tx.note}
        </Text>
      )}
    </View>
  );
});

/* ── Modal Nhập kho ──────────────────────────────────────────────────── */
const EMPTY_IMPORT = { ingredientId: "", quantity: "", note: "" };

function ImportModal({ open, onClose, onSuccess, ingredients }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_IMPORT);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("form"); // "form" | "picker"

  // [PERF] Thay cho loading/error thủ công + gọi lại onSuccess()->load(1):
  // mutation tự quản trạng thái loading/error, và khi thành công chỉ cần
  // invalidate cache của danh sách giao dịch để nó tự tải lại.
  const importMutation = useMutation({
    mutationFn: uploadInvoiceImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredient-transactions"] });
      onSuccess?.();
      onClose();
    },
  });

  const ing = ingredients.find((i) => i._id === form.ingredientId);

  // amount = qty / ing.quantity(tồn kho) * ing.pricePerLargeUnit [GIU-NGUYEN]
  // Công thức tạm tính y hệt bản gốc — điều chỉnh theo schema thực tế nếu
  // backend sau này có smallUnitPerLargeUnit riêng.
  const amount = (() => {
    if (!ing || !form.quantity) return 0;
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty <= 0) return 0;
    if (!ing.quantity || ing.quantity <= 0 || !ing.pricePerLargeUnit) return 0;
    return Math.round((qty / ing.quantity) * ing.pricePerLargeUnit);
  })();

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_IMPORT);
      setFile(null);
      setPreview(null);
      setError("");
      setMode("form");
      importMutation.reset(); // xoá lỗi/trạng thái mutation lần mở trước
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickImage = async () => {
    setError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Cần cấp quyền truy cập thư viện ảnh để tải hóa đơn");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], // API mới của expo-image-picker (MediaTypeOptions đã bị loại bỏ)
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
    setFile({ uri: asset.uri, name: asset.fileName || `invoice_${Date.now()}.${ext}`, type: asset.mimeType || `image/${ext}` });
    setPreview(asset.uri);
  };

  const submit = async () => {
    setError("");
    if (!form.ingredientId) return setError("Vui lòng chọn nguyên liệu");
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) return setError("Số lượng phải lớn hơn 0");
    try {
      const fd = new FormData();
      fd.append("ingredientId", form.ingredientId);
      fd.append("quantity", qty);
      fd.append("amount", amount);
      fd.append("note", form.note);
      if (file) fd.append("invoiceImage", file);
      await importMutation.mutateAsync(fd);
    } catch (e) {
      setError(e.message || "Đã có lỗi xảy ra");
    }
  };

  if (!open) return null;
  const loading = importMutation.isPending;

  return (
    <ModalOverlay onClose={onClose}>
      <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "88%" }}>
        {/* [FIX-SCROLL] flex:1 để ScrollView thực sự bị giới hạn chiều cao
            (chứ không tự co theo nội dung) và stickyHeaderIndices để tiêu
            đề vẫn nằm trong vùng kéo-cuộn được — xem ghi chú đầu file. */}
        <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[0]} keyboardShouldPersistTaps="handled">
          <View className="bg-white px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100">
            <Text className="text-base font-black text-green-900">
              {mode === "picker" ? "Chọn nguyên liệu" : "Nhập kho"}
            </Text>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
              <Text className="text-gray-400 text-base">✕</Text>
            </Pressable>
          </View>

          <View style={{ padding: 20, gap: 14 }}>
            {mode === "picker" ? (
              <IngredientPickerBody
                ingredients={ingredients}
                selectedId={form.ingredientId}
                onPick={(id) => {
                  setForm((f) => ({ ...f, ingredientId: id }));
                  setMode("form");
                }}
                onCancel={() => setMode("form")}
              />
            ) : (
              <>
                {!!error && (
                  <View className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                    <Text className="text-red-600 text-[13px]">{error}</Text>
                  </View>
                )}

                <View style={{ gap: 5 }}>
                  <Text className="text-xs font-bold text-gray-600" style={{ letterSpacing: 0.3 }}>
                    Nguyên liệu <Text className="text-red-500">*</Text>
                  </Text>
                  <Pressable
                    onPress={() => setMode("picker")}
                    className="bg-[#FAFBFC] border border-gray-200 rounded-xl"
                    style={{ paddingHorizontal: 14, paddingVertical: 12 }}
                  >
                    <Text className={ing ? "text-sm text-gray-800" : "text-sm text-gray-300"}>
                      {ing ? ing.ingredientName : "Gõ tên nguyên liệu cần nhập..."}
                    </Text>
                  </Pressable>
                </View>

                {!!ing && (
                  <View className="bg-gray-50 border border-gray-200 rounded-lg flex-row flex-wrap" style={{ gap: 14, paddingHorizontal: 13, paddingVertical: 10 }}>
                    <Text className="text-[12.5px] text-gray-600">
                      Tồn kho: <Text className="font-bold text-gray-800">{fmt.num(ing.quantity)} {ing.smallUnit}</Text>
                    </Text>
                    <Text className="text-[12.5px] text-gray-600">
                      Đơn vị lớn: <Text className="font-bold text-gray-800">{ing.largeUnit}</Text>
                    </Text>
                    <Text className="text-[12.5px] text-gray-600">
                      Giá/{ing.largeUnit}: <Text className="font-bold text-gray-800">{fmt.money(ing.pricePerLargeUnit)}</Text>
                    </Text>
                  </View>
                )}

                <View style={{ gap: 5 }}>
                  <Text className="text-xs font-bold text-gray-600" style={{ letterSpacing: 0.3 }}>
                    Số lượng ({ing?.smallUnit || "đơn vị"}) <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    value={form.quantity}
                    onChangeText={(t) => setForm((f) => ({ ...f, quantity: t }))}
                    placeholder="Nhập số lượng..."
                    placeholderTextColor={colors.gray[300]}
                    keyboardType="decimal-pad"
                    className="border border-gray-200 rounded-xl text-sm text-gray-800"
                    style={{ paddingHorizontal: 14, paddingVertical: 11 }}
                  />
                </View>

                {amount > 0 && (
                  <View className="bg-emerald-50 border border-emerald-200 rounded-lg" style={{ paddingHorizontal: 14, paddingVertical: 11 }}>
                    <Text className="text-emerald-700 font-bold font-mono text-sm">Thành tiền ≈ {fmt.money(amount)}</Text>
                  </View>
                )}

                <View style={{ gap: 5 }}>
                  <Text className="text-xs font-bold text-gray-600" style={{ letterSpacing: 0.3 }}>Ảnh hóa đơn</Text>
                  <Pressable
                    onPress={pickImage}
                    className="border border-dashed border-gray-300 rounded-xl items-center justify-center bg-[#FAFBFC]"
                    style={{ padding: 18, minHeight: 90 }}
                  >
                    {preview ? (
                      <Image source={{ uri: preview }} style={{ width: "100%", height: 120, borderRadius: 8 }} resizeMode="cover" />
                    ) : (
                      <Text className="text-[13px] text-gray-400 font-medium">📷 Chạm để tải ảnh hóa đơn</Text>
                    )}
                  </Pressable>
                </View>

                <View style={{ gap: 5 }}>
                  <Text className="text-xs font-bold text-gray-600" style={{ letterSpacing: 0.3 }}>Ghi chú</Text>
                  <TextInput
                    value={form.note}
                    onChangeText={(t) => setForm((f) => ({ ...f, note: t }))}
                    placeholder="Ghi chú thêm (không bắt buộc)..."
                    placeholderTextColor={colors.gray[300]}
                    multiline
                    className="border border-gray-200 rounded-xl text-sm text-gray-800"
                    style={{ paddingHorizontal: 14, paddingVertical: 11, minHeight: 72, textAlignVertical: "top" }}
                  />
                </View>

                {/* [FIX-SCROLL-3] Nút hành động giờ là phần tử cuối cùng
                    BÊN TRONG cùng ScrollView với phần còn lại của modal
                    (trước đây tách riêng, cố định ngoài ScrollView) — để
                    kéo bắt đầu từ chính vùng nút cũng cuộn được nội dung,
                    đúng yêu cầu "lướt được bất kể lướt từ điểm nào trên
                    modal". Đổi lại: trên form dài + màn hình nhỏ, có thể
                    cần cuộn xuống cuối mới thấy nút — nếu muốn nút luôn cố
                    định hiển thị thay vì cuộn theo, nói mình biết để đổi lại. */}
                <View className="flex-row justify-end border-t border-gray-100" style={{ gap: 10, paddingTop: 14 }}>
                  <Pressable onPress={onClose} disabled={loading} className="bg-gray-50 border border-gray-200 rounded-xl" style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text className="text-sm font-bold text-gray-600">Hủy</Text>
                  </Pressable>
                  <Pressable
                    onPress={submit}
                    disabled={loading}
                    style={{ opacity: loading ? 0.6 : 1, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
                    className="bg-blue-600 rounded-xl"
                  >
                    {loading && <ActivityIndicator size="small" color={colors.white} />}
                    <Text className="text-sm font-bold text-white">{loading ? "Đang lưu..." : "Xác nhận nhập kho"}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ModalOverlay>
  );
}

/* ── Modal Ghi nhận nguyên liệu hư hỏng ─────────────────────────────── */
const EMPTY_EXPORT = { ingredientId: "", quantity: "", reason: "", customNote: "" };

function ExportModal({ open, onClose, onSuccess, ingredients }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_EXPORT);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState("form");

  const exportMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await txService.exportStock(payload);
      if (!res.success) throw new Error(res.message || "Đã có lỗi xảy ra");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredient-transactions"] });
      onSuccess?.();
      onClose();
    },
  });

  const ing = ingredients.find((i) => i._id === form.ingredientId);
  const isOther = form.reason === "Khác";
  const finalNote = isOther ? form.customNote : form.reason;

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_EXPORT);
      setError("");
      setConfirmed(false);
      setMode("form");
      exportMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // [GIU-NGUYEN] validate y hệt bản gốc
  const validate = () => {
    if (!form.ingredientId) return "Vui lòng chọn nguyên liệu";
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) return "Số lượng phải lớn hơn 0";
    if (ing && qty > ing.quantity) return `Tồn kho không đủ — hiện có ${fmt.num(ing.quantity)} ${ing.smallUnit}`;
    if (!form.reason) return "Vui lòng chọn lý do hư hỏng";
    if (isOther && !form.customNote.trim()) return "Vui lòng nhập lý do cụ thể";
    return null;
  };

  // [GIU-NGUYEN] luồng xác nhận 2 bước y hệt bản gốc
  const submit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      setConfirmed(false);
      return;
    }
    setError("");
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    try {
      await exportMutation.mutateAsync({
        ingredientId: form.ingredientId,
        quantity: parseFloat(form.quantity),
        note: finalNote,
      });
    } catch (e) {
      setError(e.message || "Đã có lỗi xảy ra");
      setConfirmed(false);
    }
  };

  if (!open) return null;
  const loading = exportMutation.isPending;

  return (
    <ModalOverlay onClose={onClose} maxWidth={480}>
      <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "88%" }}>
        {/* [FIX-SCROLL] xem ghi chú đầu file */}
        <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[0]} keyboardShouldPersistTaps="handled">
          <View className="bg-white px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100">
            <Text className="text-base font-black text-green-900">
              {mode === "picker" ? "Chọn nguyên liệu" : "Ghi nhận nguyên liệu hư hỏng"}
            </Text>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center">
              <Text className="text-gray-400 text-base">✕</Text>
            </Pressable>
          </View>

          <View style={{ padding: 20, gap: 14 }}>
            {mode === "picker" ? (
              <IngredientPickerBody
                ingredients={ingredients}
                selectedId={form.ingredientId}
                onPick={(id) => {
                  setForm((f) => ({ ...f, ingredientId: id }));
                  setConfirmed(false);
                  setMode("form");
                }}
                onCancel={() => setMode("form")}
              />
            ) : (
              <>
                {!!error && (
                  <View className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                    <Text className="text-red-600 text-[13px]">{error}</Text>
                  </View>
                )}
                {confirmed && !error && (
                  <View className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                    <Text className="text-amber-700 text-[13px]" style={{ lineHeight: 19 }}>
                      Xác nhận ghi nhận <Text className="font-black">{form.quantity} {ing?.smallUnit}</Text> hư hỏng của{" "}
                      <Text className="font-black">{ing?.ingredientName}</Text>? Nhấn "Xác nhận ghi nhận" lần nữa để hoàn tất.
                    </Text>
                  </View>
                )}

                <View style={{ gap: 5 }}>
                  <Text className="text-xs font-bold text-gray-600" style={{ letterSpacing: 0.3 }}>
                    Nguyên liệu <Text className="text-red-500">*</Text>
                  </Text>
                  <Pressable
                    onPress={() => setMode("picker")}
                    className="bg-[#FAFBFC] border border-gray-200 rounded-xl"
                    style={{ paddingHorizontal: 14, paddingVertical: 12 }}
                  >
                    <Text className={ing ? "text-sm text-gray-800" : "text-sm text-gray-300"}>
                      {ing ? `${ing.ingredientName} (${ing.smallUnit})` : "— Chọn nguyên liệu —"}
                    </Text>
                  </Pressable>
                </View>

                {!!ing && (
                  <View className="bg-gray-50 border border-gray-200 rounded-lg flex-row flex-wrap" style={{ gap: 14, paddingHorizontal: 13, paddingVertical: 10 }}>
                    <Text className="text-[12.5px] text-gray-600">
                      Tồn kho:{" "}
                      <Text className="font-bold" style={{ color: ing.quantity <= 0 ? colors.red[600] : colors.green[600] }}>
                        {fmt.num(ing.quantity)} {ing.smallUnit}
                      </Text>
                    </Text>
                    <Text className="text-[12.5px] text-gray-600">
                      Đơn vị lớn: <Text className="font-bold text-gray-800">{ing.largeUnit}</Text>
                    </Text>
                  </View>
                )}

                <View style={{ gap: 5 }}>
                  <Text className="text-xs font-bold text-gray-600" style={{ letterSpacing: 0.3 }}>
                    Số lượng ({ing?.smallUnit || "đơn vị"}) <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    value={form.quantity}
                    onChangeText={(t) => { setForm((f) => ({ ...f, quantity: t })); setConfirmed(false); }}
                    placeholder="Nhập số lượng hư hỏng..."
                    placeholderTextColor={colors.gray[300]}
                    keyboardType="decimal-pad"
                    className="border border-gray-200 rounded-xl text-sm text-gray-800"
                    style={{ paddingHorizontal: 14, paddingVertical: 11 }}
                  />
                </View>

                <View style={{ gap: 5 }}>
                  <Text className="text-xs font-bold text-gray-600" style={{ letterSpacing: 0.3 }}>
                    Lý do hư hỏng <Text className="text-red-500">*</Text>
                  </Text>
                  <View style={{ gap: 6 }}>
                    {DAMAGE_REASONS.map((value) => {
                      const active = form.reason === value;
                      return (
                        <Pressable
                          key={value}
                          onPress={() => { setForm((f) => ({ ...f, reason: value, customNote: "" })); setConfirmed(false); }}
                          className={`flex-row items-center rounded-xl border ${active ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
                          style={{ gap: 10, paddingHorizontal: 13, paddingVertical: 10 }}
                        >
                          <View
                            style={{
                              width: 16, height: 16, borderRadius: 8, borderWidth: 2,
                              borderColor: active ? colors.amber[500] : colors.gray[300],
                              backgroundColor: active ? colors.amber[500] : "transparent",
                              alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white }} />}
                          </View>
                          <Text className={`text-[13.5px] ${active ? "font-bold text-amber-700" : "font-medium text-gray-600"}`}>{value}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {isOther && (
                  <View style={{ gap: 5 }}>
                    <Text className="text-xs font-bold text-gray-600" style={{ letterSpacing: 0.3 }}>
                      Lý do cụ thể <Text className="text-red-500">*</Text>
                    </Text>
                    <TextInput
                      value={form.customNote}
                      onChangeText={(t) => setForm((f) => ({ ...f, customNote: t }))}
                      placeholder="Nhập lý do hư hỏng..."
                      placeholderTextColor={colors.gray[300]}
                      multiline
                      className="border border-gray-200 rounded-xl text-sm text-gray-800"
                      style={{ paddingHorizontal: 14, paddingVertical: 11, minHeight: 72, textAlignVertical: "top" }}
                    />
                  </View>
                )}

                {/* [FIX-SCROLL-3] xem ghi chú ở ImportModal — nút hành động
                    giờ nằm trong cùng ScrollView thay vì cố định bên ngoài. */}
                <View className="flex-row justify-end border-t border-gray-100" style={{ gap: 10, paddingTop: 14 }}>
                  <Pressable onPress={onClose} disabled={loading} className="bg-gray-50 border border-gray-200 rounded-xl" style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text className="text-sm font-bold text-gray-600">Hủy</Text>
                  </Pressable>
                  <Pressable
                    onPress={submit}
                    disabled={loading}
                    style={{ opacity: loading ? 0.6 : 1, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
                    className="bg-red-600 rounded-xl"
                  >
                    {loading && <ActivityIndicator size="small" color={colors.white} />}
                    <Text className="text-sm font-bold text-white">
                      {loading ? "Đang xử lý..." : confirmed ? "Xác nhận ghi nhận" : "Ghi nhận hư hỏng"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </ModalOverlay>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function StoragePage() {
  // ─── Ingredients (dùng cho 2 modal) ──────────────────────────────────
  // Bản gốc chỉ đọc thẳng store, giả định danh sách nguyên liệu đã được
  // trang khác load sẵn. Trên RN, người dùng có thể mở thẳng màn "Quản lý
  // nhập/xuất" từ Drawer mà chưa từng ghé "Nguyên liệu" trước đó, nên chủ
  // động gọi getIngredients() ở đây, cùng cách IngredientsPage.js đã làm.
  const rawIngredients = useIngredientZustand((s) => s.ingredients);
  const getIngredients = useIngredientZustand((s) => s.getIngredients);
  const ingredients = Array.isArray(rawIngredients) ? rawIngredients : [];

  useEffect(() => {
    getIngredients();
  }, [getIngredients]);

  const [lightbox, setLightbox] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Mặc định lọc theo tháng hiện tại [GIU-NGUYEN]
  const [filters, setFilters] = useState(() => ({ search: "", type: "", ...currentMonthRange() }));
  const [debSearch, setDebSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(filters.search), 380);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Đổi bộ lọc/tìm kiếm luôn quay về trang 1 — giữ đúng hành vi bản gốc
  // (bản gốc gọi load(1) mỗi khi các dependency này đổi).
  useEffect(() => {
    setPage(1);
  }, [debSearch, filters.type, filters.fromDate, filters.toDate]);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 10,
      ...(debSearch ? { search: debSearch } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
      ...(filters.toDate ? { toDate: filters.toDate } : {}),
    }),
    [page, debSearch, filters.type, filters.fromDate, filters.toDate]
  );

  // [PERF] Thay cho rows/stats/pager/loading/error + hàm load() thủ công.
  const {
    data: txData,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey: ["ingredient-transactions", queryParams],
    queryFn: async () => {
      const res = await txService.list(queryParams);
      if (!res.success) throw new Error(res.message || "Không thể tải dữ liệu");
      // Không destructure trực tiếp — nếu backend đổi shape hoặc thiếu
      // field, destructure sẽ ra undefined và crash render ngay [GIU-NGUYEN]
      return res.data?.data || {};
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const rows = Array.isArray(txData?.transactions) ? txData.transactions : [];
  const pager = txData?.pagination || { page: 1, totalPages: 1, total: 0 };
  const stats = txData?.stats || { importCount: 0, importTotal: 0, exportCount: 0, exportTotal: 0 };
  const error = queryError?.message || "";

  // [PERF] callback ổn định (deps rỗng vì dùng setState dạng hàm) để các
  // component con đã memo (DateField) không nhận prop hàm mới mỗi render.
  const set = useCallback((key, val) => setFilters((f) => ({ ...f, [key]: val })), []);
  const reset = useCallback(() => setFilters({ search: "", type: "", ...currentMonthRange() }), []);
  const handleFromDateChange = useCallback((v) => set("fromDate", v), [set]);
  const handleToDateChange = useCallback((v) => set("toDate", v), [set]);
  const handleImportSuccess = useCallback(() => setPage(1), []);
  const handleExportSuccess = useCallback(() => setPage(1), []);

  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View>
          <Text className="text-2xl font-black text-green-900">Quản lý Kho Nguyên Liệu</Text>
          <View className="flex-row items-center flex-wrap mt-1" style={{ gap: 8 }}>
            <Text className="text-gray-500 text-sm">Theo dõi nhập kho, hao hụt và chi phí nguyên liệu</Text>
            <View className="bg-green-100 rounded-full" style={{ paddingHorizontal: 11, paddingVertical: 3 }}>
              <Text className="text-[11px] font-black text-green-800">
                📅 Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          <Pressable onPress={() => setShowImport(true)} className="bg-green-500 rounded-xl" style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
            <Text className="text-white text-sm font-bold">Nhập kho</Text>
          </Pressable>
          <Pressable onPress={() => setShowExport(true)} className="bg-white border border-gray-200 rounded-xl" style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
            <Text className="text-gray-600 text-sm font-bold">Nguyên liệu hư hỏng</Text>
          </Pressable>
        </View>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <StatCard icon={Package} label="Số lần nhập kho" value={fmt.num(stats.importCount)} sub="Trong khoảng thời gian đã lọc" color="green" />
          <StatCard icon={AlertTriangle} label="Số lần ghi nhận hư hỏng" value={fmt.num(stats.exportCount)} sub="Trong khoảng thời gian đã lọc" color="amber" />
          <StatCard icon={TrendingUp} label="Tổng giá trị nhập" value={fmt.money(stats.importTotal)} sub="Chi phí nhập hàng" color="blue" />
          <StatCard icon={Trash2} label="Tổng giá trị hao hụt" value={fmt.money(stats.exportTotal)} sub="Tính theo giá nhập" color="rose" />
        </View>

        {/* ── Filter ─────────────────────────────────────────────────── */}
        <View className="bg-white rounded-2xl border border-gray-100" style={{ padding: 16, gap: 12 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-gray-800">Bộ lọc</Text>
            <Pressable onPress={reset} className="bg-gray-50 border border-gray-200 rounded-lg" style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text className="text-xs font-bold text-gray-600">Đặt lại</Text>
            </Pressable>
          </View>

          <View style={{ gap: 5 }}>
            <Text className="text-[11px] font-bold text-gray-400" style={{ letterSpacing: 0.5 }}>TÌM NGUYÊN LIỆU</Text>
            <TextInput
              value={filters.search}
              onChangeText={(t) => set("search", t)}
              placeholder="Gõ tên nguyên liệu..."
              placeholderTextColor={colors.gray[300]}
              className="bg-[#FAFBFC] border border-gray-200 rounded-lg text-[13.5px] text-gray-800"
              style={{ paddingHorizontal: 12, paddingVertical: 9 }}
            />
          </View>

          <View style={{ gap: 5 }}>
            <Text className="text-[11px] font-bold text-gray-400" style={{ letterSpacing: 0.5 }}>LOẠI GIAO DỊCH</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {TYPE_TABS.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => set("type", t.key)}
                  className={`rounded-lg ${filters.type === t.key ? "bg-blue-600" : "bg-white border border-gray-200"}`}
                  style={{ paddingHorizontal: 13, paddingVertical: 8 }}
                >
                  <Text className={`text-xs font-bold ${filters.type === t.key ? "text-white" : "text-gray-600"}`}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            <DateField label="Từ ngày" value={filters.fromDate} onChange={handleFromDateChange} />
            <DateField label="Đến ngày" value={filters.toDate} onChange={handleToDateChange} />
          </View>
        </View>

        {/* ── Error ──────────────────────────────────────────────────── */}
        {!!error && (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        )}

        {/* ── Danh sách (thay <table>) ───────────────────────────────── */}
        <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <View className="flex-row items-center justify-between border-b border-gray-100" style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
            <Text className="text-sm font-bold text-gray-800">
              Lịch sử giao dịch{!isLoading && <Text className="text-xs text-gray-400 font-normal"> ({fmt.num(pager.total)} giao dịch)</Text>}
            </Text>
            {/* isFetching (không phải isLoading) — chỉ báo đang tải nền khi
                đổi trang/bộ lọc, trong lúc vẫn hiển thị dữ liệu cũ nhờ
                keepPreviousData [PERF] */}
            {isFetching && <ActivityIndicator size="small" color={colors.gray[400]} />}
          </View>

          {isLoading ? (
            <View className="items-center py-14" style={{ gap: 10 }}>
              <ActivityIndicator size="small" color={colors.gray[400]} />
              <Text className="text-[13px] text-gray-400">Đang tải dữ liệu...</Text>
            </View>
          ) : rows.length === 0 ? (
            <View className="items-center py-14 px-6">
              <Text style={{ fontSize: 34 }}>📋</Text>
              <Text className="text-sm font-bold text-gray-600 mt-2">Không có giao dịch nào</Text>
              <Text className="text-[13px] text-gray-400 mt-1">Thử thay đổi bộ lọc hoặc tạo giao dịch mới</Text>
            </View>
          ) : (
            rows.map((tx, i) => (
              <TransactionCard key={tx._id || i} tx={tx} isLast={i === rows.length - 1} onViewImage={setLightbox} />
            ))
          )}

          {/* ── Pagination (đổi từ dải số + "…" sang Trước/Sau, đúng
              quyết định đã áp dụng ở Customers.js) ──────────────────── */}
          {!isLoading && rows.length > 0 && pager.totalPages > 1 && (
            <View className="flex-row items-center justify-between border-t border-gray-100" style={{ paddingHorizontal: 16, paddingVertical: 13 }}>
              <Pressable
                onPress={() => setPage((p) => p - 1)}
                disabled={pager.page <= 1 || isFetching}
                style={{ opacity: pager.page <= 1 ? 0.4 : 1, paddingHorizontal: 12, paddingVertical: 7 }}
                className="bg-gray-50 border border-gray-200 rounded-lg"
              >
                <Text className="text-xs font-bold text-gray-600">← Trước</Text>
              </Pressable>
              <Text className="text-[13px] font-bold text-gray-700">Trang {pager.page} / {pager.totalPages}</Text>
              <Pressable
                onPress={() => setPage((p) => p + 1)}
                disabled={pager.page >= pager.totalPages || isFetching}
                style={{ opacity: pager.page >= pager.totalPages ? 0.4 : 1, paddingHorizontal: 12, paddingVertical: 7 }}
                className="bg-gray-50 border border-gray-200 rounded-lg"
              >
                <Text className="text-xs font-bold text-gray-600">Sau →</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <ImportModal open={showImport} ingredients={ingredients} onClose={() => setShowImport(false)} onSuccess={handleImportSuccess} />
      <ExportModal open={showExport} ingredients={ingredients} onClose={() => setShowExport(false)} onSuccess={handleExportSuccess} />

      {/* ── Lightbox hoá đơn ─────────────────────────────────────────── */}
      {!!lightbox && (
        <Modal transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
          <Pressable
            onPress={() => setLightbox(null)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 16 }}
          >
            <Image source={{ uri: lightbox }} style={{ width: "100%", height: "80%", borderRadius: 12 }} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}
    </View>
  );
}