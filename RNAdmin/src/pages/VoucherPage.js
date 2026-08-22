import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    Modal,
    ActivityIndicator,
    Switch,
    Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
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

/* ════════════════════════════════════════════════════════════
   UI HELPERS cục bộ (không có Button/Modal/FormInput dùng chung
   nào để tái sử dụng — dựng riêng trong file này, cùng cách các
   trang khác trong dự án đã làm)
════════════════════════════════════════════════════════════ */

/* Overlay dùng chung cho mọi modal — tương đương e.stopPropagation() bên
   web, đúng pattern ModalOverlay đã dùng ở IngredientsPage.js/Customers.js/
   StoragePage.js. */
function ModalOverlay({ onClose, maxWidth = 460, children }) {
    return (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: "rgba(20,83,45,0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                }}
            >
                <Pressable onPress={() => { }} style={{ width: "100%", maxWidth }}>
                    {children}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function IconBtn({ icon: Icon, onPress, tone = "neutral" }) {
    const TONE = {
        neutral: { box: "bg-gray-50", color: colors.gray[500] },
        danger: { box: "bg-red-50", color: colors.red[600] },
        // "Sắp tắt" — thay cho hover:bg-rose-50 bên web, xem ghi chú platform.
        rose: { box: "bg-rose-50", color: "#e11d48" },
        // "Sắp bật" — thay cho hover:bg-green-50 bên web.
        success: { box: "bg-green-50", color: colors.green[600] },
    };
    const t = TONE[tone] ?? TONE.neutral;
    return (
        <Pressable onPress={onPress} className={`w-8 h-8 rounded-lg items-center justify-center ${t.box}`}>
            <Icon size={15} color={t.color} />
        </Pressable>
    );
}

/* Nhãn + (tuỳ chọn) lỗi bên dưới — bọc mọi loại field trong form, kể cả
   field không phải TextInput (segmented/checkbox/date/picker). */
function FieldWrap({ label, error, children }) {
    return (
        <View style={{ marginBottom: 14 }}>
            <Text className="text-xs font-semibold text-gray-500 mb-1.5">{label}</Text>
            {children}
            {!!error && <Text className="text-rose-600 text-xs mt-1">{error}</Text>}
        </View>
    );
}

function FieldInput({ label, error, value, onChangeText, keyboardType = "default", multiline, full, placeholder }) {
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
}

/* Ô vuông tự vẽ thay <input type="checkbox"> — dùng cho kênh áp dụng và
   từng dòng trong PickerBody bên dưới. */
function CheckBox({ checked }) {
    return (
        <View
            className={`items-center justify-center rounded-md ${checked ? "bg-green-600" : "bg-white border border-gray-300"}`}
            style={{ width: 18, height: 18 }}
        >
            {checked && <Check size={12} color={colors.white} />}
        </View>
    );
}

/* Ô chọn ngày, thay <input type="date"> — copy nguyên cách StoragePage.js
   đã dựng (Platform-specific behavior cho Android/iOS). */
function DateField({ label, value, onChange }) {
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
}

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
function PickerTrigger({ count, placeholder, onPress }) {
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
}

function Row({ label, value }) {
    return (
        <View className="flex-row justify-between" style={{ gap: 12 }}>
            <Text className="text-gray-400 text-sm">{label}</Text>
            <Text className="text-gray-700 text-sm font-semibold text-right" style={{ flexShrink: 1 }}>
                {value}
            </Text>
        </View>
    );
}

/* 1 voucher = 1 card (thay cho 1 hàng <tr> ở bản gốc). KHÔNG bớt field nào
   so với bảng 9 cột gốc — dòng 3 gộp "Loại giảm" + "Giá trị" lại vì cùng
   diễn đạt 1 ý ("Giảm 10%" / "Giảm 20.000₫"). */
function VoucherCard({ voucher, isLast, onView, onEdit, onToggleActive }) {
    const meta = getStatusMeta(voucher.status);
    return (
        <View
            style={{ borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.gray[50] }}
            className="px-4 py-3.5"
        >
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
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function VoucherPage() {
    const [stats, setStats] = useState({});
    const [statsRange, setStatsRange] = useState("all");
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState(null);

    const [vouchers, setVouchers] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [formOpen, setFormOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null); // null = đang tạo mới
    const [form, setForm] = useState(emptyForm);
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [pickerMode, setPickerMode] = useState(null); // null | "categories" | "foods"

    const [viewingVoucher, setViewingVoucher] = useState(null);

    // ── Dữ liệu món ăn / danh mục cho phần "áp dụng cho" trong form ──
    const foods = useFoodZustand((s) => s.foods);
    const foodsLoading = useFoodZustand((s) => s.loading);
    const getFoods = useFoodZustand((s) => s.getFoods);

    // getFoods() tự bỏ qua nếu đã có dữ liệu (xem useFoodZustand), nên gọi
    // ngay khi vào trang là an toàn, không lo fetch lặp lại mỗi lần mở form.
    useEffect(() => {
        getFoods();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Bỏ các món đang stage thêm mới nhưng chưa lưu server (id tạm "temp_...")
    // khỏi danh sách chọn — voucher cần foodId thật để đối chiếu khi áp dụng.
    const foodOptions = useMemo(
        () => (Array.isArray(foods) ? foods.filter((f) => f && !f.__isNew) : []),
        [foods]
    );

    // ❗ Danh mục lấy trực tiếp từ categoryId có sẵn trên các món đã fetch
    // (không dùng state "categories" của useFoodZustand — hiện chưa có action
    // nào gán giá trị cho nó nên luôn rỗng). categoryId trong FoodModel là
    // String tự do, không populate tên riêng, nên dùng luôn giá trị này làm
    // cả id lẫn nhãn hiển thị.
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

    // ── Fetch thống kê ──────────────────────────────────────────────
    const fetchStats = () => {
        setStatsLoading(true);
        setStatsError(null);
        const rangeParam = statsRange === "all" ? "" : `?range=${statsRange}`;
        getData({ url: `/vouchers/stats${rangeParam}` })
            .then((res) => {
                // Phòng trường hợp response thiếu field / sai shape (res.data hoặc
                // res.data.data không tồn tại) — không để crash khi setState.
                const data = res?.data?.data;
                setStats(data && typeof data === "object" ? data : {});
            })
            .catch((err) => {
                console.error("Failed to fetch voucher stats:", err);
                setStats({});
                setStatsError("Không tải được thống kê voucher");
            })
            .finally(() => setStatsLoading(false));
    };

    useEffect(fetchStats, [statsRange]);

    // ── Fetch danh sách ─────────────────────────────────────────────
    const fetchVouchers = () => {
        setListLoading(true);
        setListError(null);
        const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
        getData({ url: `/vouchers${query}` })
            .then((res) => {
                // Chấp nhận cả 2 dạng: res.data là mảng trực tiếp, HOẶC res.data.data
                // là mảng (bọc trong {success,data}) — xem ghi chú ở bản gốc.
                const list = Array.isArray(res?.data)
                    ? res.data
                    : Array.isArray(res?.data?.data)
                        ? res.data.data
                        : [];
                setVouchers(list);
            })
            .catch((err) => {
                console.error("Failed to fetch vouchers:", err);
                setVouchers([]);
                setListError("Không tải được danh sách voucher");
            })
            .finally(() => setListLoading(false));
    };

    useEffect(() => {
        const timer = setTimeout(fetchVouchers, 350); // debounce ô tìm kiếm
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // status là virtual field server trả sẵn trong mỗi voucher — lọc ngay
    // trên client, không cần thêm query param vì backend chưa hỗ trợ filter
    // theo status tính toán.
    const filteredVouchers = useMemo(() => {
        const list = Array.isArray(vouchers) ? vouchers.filter(Boolean) : [];
        if (statusFilter === "ALL") return list;
        return list.filter((v) => v.status === statusFilter);
    }, [vouchers, statusFilter]);

    // ── Mở form ─────────────────────────────────────────────────────
    const openCreateForm = () => {
        setEditingVoucher(null);
        setForm(emptyForm);
        setFormErrors({});
        setPickerMode(null);
        setFormOpen(true);
    };

    const openEditForm = (voucher) => {
        if (!voucher) return;
        setEditingVoucher(voucher);
        setForm({
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
        setFormErrors({});
        setPickerMode(null);
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setPickerMode(null);
    };

    const toggleChannel = (channel) => {
        setForm((f) => ({
            ...f,
            applicableChannels: f.applicableChannels.includes(channel)
                ? f.applicableChannels.filter((c) => c !== channel)
                : [...f.applicableChannels, channel],
        }));
    };

    const toggleCategoryId = (id) => {
        setForm((f) => ({
            ...f,
            applicableCategoryIds: f.applicableCategoryIds.includes(id)
                ? f.applicableCategoryIds.filter((c) => c !== id)
                : [...f.applicableCategoryIds, id],
        }));
    };

    const toggleFoodId = (id) => {
        setForm((f) => ({
            ...f,
            applicableFoodIds: f.applicableFoodIds.includes(id)
                ? f.applicableFoodIds.filter((c) => c !== id)
                : [...f.applicableFoodIds, id],
        }));
    };

    // ── Submit tạo/sửa ──────────────────────────────────────────────
    const handleSubmit = async () => {
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

        setSubmitting(true);

        let res;
        try {
            res = editingVoucher
                ? await putData({ url: `/vouchers/${editingVoucher._id}`, data: payload })
                : await postData({ url: "/vouchers", data: payload });
        } catch (err) {
            console.error("Failed to save voucher:", err);
            setSubmitting(false);
            setFormErrors({ submit: "Không lưu được voucher, vui lòng thử lại" });
            return;
        }

        setSubmitting(false);

        if (!res?.success) {
            setFormErrors({ submit: res?.message || "Không lưu được voucher, vui lòng thử lại" });
            return;
        }

        closeForm();
        fetchVouchers();
        fetchStats();
    };

    // ── Tắt / bật nhanh từ danh sách ────────────────────────────────
    const handleToggleActive = async (voucher) => {
        if (!voucher?._id) return;

        try {
            const res = await putData({
                url: `/vouchers/${voucher._id}`,
                data: { isActive: !voucher.isActive },
            });

            if (!res?.success) {
                console.error("Failed to toggle voucher:", res?.message);
                return;
            }

            fetchVouchers();
            fetchStats();
        } catch (err) {
            console.error("Failed to toggle voucher:", err);
        }
    };

    const todayLabel = new Date().toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const rangeSubLabel = RANGE_OPTIONS.find((r) => r.value === statsRange)?.label;

    return (
        <View style={{ flex: 1 }} className="bg-gray-50">
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
                {/* ── Header ────────────────────────────────────────────────── */}
                <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
                    <View>
                        <Text className="text-2xl font-black text-green-900">Quản lý Voucher</Text>
                        <Text className="text-gray-500 text-sm mt-0.5">{todayLabel}</Text>
                    </View>
                    <Pressable
                        onPress={openCreateForm}
                        className="flex-row items-center gap-1.5 bg-green-600 rounded-xl"
                        style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                    >
                        <Plus size={16} color={colors.white} />
                        <Text className="text-white text-sm font-bold">Tạo voucher</Text>
                    </Pressable>
                </View>

                {/* ── Bộ lọc khoảng thời gian cho 2 thẻ cuối ──────────────────── */}
                <View style={{ gap: 8 }}>
                    <Text className="text-xs text-gray-500 font-semibold">Thống kê giảm giá:</Text>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {RANGE_OPTIONS.map((opt) => (
                            <Pressable
                                key={opt.value}
                                onPress={() => setStatsRange(opt.value)}
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
                </View>

                {/* ── 6 thẻ thống kê ───────────────────────────────────────── */}
                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                    <StatCard icon={Ticket} label="Tổng voucher" value={statsLoading ? "…" : stats?.totalVouchers ?? 0} sub="Toàn bộ mã đang có" color="blue" />
                    <StatCard icon={CheckCircle2} label="Đang hoạt động" value={statsLoading ? "…" : stats?.active ?? 0} sub="Khách có thể dùng ngay" color="green" />
                    <StatCard icon={Hourglass} label="Sắp hết hạn" value={statsLoading ? "…" : stats?.expiringSoon ?? 0} sub="Còn ≤ 3 ngày" color="amber" />
                    <StatCard icon={Ban} label="Đã hết hạn" value={statsLoading ? "…" : stats?.expired ?? 0} sub="Hết hạn hoặc đã tắt" color="rose" />
                    <StatCard icon={DollarSign} label="Tổng tiền đã giảm" value={statsLoading ? "…" : fmtVND(stats?.totalDiscountAmount)} sub={rangeSubLabel} color="green" />
                    <StatCard icon={BarChart3} label="Số lượt sử dụng" value={statsLoading ? "…" : stats?.totalUses ?? 0} sub={rangeSubLabel} color="blue" />
                </View>

                {/* ── Danh sách ────────────────────────────────────────────── */}
                <View className="bg-white rounded-2xl border border-gray-100" style={{ padding: 16, gap: 12 }}>
                    <Text className="font-bold text-gray-700">Danh sách voucher</Text>

                    <View style={{ position: "relative", justifyContent: "center" }}>
                        <View style={{ position: "absolute", left: 13, zIndex: 1 }}>
                            <Search size={15} color={colors.gray[400]} />
                        </View>
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
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
                                onPress={() => setStatusFilter(f.value)}
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

                    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        {listLoading ? (
                            <View className="flex-row items-center justify-center py-16" style={{ gap: 8 }}>
                                <ActivityIndicator size="small" color={colors.gray[400]} />
                                <Text className="text-sm text-gray-400">Đang tải...</Text>
                            </View>
                        ) : filteredVouchers.length === 0 ? (
                            <View className="items-center py-14 px-6">
                                <Text style={{ fontSize: 34 }}>🎟️</Text>
                                <Text className="text-sm text-gray-300 font-bold mt-2">Chưa có voucher nào</Text>
                            </View>
                        ) : (
                            filteredVouchers.map((v, idx) => (
                                <VoucherCard
                                    key={v._id || idx}
                                    voucher={v}
                                    isLast={idx === filteredVouchers.length - 1}
                                    onView={setViewingVoucher}
                                    onEdit={openEditForm}
                                    onToggleActive={handleToggleActive}
                                />
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* ── Modal xem chi tiết ────────────────────────────────────── */}
            {!!viewingVoucher && (
                <ModalOverlay onClose={() => setViewingVoucher(null)}>
                    <View className="bg-white rounded-3xl" style={{ padding: 24, gap: 10 }}>
                        <View className="flex-row items-center justify-between" style={{ marginBottom: 4 }}>
                            <Text className="font-black text-green-900 text-lg">{viewingVoucher.code || "—"}</Text>
                            <Pressable onPress={() => setViewingVoucher(null)} className="w-8 h-8 rounded-full items-center justify-center bg-gray-50">
                                <X size={18} color={colors.gray[400]} />
                            </Pressable>
                        </View>
                        <Row label="Tên" value={viewingVoucher.name || "—"} />
                        <Row label="Mô tả" value={viewingVoucher.description || "—"} />
                        <Row
                            label="Loại giảm"
                            value={
                                viewingVoucher.discountType === "PERCENTAGE"
                                    ? `${viewingVoucher.discountValue ?? 0}%`
                                    : fmtVND(viewingVoucher.discountValue)
                            }
                        />
                        <Row label="Giảm tối đa" value={viewingVoucher.maxDiscountAmount != null ? fmtVND(viewingVoucher.maxDiscountAmount) : "Không giới hạn"} />
                        <Row label="Đơn tối thiểu" value={fmtVND(viewingVoucher.minOrderValue)} />
                        <Row label="Kênh áp dụng" value={viewingVoucher.applicableChannels?.length ? viewingVoucher.applicableChannels.join(", ") : "Tất cả"} />
                        <Row label="Lượt dùng" value={`${viewingVoucher.usedCount ?? 0}${viewingVoucher.usageLimit != null ? `/${viewingVoucher.usageLimit}` : " (không giới hạn)"}`} />
                        <Row label="Mỗi khách" value={`${viewingVoucher.usageLimitPerCustomer ?? 1} lượt`} />
                        <Row label="Thời gian" value={`${formatDateVN(viewingVoucher.startDate, {})} – ${formatDateVN(viewingVoucher.endDate, {})}`} />
                        <Row label="Trạng thái" value={getStatusMeta(viewingVoucher.status).label} />
                    </View>
                </ModalOverlay>
            )}

            {/* ── Modal tạo / sửa ──────────────────────────────────────── */}
            {formOpen && (
                <ModalOverlay onClose={closeForm}>
                    <View className="bg-white rounded-3xl overflow-hidden" style={{ maxHeight: "88%" }}>
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
                            <Pressable onPress={closeForm} className="w-8 h-8 rounded-full items-center justify-center bg-gray-50">
                                <X size={18} color={colors.gray[400]} />
                            </Pressable>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
                            {pickerMode === "categories" ? (
                                <PickerBody
                                    options={categoryOptionsFromFoods}
                                    selectedIds={form.applicableCategoryIds}
                                    onToggle={toggleCategoryId}
                                    onDone={() => setPickerMode(null)}
                                    loading={foodsLoading && foodOptions.length === 0}
                                    emptyText="Chưa có danh mục nào"
                                />
                            ) : pickerMode === "foods" ? (
                                <PickerBody
                                    options={foodPickerOptions}
                                    selectedIds={form.applicableFoodIds}
                                    onToggle={toggleFoodId}
                                    onDone={() => setPickerMode(null)}
                                    loading={foodsLoading && foodOptions.length === 0}
                                    emptyText="Chưa có món ăn nào"
                                />
                            ) : (
                                <>
                                    <FieldInput
                                        label="Mã voucher"
                                        full
                                        error={formErrors.code}
                                        value={form.code}
                                        onChangeText={(t) => setForm((f) => ({ ...f, code: t.toUpperCase() }))}
                                        placeholder="GIAM10"
                                    />
                                    <FieldInput
                                        label="Tên voucher"
                                        full
                                        error={formErrors.name}
                                        value={form.name}
                                        onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                                        placeholder="Giảm 10%"
                                    />
                                    <FieldInput
                                        label="Mô tả"
                                        full
                                        multiline
                                        value={form.description}
                                        onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
                                    />

                                    <FieldWrap label="Loại giảm">
                                        <View className="flex-row" style={{ gap: 8 }}>
                                            {DISCOUNT_TYPE_OPTIONS.map((opt) => (
                                                <Pressable
                                                    key={opt.value}
                                                    onPress={() => setForm((f) => ({ ...f, discountType: opt.value }))}
                                                    className={`flex-1 items-center rounded-xl ${form.discountType === opt.value ? "bg-green-600" : "bg-white border border-gray-200"}`}
                                                    style={{ paddingVertical: 10 }}
                                                >
                                                    <Text className={`text-xs font-bold ${form.discountType === opt.value ? "text-white" : "text-gray-600"}`}>
                                                        {opt.label}
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </FieldWrap>
                                    <FieldInput
                                        label="Giá trị giảm"
                                        full
                                        keyboardType="decimal-pad"
                                        error={formErrors.discountValue}
                                        value={form.discountValue}
                                        onChangeText={(t) => setForm((f) => ({ ...f, discountValue: t }))}
                                    />

                                    <View className="flex-row flex-wrap justify-between">
                                        <FieldInput
                                            label="Đơn tối thiểu (đ)"
                                            keyboardType="decimal-pad"
                                            value={form.minOrderValue}
                                            onChangeText={(t) => setForm((f) => ({ ...f, minOrderValue: t }))}
                                        />
                                        <FieldInput
                                            label="Giảm tối đa (đ)"
                                            keyboardType="decimal-pad"
                                            value={form.maxDiscountAmount}
                                            onChangeText={(t) => setForm((f) => ({ ...f, maxDiscountAmount: t }))}
                                            placeholder="Trống = không giới hạn"
                                        />
                                    </View>

                                    <View className="flex-row flex-wrap justify-between">
                                        <FieldInput
                                            label="Tổng lượt dùng"
                                            keyboardType="number-pad"
                                            value={form.usageLimit}
                                            onChangeText={(t) => setForm((f) => ({ ...f, usageLimit: t }))}
                                            placeholder="Trống = không giới hạn"
                                        />
                                        <FieldInput
                                            label="Lượt / khách"
                                            keyboardType="number-pad"
                                            value={form.usageLimitPerCustomer}
                                            onChangeText={(t) => setForm((f) => ({ ...f, usageLimitPerCustomer: t }))}
                                        />
                                    </View>

                                    <View style={{ marginBottom: 14 }}>
                                        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                                            <DateField label="Bắt đầu" value={form.startDate} onChange={(v) => setForm((f) => ({ ...f, startDate: v }))} />
                                            <DateField label="Kết thúc" value={form.endDate} onChange={(v) => setForm((f) => ({ ...f, endDate: v }))} />
                                        </View>
                                        {!!formErrors.endDate && <Text className="text-rose-600 text-xs mt-1">{formErrors.endDate}</Text>}
                                    </View>

                                    <FieldWrap label="Áp dụng cho kênh (bỏ trống = tất cả)">
                                        <View className="flex-row" style={{ gap: 20 }}>
                                            {CHANNEL_OPTIONS.map((c) => (
                                                <Pressable
                                                    key={c.value}
                                                    onPress={() => toggleChannel(c.value)}
                                                    className="flex-row items-center"
                                                    style={{ gap: 7 }}
                                                >
                                                    <CheckBox checked={form.applicableChannels.includes(c.value)} />
                                                    <Text className="text-sm text-gray-600">{c.label}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </FieldWrap>

                                    <FieldWrap
                                        label={`Danh mục áp dụng (để trống = tất cả)${form.applicableCategoryIds.length ? ` — đã chọn ${form.applicableCategoryIds.length}` : ""}`}
                                    >
                                        <PickerTrigger
                                            count={form.applicableCategoryIds.length}
                                            placeholder="Tất cả danh mục"
                                            onPress={() => setPickerMode("categories")}
                                        />
                                    </FieldWrap>

                                    <FieldWrap
                                        label={`Món ăn áp dụng (để trống = tất cả)${form.applicableFoodIds.length ? ` — đã chọn ${form.applicableFoodIds.length}` : ""}`}
                                    >
                                        <PickerTrigger
                                            count={form.applicableFoodIds.length}
                                            placeholder="Tất cả món ăn"
                                            onPress={() => setPickerMode("foods")}
                                        />
                                    </FieldWrap>

                                    <FieldInput
                                        label="Khách hàng cụ thể (customerId/accountId, cách nhau dấu phẩy — để trống = mọi khách)"
                                        full
                                        value={form.applicableCustomerIdsRaw}
                                        onChangeText={(t) => setForm((f) => ({ ...f, applicableCustomerIdsRaw: t }))}
                                    />

                                    <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
                                        <Text className="text-sm text-gray-600">Kích hoạt ngay</Text>
                                        <Switch
                                            value={form.isActive}
                                            onValueChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                                            trackColor={{ false: colors.gray[200], true: colors.green[400] }}
                                            thumbColor={colors.white}
                                        />
                                    </View>

                                    {!!formErrors.submit && <Text className="text-rose-600 text-xs" style={{ marginBottom: 8 }}>{formErrors.submit}</Text>}
                                </>
                            )}
                        </ScrollView>

                        {!pickerMode && (
                            <View className="flex-row gap-2 px-5 py-4 border-t border-gray-100">
                                <Pressable onPress={closeForm} className="flex-1 items-center rounded-xl border border-gray-200" style={{ paddingVertical: 12 }}>
                                    <Text className="text-sm font-bold text-gray-600">Huỷ</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                    style={{ opacity: submitting ? 0.6 : 1, paddingVertical: 12 }}
                                    className="flex-1 items-center rounded-xl bg-green-600"
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <Text className="text-sm font-bold text-white">{editingVoucher ? "Lưu thay đổi" : "Tạo voucher"}</Text>
                                    )}
                                </Pressable>
                            </View>
                        )}
                    </View>
                </ModalOverlay>
            )}
        </View>
    );
}