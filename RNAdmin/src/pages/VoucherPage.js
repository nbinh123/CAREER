import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    FlatList,
    Pressable,
    TextInput,
    Modal,
    ActivityIndicator,
    Switch,
    Platform,
    useWindowDimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Plus,
    Search,
    X,
    Eye,
    Pencil,
    Power,
    Ticket,
    CheckCircle2,
    Hourglass,
    Ban,
    DollarSign,
    BarChart3,
    AlertTriangle,
    ChevronRight,
    Check,
} from "lucide-react-native";
import StatCard from "../components/StatCard";
import fmtVND from "../utils/fmtVND";
import { getData, postData, putData } from "../utils/callAPI";
import useFoodZustand from "../zustand/useFoodZustand";
import colors from "../theme/tokens";

/* ════════════════════════════════════════════════════════════
   CONSTANTS [GIU-NGUYEN] — copy y hệt bản gốc, thuần JS/dữ liệu
════════════════════════════════════════════════════════════ */
const RANGE_OPTIONS = [
    { value: "all", label: "Toàn thời gian" },
    { value: "today", label: "Hôm nay" },
    { value: "7d", label: "7 ngày" },
    { value: "30d", label: "30 ngày" },
];

const STATUS_META = {
    ACTIVE: { label: "Đang hoạt động", color: "bg-green-100 text-green-700" },
    SCHEDULED: { label: "Sắp diễn ra", color: "bg-blue-100 text-blue-700" },
    EXPIRING_SOON: { label: "Sắp hết hạn", color: "bg-amber-100 text-amber-700" },
    EXPIRED: { label: "Đã hết hạn", color: "bg-rose-100 text-rose-700" },
    DISABLED: { label: "Đã tắt", color: "bg-gray-100 text-gray-500" },
};

const getStatusMeta = (status) => STATUS_META[status] || STATUS_META.DISABLED;

const STATUS_FILTERS = [
    { value: "ALL", label: "Tất cả" },
    { value: "ACTIVE", label: "Đang hoạt động" },
    { value: "SCHEDULED", label: "Sắp diễn ra" },
    { value: "EXPIRING_SOON", label: "Sắp hết hạn" },
    { value: "EXPIRED", label: "Đã hết hạn" },
    { value: "DISABLED", label: "Đã tắt" },
];

const CHANNEL_OPTIONS = [
    { value: "DINE_IN", label: "Tại bàn" },
    { value: "ONLINE", label: "Đặt online" },
];

const DISCOUNT_TYPE_OPTIONS = [
    { value: "PERCENTAGE", label: "Phần trăm (%)" },
    { value: "FIXED", label: "Số tiền cố định (VNĐ)" },
];

const emptyForm = {
    name: "",
    code: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    maxDiscountAmount: "",
    minOrderValue: "",
    applicableChannels: [], // rỗng = mọi kênh
    applicableCategoryIds: [], // rỗng = mọi danh mục — chọn từ useFoodZustand
    applicableFoodIds: [], // rỗng = mọi món — chọn từ useFoodZustand
    applicableCustomerIdsRaw: "",
    startDate: "",
    endDate: "",
    usageLimit: "",
    usageLimitPerCustomer: "1",
    isActive: true,
};

const splitCsv = (raw) =>
    (raw || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

// Trả về "" thay vì crash / "Invalid Date" khi ngày thiếu hoặc sai định dạng.
const toDateInputValue = (isoOrDate) => {
    if (!isoOrDate) return "";
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
};

// Format ngày an toàn cho hiển thị — không throw, không in "Invalid Date".
const formatDateVN = (isoOrDate, options = { day: "2-digit", month: "2-digit" }) => {
    if (!isoOrDate) return "—";
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("vi-VN", options);
};

// Dùng getFullYear/getMonth/getDate (giờ local) thay vì toISOString() khi
// đọc giá trị từ DateTimePicker — toISOString() quy đổi sang UTC, có thể
// lùi 1 ngày ở múi giờ VN (+7), đúng cách StoragePage.js đã xử lý.
const pad2 = (n) => String(n).padStart(2, "0");
const toISODateLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Dựng object `form` từ 1 voucher có sẵn (khi mở form SỬA). Tách thành hàm
// thuần ở module scope để VoucherFormModal dùng làm lazy initializer cho
// useState — component con được mount MỚI mỗi lần mở form nên không cần
// useEffect đồng bộ lại, không có nguy cơ "nháy" giá trị rỗng.
const buildFormFromVoucher = (voucher) => ({
    name: voucher.name || "",
    code: voucher.code || "",
    description: voucher.description || "",
    discountType: voucher.discountType || "PERCENTAGE",
    discountValue: String(voucher.discountValue ?? ""),
    maxDiscountAmount: voucher.maxDiscountAmount != null ? String(voucher.maxDiscountAmount) : "",
    minOrderValue: voucher.minOrderValue != null ? String(voucher.minOrderValue) : "",
    applicableChannels: Array.isArray(voucher.applicableChannels) ? voucher.applicableChannels : [],
    applicableCategoryIds: Array.isArray(voucher.applicableCategoryIds) ? voucher.applicableCategoryIds : [],
    applicableFoodIds: Array.isArray(voucher.applicableFoodIds) ? voucher.applicableFoodIds : [],
    applicableCustomerIdsRaw: (voucher.applicableCustomerIds || []).join(", "),
    startDate: toDateInputValue(voucher.startDate),
    endDate: toDateInputValue(voucher.endDate),
    usageLimit: voucher.usageLimit != null ? String(voucher.usageLimit) : "",
    usageLimitPerCustomer: String(voucher.usageLimitPerCustomer ?? "1"),
    isActive: !!voucher.isActive,
});

/* ════════════════════════════════════════════════════════════
   REACT-QUERY: query functions thuần
   Đặt ở module scope, không phụ thuộc bất kỳ closure nào của
   component — chỉ nhận giá trị qua queryKey. Nhờ vậy react-query
   tự quản lý cache/dedupe theo key, không cần workaround giữ
   closure ổn định (searchRef/statsRangeRef của bản trước đã bỏ).
════════════════════════════════════════════════════════════ */
const fetchVoucherStats = async ({ queryKey }) => {
    const [, range] = queryKey;
    const rangeParam = range === "all" ? "" : `?range=${range}`;
    try {
        const res = await getData({ url: `/vouchers/stats${rangeParam}` });
        const data = res?.data?.data;
        return data && typeof data === "object" ? data : {};
    } catch (err) {
        console.error("Failed to fetch voucher stats:", err);
        throw err; // để react-query đánh dấu isError, tự retry theo defaultOptions của queryClient
    }
};

const fetchVouchersList = async ({ queryKey }) => {
    const [, searchTerm] = queryKey;
    const q = (searchTerm || "").trim();
    const query = q ? `?search=${encodeURIComponent(q)}` : "";
    try {
        const res = await getData({ url: `/vouchers${query}` });
        // Chấp nhận cả 2 dạng: res.data là mảng trực tiếp, HOẶC res.data.data
        // là mảng (bọc trong {success,data}) — xem ghi chú ở bản gốc.
        return Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.data?.data)
                ? res.data.data
                : [];
    } catch (err) {
        console.error("Failed to fetch vouchers:", err);
        throw err;
    }
};

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ (không có Button/Modal/FormInput dùng chung
   nào để tái sử dụng — dựng riêng trong file này, cùng cách các
   trang khác trong dự án đã làm)

   Ghi chú tối ưu: các component thuần "presentational" (chỉ nhận
   props và render) được bọc React.memo để tránh re-render dây
   chuyền khi VoucherPage re-render vì lý do khác (gõ search, mở
   modal...). ModalOverlay / PickerBody KHÔNG memo vì luôn chỉ có
   1 instance sống tại 1 thời điểm — memo không mang lại lợi ích
   thực tế ở đây.
════════════════════════════════════════════════════════════ */

/* Overlay dùng chung cho mọi modal.

   ❗ ĐÃ VÁ (nguyên nhân gốc của lỗi "vuốt không cuộn được"): bản trước dùng
   Pressable NGOÀI bọc Pressable TRONG để mô phỏng e.stopPropagation() bên
   web (Pressable trong onPress={() => {}} — no-op, chỉ để chặn tap lọt
   xuống backdrop). Vấn đề: Pressable trong giành JS responder NGAY LÚC
   NGÓN TAY CHẠM XUỐNG (để phân biệt được tap/không-tap) — trong khi
   ScrollView bên trong `children` cuộn bằng gesture recognizer NATIVE
   (UIScrollView/native scroll), không đàm phán xin lại responder qua JS
   responder system theo cách Pressable/PanResponder vẫn làm. Kết quả:
   Pressable trong giữ nguyên responder suốt cử chỉ vuốt, ScrollView không
   bao giờ nhận được sự kiện move để cuộn — dù vuốt bắt đầu ở BẤT KỲ đâu
   trong nội dung modal. Đây là nguyên nhân thật sự đứng sau hiện tượng
   "modal có chỗ cuộn được chỗ không", đã xác nhận và sửa cùng lỗi này ở
   MenuPage.js/OrdersPage.js/CustomersPage.js.

   Cách sửa: bỏ hẳn kiểu lồng cha-con, thay bằng 2 LỚP ANH EM (sibling) xếp
   chồng theo thứ tự JSX — lớp dưới (Pressable, phủ tuyệt đối) chỉ lo
   nền + tap-outside-to-close; lớp trên (View thường, KHÔNG có touch
   handler riêng) chỉ chứa nội dung. Nhờ 2 lớp KHÔNG lồng cha-con, RN hit-
   test theo đúng lớp trên cùng tại điểm chạm — vuốt vào vùng nội dung
   trúng thẳng View nội dung (và ScrollView bên trong nó), không hề đi
   qua Pressable nền, nên không còn tranh chấp responder nào cả; vuốt ra
   ngoài vùng nội dung mới trúng Pressable nền để đóng modal như cũ. */
function ModalOverlay({ onClose, maxWidth = 460, children }) {
    return (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
                <Pressable
                    onPress={onClose}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(20,83,45,0.35)",
                    }}
                />
                <View style={{ width: "100%", maxWidth }}>
                    {children}
                </View>
            </View>
        </Modal>
    );
}

// Hoist ra module scope thay vì tạo lại mỗi lần IconBtn render — không phải
// fix re-render (IconBtn đã memo, chỉ render khi props đổi) mà là giảm việc
// thừa BÊN TRONG 1 lần render hợp lệ.
const ICON_BTN_TONES = {
    neutral: { box: "bg-gray-50", color: colors.gray[500] },
    danger: { box: "bg-red-50", color: colors.red[600] },
    // "Sắp tắt" — thay cho hover:bg-rose-50 bên web, xem ghi chú platform.
    rose: { box: "bg-rose-50", color: "#e11d48" },
    // "Sắp bật" — thay cho hover:bg-green-50 bên web.
    success: { box: "bg-green-50", color: colors.green[600] },
};

const IconBtn = React.memo(function IconBtn({ icon: Icon, onPress, tone = "neutral" }) {
    const t = ICON_BTN_TONES[tone] ?? ICON_BTN_TONES.neutral;
    return (
        <Pressable onPress={onPress} className={`w-8 h-8 rounded-lg items-center justify-center ${t.box}`}>
            <Icon size={15} color={t.color} />
        </Pressable>
    );
});

/* Nhãn + (tuỳ chọn) lỗi bên dưới — bọc mọi loại field trong form, kể cả
   field không phải TextInput (segmented/checkbox/date/picker). */
const FieldWrap = React.memo(function FieldWrap({ label, error, children }) {
    return (
        <View style={{ marginBottom: 14 }}>
            <Text className="text-xs font-semibold text-gray-500 mb-1.5">{label}</Text>
            {children}
            {!!error && <Text className="text-rose-600 text-xs mt-1">{error}</Text>}
        </View>
    );
});

const FieldInput = React.memo(function FieldInput({ label, error, value, onChangeText, keyboardType = "default", multiline, full, placeholder }) {
    return (
        <View className={full ? "w-full" : "w-[47%]"} style={{ marginBottom: 14 }}>
            <Text className="text-xs font-semibold text-gray-500 mb-1.5">{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                multiline={multiline}
                placeholder={placeholder}
                placeholderTextColor={colors.gray[300]}
                className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800"
                style={multiline ? { minHeight: 64, textAlignVertical: "top" } : undefined}
            />
            {!!error && <Text className="text-rose-600 text-xs mt-1">{error}</Text>}
        </View>
    );
});

/* Ô vuông tự vẽ thay <input type="checkbox"> — dùng cho kênh áp dụng và
   từng dòng trong PickerBody bên dưới. */
const CheckBox = React.memo(function CheckBox({ checked }) {
    return (
        <View
            className={`items-center justify-center rounded-md ${checked ? "bg-green-600" : "bg-white border border-gray-300"}`}
            style={{ width: 18, height: 18 }}
        >
            {checked && <Check size={12} color={colors.white} />}
        </View>
    );
});

/* Ô chọn ngày, thay <input type="date"> — copy nguyên cách StoragePage.js
   đã dựng (Platform-specific behavior cho Android/iOS).

   ❗ ĐÃ VÁ: bọc React.memo. Có 2 instance (Bắt đầu/Kết thúc) sống ĐỒNG THỜI
   trong form — trước đây KHÔNG memo nên mỗi keystroke ở field bất kỳ khác
   (tên, mã, mô tả...) đều khiến CẢ 2 DateField render lại dù value/onChange
   của chúng không đổi. */
const DateField = React.memo(function DateField({ label, value, onChange }) {
    const [show, setShow] = useState(false);
    const dateObj = value ? new Date(`${value}T00:00:00`) : new Date();

    const handleChange = (event, selected) => {
        if (Platform.OS === "android") {
            setShow(false);
            if (event.type === "set" && selected) onChange(toISODateLocal(selected));
            return;
        }
        // iOS: picker dạng spinner không tự đóng, cập nhật giá trị ngay khi
        // cuộn, đóng khi bấm "Xong" bên dưới.
        if (selected) onChange(toISODateLocal(selected));
    };

    return (
        <View style={{ flex: 1, minWidth: 150, gap: 5 }}>
            <Text className="text-xs font-semibold text-gray-500">{label}</Text>
            <Pressable
                onPress={() => setShow(true)}
                className="border border-gray-200 rounded-xl flex-row items-center justify-between"
                style={{ paddingHorizontal: 14, paddingVertical: 11 }}
            >
                <Text className="text-sm text-gray-800">
                    {value ? formatDateVN(value, { day: "2-digit", month: "2-digit", year: "numeric" }) : "Chọn ngày"}
                </Text>
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
                    className="items-center bg-green-600 rounded-lg"
                    style={{ paddingVertical: 8 }}
                >
                    <Text className="text-white text-xs font-bold">Xong</Text>
                </Pressable>
            )}
        </View>
    );
});

/* Danh sách chọn nhiều có ô tìm kiếm — thay cho SearchableMultiSelect
   (dropdown lơ lửng) bên web. Hiển thị ngay trong thân modal khi
   pickerMode được bật, thay vì dropdown tuyệt đối định vị — xem giải
   thích platform ở đầu file. */
function PickerBody({ options, selectedIds, onToggle, onDone, loading, emptyText }) {
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => (o.label || "").toLowerCase().includes(q));
    }, [options, query]);

    return (
        <View style={{ gap: 12 }}>
            <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Tìm kiếm..."
                placeholderTextColor={colors.gray[300]}
                className="bg-white border border-gray-200 rounded-xl text-sm text-gray-800"
                style={{ paddingHorizontal: 14, paddingVertical: 10 }}
            />
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                {loading ? (
                    <Text className="text-center text-gray-400 text-sm py-6">Đang tải...</Text>
                ) : filtered.length === 0 ? (
                    <Text className="text-center text-gray-400 text-sm py-6">
                        {query ? "Không tìm thấy lựa chọn phù hợp" : emptyText}
                    </Text>
                ) : (
                    filtered.map((o) => {
                        const active = selectedIds.includes(o.id);
                        return (
                            <Pressable
                                key={o.id}
                                onPress={() => onToggle(o.id)}
                                className={`flex-row items-center justify-between rounded-xl ${active ? "bg-green-50" : ""}`}
                                style={{ paddingHorizontal: 10, paddingVertical: 11 }}
                            >
                                <Text className="text-sm text-gray-800 flex-1 mr-3" numberOfLines={1}>
                                    {o.label}
                                </Text>
                                <CheckBox checked={active} />
                            </Pressable>
                        );
                    })
                )}
            </ScrollView>
            <Pressable onPress={onDone} className="items-center bg-green-600 rounded-xl" style={{ paddingVertical: 11 }}>
                <Text className="text-sm font-bold text-white">Xong</Text>
            </Pressable>
        </View>
    );
}

/* Nút mở picker (thay trigger của SearchableMultiSelect) */
const PickerTrigger = React.memo(function PickerTrigger({ count, placeholder, onPress }) {
    return (
        <Pressable
            onPress={onPress}
            className="flex-row items-center justify-between border border-gray-200 rounded-xl"
            style={{ paddingHorizontal: 14, paddingVertical: 11 }}
        >
            <Text className={`text-sm flex-1 mr-2 ${count ? "text-gray-700" : "text-gray-400"}`} numberOfLines={1}>
                {count ? `Đã chọn ${count}` : placeholder}
            </Text>
            <ChevronRight size={16} color={colors.gray[400]} />
        </Pressable>
    );
});

const Row = React.memo(function Row({ label, value }) {
    return (
        <View className="flex-row justify-between" style={{ gap: 12 }}>
            <Text className="text-gray-400 text-sm">{label}</Text>
            <Text className="text-gray-700 text-sm font-semibold text-right" style={{ flexShrink: 1 }}>
                {value}
            </Text>
        </View>
    );
});

/* Viền phân cách giữa các card — thay cho việc VoucherCard tự tính "có
   phải card cuối" (isLast). FlatList tự động KHÔNG render separator sau
   item cuối, nên renderItem không còn phải phụ thuộc độ dài danh sách
   nữa. */
const ItemSeparator = React.memo(function ItemSeparator() {
    return <View style={{ height: 1, backgroundColor: colors.gray[50] }} />;
});

/* Nhóm nút chọn "Loại giảm" — tách riêng + memo, chỉ phụ thuộc
   form.discountType. Trước đây viết inline trong form nên mỗi keystroke ở
   field KHÁC (tên, mã, mô tả...) vẫn khiến 2 nút này render lại vô ích. */
const DiscountTypeSelector = React.memo(function DiscountTypeSelector({ value, onChange }) {
    return (
        <View className="flex-row" style={{ gap: 8 }}>
            {DISCOUNT_TYPE_OPTIONS.map((opt) => (
                <Pressable
                    key={opt.value}
                    onPress={() => onChange(opt.value)}
                    className={`flex-1 items-center rounded-xl ${value === opt.value ? "bg-green-600" : "bg-white border border-gray-200"}`}
                    style={{ paddingVertical: 10 }}
                >
                    <Text className={`text-xs font-bold ${value === opt.value ? "text-white" : "text-gray-600"}`}>
                        {opt.label}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
});

/* Nhóm checkbox "Áp dụng cho kênh" — tương tự, chỉ phụ thuộc
   form.applicableChannels. */
const ChannelSelector = React.memo(function ChannelSelector({ selected, onToggle }) {
    return (
        <View className="flex-row" style={{ gap: 20 }}>
            {CHANNEL_OPTIONS.map((c) => (
                <Pressable key={c.value} onPress={() => onToggle(c.value)} className="flex-row items-center" style={{ gap: 7 }}>
                    <CheckBox checked={selected.includes(c.value)} />
                    <Text className="text-sm text-gray-600">{c.label}</Text>
                </Pressable>
            ))}
        </View>
    );
});

/* Hàng Switch "Kích hoạt ngay" — chỉ phụ thuộc form.isActive. */
const ActiveToggleRow = React.memo(function ActiveToggleRow({ value, onChange }) {
    return (
        <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
            <Text className="text-sm text-gray-600">Kích hoạt ngay</Text>
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: colors.gray[200], true: colors.green[400] }}
                thumbColor={colors.white}
            />
        </View>
    );
});

/* ❗ LỖ HỔNG ĐÃ VÁ: React.memo mặc định so sánh props theo REFERENCE.
   Mỗi lần refetch (sau khi tạo/sửa/bật-tắt BẤT KỲ voucher nào), react-query
   trả về 1 mảng HOÀN TOÀN MỚI gồm các object HOÀN TOÀN MỚI — kể cả những
   voucher không hề thay đổi giá trị (JSON.parse luôn tạo object mới). Nếu
   dùng React.memo mặc định, prop `voucher` luôn bị coi là "đổi" (reference
   khác) dù nội dung giống hệt → TOÀN BỘ card trong danh sách re-render lại
   mỗi khi CHỈ 1 voucher được bật/tắt, dù (N-1) card còn lại không đổi gì.
   Dùng comparator riêng (voucherCardPropsAreEqual) so theo GIÁ TRỊ các
   field thực sự được render, để chỉ đúng card có dữ liệu thay đổi mới
   re-render. */
function voucherCardPropsAreEqual(prevProps, nextProps) {
    if (
        prevProps.onView !== nextProps.onView ||
        prevProps.onEdit !== nextProps.onEdit ||
        prevProps.onToggleActive !== nextProps.onToggleActive
    ) {
        return false; // callback đổi identity → phải render lại
    }

    const a = prevProps.voucher;
    const b = nextProps.voucher;
    if (a === b) return true;
    if (!a || !b) return false;

    // Chỉ so sánh đúng những field VoucherCard thực sự render bên dưới —
    // sau này thêm field mới vào JSX thì nhớ thêm field đó vào đây.
    return (
        a._id === b._id &&
        a.status === b.status &&
        a.code === b.code &&
        a.name === b.name &&
        a.isActive === b.isActive &&
        a.discountType === b.discountType &&
        a.discountValue === b.discountValue &&
        a.minOrderValue === b.minOrderValue &&
        a.usedCount === b.usedCount &&
        a.usageLimit === b.usageLimit &&
        a.startDate === b.startDate &&
        a.endDate === b.endDate
    );
}

/* 1 voucher = 1 card (thay cho 1 hàng <tr> ở bản gốc). KHÔNG bớt field nào
   so với bảng 9 cột gốc — dòng 3 gộp "Loại giảm" + "Giá trị" lại vì cùng
   diễn đạt 1 ý ("Giảm 10%" / "Giảm 20.000₫"). Bọc React.memo vì đây là
   item của FlatList. */
const VoucherCard = React.memo(function VoucherCard({ voucher, onView, onEdit, onToggleActive }) {
    const meta = getStatusMeta(voucher.status);
    return (
        <View className="px-4 py-3.5">
            <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                        <Text className="text-sm font-black text-green-900">{voucher.code || "—"}</Text>
                        <View className={`px-2 py-0.5 rounded-full ${meta.color}`}>
                            <Text className={`text-[10px] font-bold ${meta.color}`}>{meta.label}</Text>
                        </View>
                    </View>
                    <Text className="text-sm text-gray-600 mt-0.5" numberOfLines={1}>
                        {voucher.name || "—"}
                    </Text>
                </View>
                <View className="flex-row" style={{ gap: 6 }}>
                    <IconBtn icon={Eye} onPress={() => onView(voucher)} />
                    <IconBtn icon={Pencil} onPress={() => onEdit(voucher)} />
                    <IconBtn icon={Power} tone={voucher.isActive ? "rose" : "success"} onPress={() => onToggleActive(voucher)} />
                </View>
            </View>

            <View className="flex-row flex-wrap items-center mt-2" style={{ gap: 12 }}>
                <Text className="text-xs text-gray-500">
                    {voucher.discountType === "PERCENTAGE"
                        ? `Giảm ${voucher.discountValue ?? 0}%`
                        : `Giảm ${fmtVND(voucher.discountValue)}`}
                </Text>
                <Text className="text-xs text-gray-500">
                    Tối thiểu: <Text className="font-semibold text-gray-700">{fmtVND(voucher.minOrderValue)}</Text>
                </Text>
            </View>

            <View className="flex-row items-center justify-between mt-2">
                <Text className="text-xs text-gray-500">
                    Đã dùng:{" "}
                    <Text className="font-semibold text-gray-700">
                        {voucher.usedCount ?? 0}
                        {voucher.usageLimit != null ? `/${voucher.usageLimit}` : ""}
                    </Text>
                </Text>
                <Text className="text-[11px] text-gray-400">
                    {formatDateVN(voucher.startDate)} – {formatDateVN(voucher.endDate)}
                </Text>
            </View>
        </View>
    );
}, voucherCardPropsAreEqual);

/* ── Các mảnh của header, tách theo đúng phạm vi state liên quan ────
   Tách riêng để mỗi phần chỉ re-render khi dữ liệu của chính nó đổi. */
const HeaderTop = React.memo(function HeaderTop({ todayLabel, onCreate }) {
    return (
        <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
            <View>
                <Text className="text-2xl font-black text-green-900">Quản lý Voucher</Text>
                <Text className="text-gray-500 text-sm mt-0.5">{todayLabel}</Text>
            </View>
            <Pressable
                onPress={onCreate}
                className="flex-row items-center gap-1.5 bg-green-600 rounded-xl"
                style={{ paddingHorizontal: 16, paddingVertical: 10 }}
            >
                <Plus size={16} color={colors.white} />
                <Text className="text-white text-sm font-bold">Tạo voucher</Text>
            </Pressable>
        </View>
    );
});

// Chỉ phụ thuộc dữ liệu THỐNG KÊ — không biết gì về statusFilter/search,
// nên bấm status filter hay gõ search không làm nó (và 6 StatCard bên
// trong) re-render.
//
// Ghi chú (chưa vá, mức độ thấp): prop `stats` cũng là object đến từ
// react-query, về lý thuyết có cùng lớp vấn đề với VoucherCard (object mới
// mỗi lần refetch dù giá trị không đổi). Không áp dụng comparator riêng ở
// đây vì 2 lý do: (1) chỉ có 6 phần tử cố định, không phải danh sách N
// phần tử như VoucherCard, chi phí re-render thấp hơn nhiều bậc; (2) React
// Native mặc định KHÔNG tự bật refetch-on-focus như web trừ khi project tự
// cấu hình AppState listener cho react-query — nên trong thực tế trường
// hợp "refetch nền trong lúc màn hình vẫn đang mở" khó xảy ra ở đây. Nếu
// sau này thấy 6 StatCard vẫn giật khi có polling/refetchInterval, áp dụng
// cùng kỹ thuật comparator như voucherCardPropsAreEqual ở trên.
const StatsSection = React.memo(function StatsSection({
    statsRange, onRangeChange, statsError, statsLoading, stats, rangeSubLabel,
}) {
    return (
        <View style={{ gap: 8 }}>
            <Text className="text-xs text-gray-500 font-semibold">Thống kê giảm giá:</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {RANGE_OPTIONS.map((opt) => (
                    <Pressable
                        key={opt.value}
                        onPress={() => onRangeChange(opt.value)}
                        className={`rounded-lg ${statsRange === opt.value ? "bg-green-600" : "bg-white border border-gray-100"}`}
                        style={{ paddingHorizontal: 12, paddingVertical: 6 }}
                    >
                        <Text className={`text-xs font-bold ${statsRange === opt.value ? "text-white" : "text-gray-500"}`}>
                            {opt.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
            {!!statsError && (
                <View className="flex-row items-center" style={{ gap: 5 }}>
                    <AlertTriangle size={13} color="#e11d48" />
                    <Text className="text-xs text-rose-600 font-semibold">{statsError}</Text>
                </View>
            )}
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                <StatCard icon={Ticket} label="Tổng voucher" value={statsLoading ? "…" : stats?.totalVouchers ?? 0} sub="Toàn bộ mã đang có" color="blue" />
                <StatCard icon={CheckCircle2} label="Đang hoạt động" value={statsLoading ? "…" : stats?.active ?? 0} sub="Khách có thể dùng ngay" color="green" />
                <StatCard icon={Hourglass} label="Sắp hết hạn" value={statsLoading ? "…" : stats?.expiringSoon ?? 0} sub="Còn ≤ 3 ngày" color="amber" />
                <StatCard icon={Ban} label="Đã hết hạn" value={statsLoading ? "…" : stats?.expired ?? 0} sub="Hết hạn hoặc đã tắt" color="rose" />
                <StatCard icon={DollarSign} label="Tổng tiền đã giảm" value={statsLoading ? "…" : fmtVND(stats?.totalDiscountAmount)} sub={rangeSubLabel} color="green" />
                <StatCard icon={BarChart3} label="Số lượt sử dụng" value={statsLoading ? "…" : stats?.totalUses ?? 0} sub={rangeSubLabel} color="blue" />
            </View>
        </View>
    );
});

// Đây là phần DUY NHẤT thực sự cần re-render khi bấm status filter — nhẹ
// (1 ô input + vài Pressable nhỏ), không kéo theo StatCard nào.
const ListToolbar = React.memo(function ListToolbar({
    search, onSearchChange, statusFilter, onStatusFilterChange, listError,
}) {
    return (
        <View className="bg-white rounded-2xl border border-gray-100" style={{ padding: 16, gap: 12 }}>
            <Text className="font-bold text-gray-700">Danh sách voucher</Text>

            <View style={{ position: "relative", justifyContent: "center" }}>
                <View style={{ position: "absolute", left: 13, zIndex: 1 }}>
                    <Search size={15} color={colors.gray[400]} />
                </View>
                <TextInput
                    value={search}
                    onChangeText={onSearchChange}
                    placeholder="Tìm theo mã voucher..."
                    placeholderTextColor={colors.gray[300]}
                    className="bg-white border border-gray-100 rounded-xl text-sm text-gray-800"
                    style={{ paddingLeft: 36, paddingRight: 14, paddingVertical: 10 }}
                />
            </View>

            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {STATUS_FILTERS.map((f) => (
                    <Pressable
                        key={f.value}
                        onPress={() => onStatusFilterChange(f.value)}
                        className={`rounded-lg ${statusFilter === f.value ? "bg-green-600" : "bg-green-50"}`}
                        style={{ paddingHorizontal: 12, paddingVertical: 6 }}
                    >
                        <Text className={`text-xs font-bold ${statusFilter === f.value ? "text-white" : "text-gray-500"}`}>
                            {f.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {!!listError && (
                <View className="flex-row items-center" style={{ gap: 5 }}>
                    <AlertTriangle size={13} color="#e11d48" />
                    <Text className="text-xs text-rose-600 font-semibold">{listError}</Text>
                </View>
            )}
        </View>
    );
});

/* ════════════════════════════════════════════════════════════
   VOUCHER DETAIL MODAL — tách khỏi VoucherPage + React.memo.

   `voucher` (= viewingVoucher ở component cha) là 1 SNAPSHOT cố định set
   1 lần khi bấm "Xem" — không bị react-query thay thế bằng object mới như
   trường hợp danh sách, nên KHÔNG cần comparator riêng, React.memo mặc
   định (so theo reference) đã đúng và đủ. Lợi ích: nếu VoucherPage
   re-render vì lý do khác (VD nền: 1 refetch xảy ra) trong lúc modal xem
   đang mở, modal này không phải tính toán lại.
════════════════════════════════════════════════════════════ */
const VoucherDetailModal = React.memo(function VoucherDetailModal({ voucher, onClose }) {
    return (
        <ModalOverlay onClose={onClose}>
            <View className="bg-white rounded-3xl" style={{ padding: 24, gap: 10 }}>
                <View className="flex-row items-center justify-between" style={{ marginBottom: 4 }}>
                    <Text className="font-black text-green-900 text-lg">{voucher.code || "—"}</Text>
                    <Pressable onPress={onClose} className="w-8 h-8 rounded-full items-center justify-center bg-gray-50">
                        <X size={18} color={colors.gray[400]} />
                    </Pressable>
                </View>
                <Row label="Tên" value={voucher.name || "—"} />
                <Row label="Mô tả" value={voucher.description || "—"} />
                <Row
                    label="Loại giảm"
                    value={
                        voucher.discountType === "PERCENTAGE"
                            ? `${voucher.discountValue ?? 0}%`
                            : fmtVND(voucher.discountValue)
                    }
                />
                <Row label="Giảm tối đa" value={voucher.maxDiscountAmount != null ? fmtVND(voucher.maxDiscountAmount) : "Không giới hạn"} />
                <Row label="Đơn tối thiểu" value={fmtVND(voucher.minOrderValue)} />
                <Row label="Kênh áp dụng" value={voucher.applicableChannels?.length ? voucher.applicableChannels.join(", ") : "Tất cả"} />
                <Row label="Lượt dùng" value={`${voucher.usedCount ?? 0}${voucher.usageLimit != null ? `/${voucher.usageLimit}` : " (không giới hạn)"}`} />
                <Row label="Mỗi khách" value={`${voucher.usageLimitPerCustomer ?? 1} lượt`} />
                <Row label="Thời gian" value={`${formatDateVN(voucher.startDate, {})} – ${formatDateVN(voucher.endDate, {})}`} />
                <Row label="Trạng thái" value={getStatusMeta(voucher.status).label} />
            </View>
        </ModalOverlay>
    );
});

/* ════════════════════════════════════════════════════════════
   VOUCHER FORM MODAL — tách khỏi VoucherPage + React.memo.

   ❗ LỖ HỔNG LỚN NHẤT ĐÃ VÁ: trước đây form/formErrors/pickerMode là state
   của CHÍNH VoucherPage — nghĩa là MỖI KEYSTROKE khi gõ form đều khiến
   TOÀN BỘ hàm VoucherPage chạy lại (dù React.memo đã chặn phần lớn re-
   render con, bản thân component cha vẫn phải re-chạy). Tách hẳn state
   này xuống đây: gõ form giờ CHỈ re-render component này, VoucherPage
   hoàn toàn đứng yên trong suốt lúc gõ.

   Được MOUNT MỚI mỗi lần mở form ({formOpen && <VoucherFormModal .../>}
   ở component cha) nên dùng lazy initializer cho state form — không nháy
   giá trị rỗng, không cần useEffect đồng bộ lại.

   Bọc thêm React.memo (dù chỉ có 1 instance tại 1 thời điểm): vì trong
   lúc form đang MỞ, VoucherPage vẫn có thể re-render vì lý do KHÔNG liên
   quan (VD: debounce search từ trước khi mở form vừa trigger 1 refetch
   nền) — khi đó, nếu props của VoucherFormModal (editingVoucher, onClose,
   onSaved, categoryOptions, foodPickerOptions, optionsLoading) không đổi,
   React.memo sẽ chặn được việc render lại vô ích.

   ❗ ĐÃ VÁ (lướt/cuộn) — nguyên nhân THẬT SỰ và cách sửa cuối cùng:
   Từng thử 2 hướng KHÔNG đúng gốc rễ trước khi tìm ra nguyên nhân thật:
   (1) đưa header vào ScrollView bằng stickyHeaderIndices — không ăn vì
   header dính bằng animated transform, không nằm trong luồng cử chỉ thật
   của ScrollView; (2) tự dựng vùng cuộn bằng react-native-gesture-handler
   + Reanimated, thay hẳn ScrollView — chạy được nhưng phức tạp không cần
   thiết. Nguyên nhân THẬT SỰ nằm ở `ModalOverlay` (component dùng chung,
   xem comment tại định nghĩa của nó phía trên): Pressable NGOÀI bọc
   Pressable TRONG giành JS responder ngay khi chạm xuống, khiến ScrollView
   bên trong — vốn cuộn bằng gesture recognizer NATIVE, không đàm phán
   responder theo kiểu JS — không bao giờ nhận được sự kiện move để cuộn,
   BẤT KỂ vuốt bắt đầu ở đâu trong nội dung modal. Đã sửa `ModalOverlay`
   (xem comment ở đó); nhờ vậy quay lại dùng ScrollView THƯỜNG, tiêu chuẩn,
   không cần bất kỳ mẹo nào nữa — miễn TOÀN BỘ nội dung modal (header, các
   field, thanh nút Huỷ/Lưu) đều nằm bên trong 1 ScrollView duy nhất (thay
   vì header/footer đứng ngoài làm sibling), vuốt ở bất kỳ đâu trong modal
   đều cuộn được, và tap vẫn hoạt động bình thường (đóng modal khi chạm
   ra ngoài, bấm được mọi nút bên trong). */
function VoucherFormModal({
    editingVoucher,
    onClose,
    onSaved,
    categoryOptions,
    foodPickerOptions,
    optionsLoading,
}) {
    // ❗ ĐÃ VÁ (2 lớp):
    // (1) "maxHeight: '88%'" trước đây không có cơ sở rõ ràng để resolve vì
    //     cả chuỗi View/Pressable cha trong ModalOverlay đều "co theo nội
    //     dung" (không có height cụ thể) — đổi sang useWindowDimensions()
    //     để có số pixel chắc chắn, không phụ thuộc parent.
    // (2) LỖI THẬT SỰ khiến mất trắng nội dung: ScrollView dùng "flex: 1"
    //     — flex:1 mặc định kéo theo flexBasis:0%, tức bắt đầu từ kích
    //     thước 0 rồi "lớn lên chiếm phần còn lại". Nhưng vì View cha chỉ
    //     có maxHeight (không phải height cố định), Yoga không có "phần
    //     còn lại" rõ ràng để tính lớn lên từ 0 → ScrollView bị kẹt ở kích
    //     thước 0. Đã đổi ScrollView sang "flexShrink: 1" (không dùng
    //     flex:1) — cách này để ScrollView bắt đầu từ kích thước NỘI DUNG
    //     THẬT của nó, và chỉ co lại khi không đủ chỗ. Đây mới là pattern
    //     đúng cho container chỉ giới hạn bằng maxHeight (không có height
    //     cố định).
    const { height: windowHeight } = useWindowDimensions();
    const modalMaxHeight = windowHeight * 0.88;

    const [form, setForm] = useState(() =>
        editingVoucher ? buildFormFromVoucher(editingVoucher) : emptyForm
    );
    const [formErrors, setFormErrors] = useState({});
    const [pickerMode, setPickerMode] = useState(null); // null | "categories" | "foods"

    const saveVoucherMutation = useMutation({
        mutationFn: async ({ id, payload }) =>
            id
                ? await putData({ url: `/vouchers/${id}`, data: payload })
                : await postData({ url: "/vouchers", data: payload }),
    });

    const toggleChannel = useCallback((channel) => {
        setForm((f) => ({
            ...f,
            applicableChannels: f.applicableChannels.includes(channel)
                ? f.applicableChannels.filter((c) => c !== channel)
                : [...f.applicableChannels, channel],
        }));
    }, []);

    const toggleCategoryId = useCallback((id) => {
        setForm((f) => ({
            ...f,
            applicableCategoryIds: f.applicableCategoryIds.includes(id)
                ? f.applicableCategoryIds.filter((c) => c !== id)
                : [...f.applicableCategoryIds, id],
        }));
    }, []);

    const toggleFoodId = useCallback((id) => {
        setForm((f) => ({
            ...f,
            applicableFoodIds: f.applicableFoodIds.includes(id)
                ? f.applicableFoodIds.filter((c) => c !== id)
                : [...f.applicableFoodIds, id],
        }));
    }, []);

    const setField = useCallback((key) => (value) => {
        setForm((f) => ({ ...f, [key]: value }));
    }, []);

    const handleCodeChange = useCallback((t) => {
        setForm((f) => ({ ...f, code: t.toUpperCase() }));
    }, []);

    const handleDiscountTypeChange = useCallback((value) => {
        setForm((f) => ({ ...f, discountType: value }));
    }, []);

    const handleStartDateChange = useCallback((v) => {
        setForm((f) => ({ ...f, startDate: v }));
    }, []);

    const handleEndDateChange = useCallback((v) => {
        setForm((f) => ({ ...f, endDate: v }));
    }, []);

    const handleActiveChange = useCallback((v) => {
        setForm((f) => ({ ...f, isActive: v }));
    }, []);

    const fieldHandlers = useMemo(
        () => ({
            name: setField("name"),
            description: setField("description"),
            discountValue: setField("discountValue"),
            minOrderValue: setField("minOrderValue"),
            maxDiscountAmount: setField("maxDiscountAmount"),
            usageLimit: setField("usageLimit"),
            usageLimitPerCustomer: setField("usageLimitPerCustomer"),
            applicableCustomerIdsRaw: setField("applicableCustomerIdsRaw"),
        }),
        [setField]
    );

    const openCategoryPicker = useCallback(() => setPickerMode("categories"), []);
    const openFoodPicker = useCallback(() => setPickerMode("foods"), []);
    const closePicker = useCallback(() => setPickerMode(null), []);

    const handleSubmit = useCallback(async () => {
        const errors = {};
        if (!form.name.trim()) errors.name = "Vui lòng nhập tên voucher";
        if (!form.code.trim()) errors.code = "Vui lòng nhập mã voucher";
        if (!form.discountValue || Number(form.discountValue) < 0) errors.discountValue = "Giá trị giảm không hợp lệ";
        if (form.discountType === "PERCENTAGE" && Number(form.discountValue) > 100)
            errors.discountValue = "Phần trăm giảm tối đa là 100";
        if (!form.endDate) errors.endDate = "Vui lòng chọn ngày kết thúc";

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        const payload = {
            name: form.name.trim(),
            code: form.code.trim().toUpperCase(),
            description: form.description.trim(),
            discountType: form.discountType,
            discountValue: Number(form.discountValue),
            maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
            minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : 0,
            applicableChannels: form.applicableChannels,
            applicableCategoryIds: form.applicableCategoryIds,
            applicableFoodIds: form.applicableFoodIds,
            applicableCustomerIds: splitCsv(form.applicableCustomerIdsRaw),
            startDate: form.startDate || undefined,
            endDate: form.endDate,
            usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
            usageLimitPerCustomer: form.usageLimitPerCustomer ? Number(form.usageLimitPerCustomer) : 1,
            isActive: form.isActive,
        };

        let res;
        try {
            res = await saveVoucherMutation.mutateAsync({ id: editingVoucher?._id, payload });
        } catch (err) {
            console.error("Failed to save voucher:", err);
            setFormErrors({ submit: "Không lưu được voucher, vui lòng thử lại" });
            return;
        }

        if (!res?.success) {
            setFormErrors({ submit: res?.message || "Không lưu được voucher, vui lòng thử lại" });
            return;
        }

        onClose();
        onSaved();
    }, [form, editingVoucher, saveVoucherMutation, onClose, onSaved]);

    return (
        <ModalOverlay onClose={onClose}>
            <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: modalMaxHeight }}>
                <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100">
                    <Text className="font-black text-green-900 text-lg">
                        {pickerMode === "categories"
                            ? "Chọn danh mục áp dụng"
                            : pickerMode === "foods"
                                ? "Chọn món ăn áp dụng"
                                : editingVoucher
                                    ? "Sửa voucher"
                                    : "Tạo voucher"}
                    </Text>
                    <Pressable onPress={onClose} className="w-8 h-8 rounded-full items-center justify-center bg-gray-50">
                        <X size={18} color={colors.gray[400]} />
                    </Pressable>
                </View>

                <ScrollView
                    style={{ flexShrink: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {pickerMode === "categories" ? (
                        <PickerBody
                            options={categoryOptions}
                            selectedIds={form.applicableCategoryIds}
                            onToggle={toggleCategoryId}
                            onDone={closePicker}
                            loading={optionsLoading}
                            emptyText="Chưa có danh mục nào"
                        />
                    ) : pickerMode === "foods" ? (
                        <PickerBody
                            options={foodPickerOptions}
                            selectedIds={form.applicableFoodIds}
                            onToggle={toggleFoodId}
                            onDone={closePicker}
                            loading={optionsLoading}
                            emptyText="Chưa có món ăn nào"
                        />
                    ) : (
                        <>
                            <FieldInput
                                label="Mã voucher"
                                full
                                error={formErrors.code}
                                value={form.code}
                                onChangeText={handleCodeChange}
                                placeholder="GIAM10"
                            />
                            <FieldInput
                                label="Tên voucher"
                                full
                                error={formErrors.name}
                                value={form.name}
                                onChangeText={fieldHandlers.name}
                                placeholder="Giảm 10%"
                            />
                            <FieldInput
                                label="Mô tả"
                                full
                                multiline
                                value={form.description}
                                onChangeText={fieldHandlers.description}
                            />

                            <FieldWrap label="Loại giảm">
                                <DiscountTypeSelector value={form.discountType} onChange={handleDiscountTypeChange} />
                            </FieldWrap>
                            <FieldInput
                                label="Giá trị giảm"
                                full
                                keyboardType="decimal-pad"
                                error={formErrors.discountValue}
                                value={form.discountValue}
                                onChangeText={fieldHandlers.discountValue}
                            />

                            <View className="flex-row flex-wrap justify-between">
                                <FieldInput
                                    label="Đơn tối thiểu (đ)"
                                    keyboardType="decimal-pad"
                                    value={form.minOrderValue}
                                    onChangeText={fieldHandlers.minOrderValue}
                                />
                                <FieldInput
                                    label="Giảm tối đa (đ)"
                                    keyboardType="decimal-pad"
                                    value={form.maxDiscountAmount}
                                    onChangeText={fieldHandlers.maxDiscountAmount}
                                    placeholder="Trống = không giới hạn"
                                />
                            </View>

                            <View className="flex-row flex-wrap justify-between">
                                <FieldInput
                                    label="Tổng lượt dùng"
                                    keyboardType="number-pad"
                                    value={form.usageLimit}
                                    onChangeText={fieldHandlers.usageLimit}
                                    placeholder="Trống = không giới hạn"
                                />
                                <FieldInput
                                    label="Lượt / khách"
                                    keyboardType="number-pad"
                                    value={form.usageLimitPerCustomer}
                                    onChangeText={fieldHandlers.usageLimitPerCustomer}
                                />
                            </View>

                            <View style={{ marginBottom: 14 }}>
                                <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                                    <DateField label="Bắt đầu" value={form.startDate} onChange={handleStartDateChange} />
                                    <DateField label="Kết thúc" value={form.endDate} onChange={handleEndDateChange} />
                                </View>
                                {!!formErrors.endDate && <Text className="text-rose-600 text-xs mt-1">{formErrors.endDate}</Text>}
                            </View>

                            <FieldWrap label="Áp dụng cho kênh (bỏ trống = tất cả)">
                                <ChannelSelector selected={form.applicableChannels} onToggle={toggleChannel} />
                            </FieldWrap>

                            <FieldWrap
                                label={`Danh mục áp dụng (để trống = tất cả)${form.applicableCategoryIds.length ? ` — đã chọn ${form.applicableCategoryIds.length}` : ""}`}
                            >
                                <PickerTrigger
                                    count={form.applicableCategoryIds.length}
                                    placeholder="Tất cả danh mục"
                                    onPress={openCategoryPicker}
                                />
                            </FieldWrap>

                            <FieldWrap
                                label={`Món ăn áp dụng (để trống = tất cả)${form.applicableFoodIds.length ? ` — đã chọn ${form.applicableFoodIds.length}` : ""}`}
                            >
                                <PickerTrigger
                                    count={form.applicableFoodIds.length}
                                    placeholder="Tất cả món ăn"
                                    onPress={openFoodPicker}
                                />
                            </FieldWrap>

                            <FieldInput
                                label="Khách hàng cụ thể (customerId/accountId, cách nhau dấu phẩy — để trống = mọi khách)"
                                full
                                value={form.applicableCustomerIdsRaw}
                                onChangeText={fieldHandlers.applicableCustomerIdsRaw}
                            />

                            <ActiveToggleRow value={form.isActive} onChange={handleActiveChange} />

                            {!!formErrors.submit && <Text className="text-rose-600 text-xs" style={{ marginBottom: 8 }}>{formErrors.submit}</Text>}
                        </>
                    )}
                </ScrollView>

                {!pickerMode && (
                    <View className="flex-row gap-2 px-5 py-4 border-t border-gray-100">
                        <Pressable onPress={onClose} className="flex-1 items-center rounded-xl border border-gray-200" style={{ paddingVertical: 12 }}>
                            <Text className="text-sm font-bold text-gray-600">Huỷ</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSubmit}
                            disabled={saveVoucherMutation.isPending}
                            style={{ opacity: saveVoucherMutation.isPending ? 0.6 : 1, paddingVertical: 12 }}
                            className="flex-1 items-center rounded-xl bg-green-600"
                        >
                            {saveVoucherMutation.isPending ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <Text className="text-sm font-bold text-white">{editingVoucher ? "Lưu thay đổi" : "Tạo voucher"}</Text>
                            )}
                        </Pressable>
                    </View>
                )}
            </View>
        </ModalOverlay>
    );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function VoucherPage() {
    const [statsRange, setStatsRange] = useState("all");

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [formOpen, setFormOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null); // null = đang tạo mới

    const [viewingVoucher, setViewingVoucher] = useState(null);

    // ── Dữ liệu món ăn / danh mục cho phần "áp dụng cho" trong form ──
    // Vẫn dùng Zustand như bản gốc — đây là store dùng chung nhiều trang
    // (GLOBAL ARCHITECTURE), không migrate sang react-query. Subscription
    // này CỐ Ý vẫn đặt ở VoucherPage (không đẩy xuống VoucherFormModal) để
    // giữ đúng hành vi gốc: prefetch foods ngay khi vào trang, để lúc mở
    // form category/food picker đã có sẵn dữ liệu — đẩy xuống form sẽ đổi
    // UX (chỉ fetch khi mở form lần đầu, có thể thấy loading mà bản gốc
    // không có).
    const foods = useFoodZustand((s) => s.foods);
    const foodsLoading = useFoodZustand((s) => s.loading);
    const getFoods = useFoodZustand((s) => s.getFoods);

    useEffect(() => {
        getFoods();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const foodOptions = useMemo(
        () => (Array.isArray(foods) ? foods.filter((f) => f && !f.__isNew) : []),
        [foods]
    );

    const categoryOptionsFromFoods = useMemo(() => {
        const seen = new Set();
        const opts = [];
        foodOptions.forEach((f) => {
            const cid = f?.categoryId;
            if (cid && !seen.has(cid)) {
                seen.add(cid);
                opts.push({ id: cid, label: cid });
            }
        });
        return opts.sort((a, b) => a.label.localeCompare(b.label, "vi"));
    }, [foodOptions]);

    const foodPickerOptions = useMemo(
        () => foodOptions.map((f) => ({ id: f._id, label: f.foodName || "(chưa đặt tên)" })),
        [foodOptions]
    );

    const optionsLoading = foodsLoading && foodOptions.length === 0;

    // ── Debounce ô tìm kiếm — 350ms như bản gốc.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(timer);
    }, [search]);

    // ── REACT-QUERY: thống kê voucher ────────────────────────────────
    const {
        data: stats = {},
        isLoading: statsLoading,
        isError: statsIsError,
    } = useQuery({
        queryKey: ["voucherStats", statsRange],
        queryFn: fetchVoucherStats,
        placeholderData: (prev) => prev,
    });
    const statsError = statsIsError ? "Không tải được thống kê voucher" : null;

    // ── REACT-QUERY: danh sách voucher ───────────────────────────────
    const {
        data: vouchers = [],
        isLoading: listLoading,
        isError: listIsError,
    } = useQuery({
        queryKey: ["vouchers", debouncedSearch],
        queryFn: fetchVouchersList,
        placeholderData: (prev) => prev,
    });
    const listError = listIsError ? "Không tải được danh sách voucher" : null;

    const filteredVouchers = useMemo(() => {
        const list = Array.isArray(vouchers) ? vouchers.filter(Boolean) : [];
        if (statusFilter === "ALL") return list;
        return list.filter((v) => v.status === statusFilter);
    }, [vouchers, statusFilter]);

    const queryClient = useQueryClient();

    const invalidateVoucherQueries = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["vouchers"] });
        queryClient.invalidateQueries({ queryKey: ["voucherStats"] });
    }, [queryClient]);

    // Chỉ destructure "mutate" — ổn định vĩnh viễn theo đúng thiết kế của
    // react-query — thay vì giữ nguyên object mutation (object đó đổi
    // identity mỗi khi trạng thái chuyển, sẽ kéo theo handleToggleActive →
    // renderVoucherItem đổi identity → FlatList re-render toàn bộ card).
    const { mutate: toggleActiveVoucher } = useMutation({
        mutationFn: async (voucher) => {
            const res = await putData({
                url: `/vouchers/${voucher._id}`,
                data: { isActive: !voucher.isActive },
            });
            if (!res?.success) throw new Error(res?.message || "Toggle voucher failed");
            return res;
        },
        onSuccess: () => invalidateVoucherQueries(),
        onError: (err) => console.error("Failed to toggle voucher:", err),
    });

    // ── Mở/đóng form — giờ CHỈ quyết định mount/unmount VoucherFormModal,
    // không còn quản lý form/formErrors/pickerMode nữa (đã chuyển hẳn vào
    // component con). Gõ trong form không còn khiến VoucherPage re-render.
    const openCreateForm = useCallback(() => {
        setEditingVoucher(null);
        setFormOpen(true);
    }, []);

    const openEditForm = useCallback((voucher) => {
        if (!voucher) return;
        setEditingVoucher(voucher);
        setFormOpen(true);
    }, []);

    const closeForm = useCallback(() => {
        setFormOpen(false);
    }, []);

    const closeViewingVoucher = useCallback(() => setViewingVoucher(null), []);

    // ── Tắt / bật nhanh từ danh sách ────────────────────────────────
    const handleToggleActive = useCallback(
        (voucher) => {
            if (!voucher?._id) return;
            toggleActiveVoucher(voucher);
        },
        [toggleActiveVoucher]
    );

    const todayLabel = new Date().toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const rangeSubLabel = RANGE_OPTIONS.find((r) => r.value === statsRange)?.label;

    /* ── FlatList: keyExtractor + renderItem ổn định ─────────────────
       renderVoucherItem chỉ phụ thuộc 2 callback đã ổn định vĩnh viễn. */
    const keyExtractor = useCallback((item, index) => item?._id || `voucher-${index}`, []);

    const renderVoucherItem = useCallback(
        ({ item }) => (
            <VoucherCard
                voucher={item}
                onView={setViewingVoucher}
                onEdit={openEditForm}
                onToggleActive={handleToggleActive}
            />
        ),
        // setViewingVoucher là setState setter — React đảm bảo ổn định vĩnh
        // viễn nên liệt kê ở đây không đổi hành vi, chỉ cho đúng exhaustive-deps.
        [openEditForm, handleToggleActive, setViewingVoucher]
    );

    const listHeader = (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 14 }}>
            <HeaderTop todayLabel={todayLabel} onCreate={openCreateForm} />
            <StatsSection
                statsRange={statsRange}
                onRangeChange={setStatsRange}
                statsError={statsError}
                statsLoading={statsLoading}
                stats={stats}
                rangeSubLabel={rangeSubLabel}
            />
            <ListToolbar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                listError={listError}
            />
        </View>
    );

    const listEmpty = listLoading ? (
        <View className="flex-row items-center justify-center py-16" style={{ gap: 8 }}>
            <ActivityIndicator size="small" color={colors.gray[400]} />
            <Text className="text-sm text-gray-400">Đang tải...</Text>
        </View>
    ) : (
        <View className="items-center py-14 px-6">
            <Text style={{ fontSize: 34 }}>🎟️</Text>
            <Text className="text-sm text-gray-300 font-bold mt-2">Chưa có voucher nào</Text>
        </View>
    );

    return (
        <View style={{ flex: 1 }} className="bg-gray-50">
            {/* Danh sách voucher — FlatList: chỉ render số item lấp đầy khung
                hình + buffer (giảm mount cost/RAM, scroll mượt hơn khi số
                voucher lớn). Header (title, thống kê, ô search, filter) đưa
                vào ListHeaderComponent để FlatList vẫn là scroll container
                duy nhất của trang — không lồng FlatList trong ScrollView. */}
            <FlatList
                data={filteredVouchers}
                keyExtractor={keyExtractor}
                renderItem={renderVoucherItem}
                ItemSeparatorComponent={ItemSeparator}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                style={{
                    marginHorizontal: 16,
                    marginTop: 12,
                    marginBottom: 40,
                    backgroundColor: colors.white,
                    borderWidth: 1,
                    borderColor: colors.gray[100],
                    borderRadius: 16,
                    overflow: "hidden",
                }}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={7}
                removeClippedSubviews={Platform.OS === "android"}
            />

            {/* ── Modal xem chi tiết — tách thành VoucherDetailModal ──── */}
            {!!viewingVoucher && (
                <VoucherDetailModal voucher={viewingVoucher} onClose={closeViewingVoucher} />
            )}

            {/* ── Modal tạo / sửa — tách thành VoucherFormModal. Gõ trong
                form giờ chỉ re-render component đó, không đụng gì đến
                VoucherPage/FlatList/6 stat card. ─────────────────────── */}
            {formOpen && (
                <VoucherFormModal
                    editingVoucher={editingVoucher}
                    onClose={closeForm}
                    onSaved={invalidateVoucherQueries}
                    categoryOptions={categoryOptionsFromFoods}
                    foodPickerOptions={foodPickerOptions}
                    optionsLoading={optionsLoading}
                />
            )}
        </View>
    );
}