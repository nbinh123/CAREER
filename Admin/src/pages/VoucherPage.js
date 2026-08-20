// pages/VoucherPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
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
    ChevronDown,
} from "lucide-react";
import StatCard from "../components/StatCard";
// ❗ Giả định — đổi tên hàm cho khớp nếu callAPI.js không export postData/putData
import { getData, postData, putData } from "../utils/callAPI";
import useFoodZustand from "../zustand/useFoodZustand";

const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

// Dùng chung cho mọi input/select/textarea trong form.
// Không dùng class "input" + @apply vì dự án này không cấu hình @apply
// trong CSS — khai báo trực tiếp Tailwind utility classes ở đây để tránh
// phụ thuộc vào một class CSS ngoài không tồn tại (crash silent, input mất style).
const inputClass =
    "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-100";

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
                // callAPI ở các nơi khác trong file này (fetchStats,
                // handleSubmit) đều kỳ vọng response dạng {success, data}.
                // Nếu /vouchers cũng theo dạng đó, res.data sẽ là OBJECT
                // {success, data:[...]}, không phải mảng — Array.isArray(res.data)
                // luôn false và danh sách sẽ luôn rỗng dù server có dữ liệu,
                // mà không có lỗi nào hiển thị ra ngoài để biết vì sao.
                // Chấp nhận cả 2 dạng: res.data là mảng trực tiếp, HOẶC
                // res.data.data là mảng (bọc trong {success,data}).
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

    // status là virtual field server trả sẵn trong mỗi voucher (đã bật
    // toJSON.virtuals trong VoucherModel) — lọc ngay trên client, không cần
    // thêm query param vì backend chưa hỗ trợ filter theo status tính toán.
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
        setFormOpen(true);
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
    const handleSubmit = async (e) => {
        e.preventDefault();

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

        // ❗ SỬA — data (không phải body) + check res.success thay vì try/catch,
        // vì callAPI.js không throw khi lỗi HTTP.
        // Vẫn bọc try/catch ở đây để chặn các lỗi khác (mất mạng, response
        // sai định dạng...) không làm crash form.
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

        setFormOpen(false);
        fetchVouchers();
        fetchStats();
    };

    // ── Tắt / bật nhanh từ danh sách ────────────────────────────────
    const handleToggleActive = async (voucher) => {
        if (!voucher?._id) return;

        // ❗ SỬA — cùng nguyên tắc: data thay body, check res.success
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-green-900">Quản lý Voucher</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                </div>
                <button
                    onClick={openCreateForm}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl px-4 py-2.5 transition"
                >
                    <Plus size={16} />
                    Tạo voucher
                </button>
            </div>

            {/* Bộ lọc khoảng thời gian cho 2 thẻ cuối */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-semibold">Thống kê giảm giá:</span>
                {RANGE_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setStatsRange(opt.value)}
                        className={`text-xs font-bold rounded-lg px-3 py-1.5 transition ${statsRange === opt.value ? "bg-green-600 text-white" : "bg-white text-gray-500 border border-gray-100"
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
                {statsError && (
                    <span className="flex items-center gap-1 text-xs text-rose-600 font-semibold ml-1">
                        <AlertTriangle size={13} />
                        {statsError}
                    </span>
                )}
            </div>

            {/* 6 thẻ thống kê */}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                <StatCard icon={Ticket} label="Tổng voucher" value={statsLoading ? "…" : stats?.totalVouchers ?? 0} sub="Toàn bộ mã đang có" color="blue" />
                <StatCard icon={CheckCircle2} label="Đang hoạt động" value={statsLoading ? "…" : stats?.active ?? 0} sub="Khách có thể dùng ngay" color="green" />
                <StatCard icon={Hourglass} label="Sắp hết hạn" value={statsLoading ? "…" : stats?.expiringSoon ?? 0} sub="Còn ≤ 3 ngày" color="amber" />
                <StatCard icon={Ban} label="Đã hết hạn" value={statsLoading ? "…" : stats?.expired ?? 0} sub="Hết hạn hoặc đã tắt" color="rose" />
                <StatCard icon={DollarSign} label="Tổng tiền đã giảm" value={statsLoading ? "…" : fmtVND(stats?.totalDiscountAmount)} sub={RANGE_OPTIONS.find((r) => r.value === statsRange)?.label} color="green" />
                <StatCard icon={BarChart3} label="Số lượt sử dụng" value={statsLoading ? "…" : stats?.totalUses ?? 0} sub={RANGE_OPTIONS.find((r) => r.value === statsRange)?.label} color="blue" />
            </div>

            {/* Danh sách */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <h3 className="font-bold text-gray-700">Danh sách voucher</h3>
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm theo mã voucher..."
                            className="pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-green-100 w-56"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            className={`text-xs font-bold rounded-lg px-3 py-1.5 transition ${statusFilter === f.value ? "bg-green-600 text-white" : "bg-green-50 text-gray-500"
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {listError && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold mb-3">
                        <AlertTriangle size={13} />
                        {listError}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                                <th className="pb-2 pr-4 font-semibold">Mã</th>
                                <th className="pb-2 pr-4 font-semibold">Tên</th>
                                <th className="pb-2 pr-4 font-semibold">Loại</th>
                                <th className="pb-2 pr-4 font-semibold">Giá trị</th>
                                <th className="pb-2 pr-4 font-semibold">Đơn tối thiểu</th>
                                <th className="pb-2 pr-4 font-semibold">Đã dùng</th>
                                <th className="pb-2 pr-4 font-semibold">Thời gian</th>
                                <th className="pb-2 pr-4 font-semibold">Trạng thái</th>
                                <th className="pb-2 font-semibold text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listLoading ? (
                                <tr>
                                    <td colSpan={9} className="py-8 text-center text-gray-400">Đang tải...</td>
                                </tr>
                            ) : filteredVouchers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-8 text-center text-gray-400">Chưa có voucher nào</td>
                                </tr>
                            ) : (
                                filteredVouchers.map((v) => {
                                    const meta = getStatusMeta(v.status);
                                    return (
                                        <tr key={v._id} className="border-b border-gray-50 last:border-0">
                                            <td className="py-3 pr-4 font-bold text-green-900">{v.code || "—"}</td>
                                            <td className="py-3 pr-4 text-gray-600">{v.name || "—"}</td>
                                            <td className="py-3 pr-4 text-gray-500">{v.discountType === "PERCENTAGE" ? "Giảm %" : "Giảm tiền"}</td>
                                            <td className="py-3 pr-4 text-gray-600 font-semibold">
                                                {v.discountType === "PERCENTAGE" ? `${v.discountValue ?? 0}%` : fmtVND(v.discountValue)}
                                            </td>
                                            <td className="py-3 pr-4 text-gray-500">{fmtVND(v.minOrderValue)}</td>
                                            <td className="py-3 pr-4 text-gray-500">
                                                {v.usedCount ?? 0}
                                                {v.usageLimit != null ? `/${v.usageLimit}` : ""}
                                            </td>
                                            <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                                                {formatDateVN(v.startDate)} – {formatDateVN(v.endDate)}
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className={`text-xs font-bold rounded-lg px-2.5 py-1 ${meta.color}`}>{meta.label}</span>
                                            </td>
                                            <td className="py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setViewingVoucher(v)}
                                                        title="Xem"
                                                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => openEditForm(v)}
                                                        title="Sửa"
                                                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-blue-600 transition"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(v)}
                                                        title={v.isActive ? "Tắt" : "Bật"}
                                                        className={`p-1.5 rounded-lg transition ${v.isActive ? "text-gray-400 hover:bg-rose-50 hover:text-rose-600" : "text-gray-400 hover:bg-green-50 hover:text-green-600"
                                                            }`}
                                                    >
                                                        <Power size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal xem chi tiết */}
            {viewingVoucher && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40">
                    <div className="w-full max-w-md bg-white rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-green-900 text-lg">{viewingVoucher.code || "—"}</h3>
                            <button onClick={() => setViewingVoucher(null)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-50">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-2.5 text-sm">
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
                        </div>
                    </div>
                </div>
            )}

            {/* Modal tạo / sửa */}
            {formOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/40 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-2xl p-6 my-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-black text-green-900 text-lg">{editingVoucher ? "Sửa voucher" : "Tạo voucher"}</h3>
                            <button type="button" onClick={() => setFormOpen(false)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-50">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Mã voucher" error={formErrors.code}>
                                    <input
                                        value={form.code}
                                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                                        className={inputClass}
                                        placeholder="GIAM10"
                                    />
                                </Field>
                                <Field label="Tên voucher" error={formErrors.name}>
                                    <input
                                        value={form.name}
                                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                        className={inputClass}
                                        placeholder="Giảm 10%"
                                    />
                                </Field>
                            </div>

                            <Field label="Mô tả">
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    className={inputClass}
                                    rows={2}
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Loại giảm">
                                    <select
                                        value={form.discountType}
                                        onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
                                        className={inputClass}
                                    >
                                        <option value="PERCENTAGE">Phần trăm (%)</option>
                                        <option value="FIXED">Số tiền cố định (VNĐ)</option>
                                    </select>
                                </Field>
                                <Field label="Giá trị giảm" error={formErrors.discountValue}>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.discountValue}
                                        onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Đơn tối thiểu (đ)">
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.minOrderValue}
                                        onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="Giảm tối đa (đ)">
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.maxDiscountAmount}
                                        onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))}
                                        className={inputClass}
                                        placeholder="Để trống = không giới hạn"
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Tổng lượt dùng">
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.usageLimit}
                                        onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                                        className={inputClass}
                                        placeholder="Để trống = không giới hạn"
                                    />
                                </Field>
                                <Field label="Lượt / khách">
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.usageLimitPerCustomer}
                                        onChange={(e) => setForm((f) => ({ ...f, usageLimitPerCustomer: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Bắt đầu">
                                    <input
                                        type="date"
                                        value={form.startDate}
                                        onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                                <Field label="Kết thúc" error={formErrors.endDate}>
                                    <input
                                        type="date"
                                        value={form.endDate}
                                        onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                                        className={inputClass}
                                    />
                                </Field>
                            </div>

                            <Field label="Áp dụng cho kênh (bỏ trống = tất cả)">
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <input type="checkbox" checked={form.applicableChannels.includes("DINE_IN")} onChange={() => toggleChannel("DINE_IN")} />
                                        Tại bàn
                                    </label>
                                    <label className="flex items-center gap-1.5 text-sm text-gray-600">
                                        <input type="checkbox" checked={form.applicableChannels.includes("ONLINE")} onChange={() => toggleChannel("ONLINE")} />
                                        Đặt online
                                    </label>
                                </div>
                            </Field>

                            {/* Danh mục / món ăn — dropdown có ô tìm kiếm, lấy dữ liệu từ useFoodZustand */}
                            <Field
                                label={`Danh mục áp dụng (để trống = tất cả)${form.applicableCategoryIds.length ? ` — đã chọn ${form.applicableCategoryIds.length}` : ""
                                    }`}
                            >
                                <SearchableMultiSelect
                                    options={categoryOptionsFromFoods}
                                    selectedIds={form.applicableCategoryIds}
                                    onToggle={toggleCategoryId}
                                    placeholder="Tất cả danh mục"
                                    searchPlaceholder="Tìm danh mục..."
                                    emptyText="Chưa có danh mục nào"
                                    loading={foodsLoading && foodOptions.length === 0}
                                />
                            </Field>

                            <Field
                                label={`Món ăn áp dụng (để trống = tất cả)${form.applicableFoodIds.length ? ` — đã chọn ${form.applicableFoodIds.length}` : ""
                                    }`}
                            >
                                <SearchableMultiSelect
                                    options={foodOptions.map((f) => ({ id: f._id, label: f.foodName || "(chưa đặt tên)" }))}
                                    selectedIds={form.applicableFoodIds}
                                    onToggle={toggleFoodId}
                                    placeholder="Tất cả món ăn"
                                    searchPlaceholder="Tìm món ăn..."
                                    emptyText="Chưa có món ăn nào"
                                    loading={foodsLoading && foodOptions.length === 0}
                                />
                            </Field>

                            <Field label="Khách hàng cụ thể (customerId/accountId, cách nhau dấu phẩy — để trống = mọi khách)">
                                <input
                                    value={form.applicableCustomerIdsRaw}
                                    onChange={(e) => setForm((f) => ({ ...f, applicableCustomerIdsRaw: e.target.value }))}
                                    className={inputClass}
                                />
                            </Field>

                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                                />
                                Kích hoạt ngay
                            </label>

                            {formErrors.submit && <p className="text-rose-600 text-xs">{formErrors.submit}</p>}
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button
                                type="button"
                                onClick={() => setFormOpen(false)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold"
                            >
                                Huỷ
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-60"
                            >
                                {submitting ? "Đang lưu..." : editingVoucher ? "Lưu thay đổi" : "Tạo voucher"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function Field({ label, error, children }) {
    return (
        <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
            {children}
            {error && <p className="text-rose-600 text-xs mt-1">{error}</p>}
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex justify-between gap-4">
            <span className="text-gray-400">{label}</span>
            <span className="text-gray-700 font-semibold text-right">{value}</span>
        </div>
    );
}

/**
 * Dropdown chọn nhiều lựa chọn kèm ô tìm kiếm — dùng cho "Danh mục áp dụng"
 * và "Món ăn áp dụng" trong form voucher. Mặc định đóng, chỉ hiện danh sách
 * khi bấm vào (thay vì show hết checkbox ra ngoài), và tự đóng khi click
 * ra ngoài. Trigger dùng chung `inputClass` để đồng bộ chiều cao/kiểu dáng
 * với các select khác trong form (vd. "Loại giảm").
 */
function SearchableMultiSelect({
    options,
    selectedIds,
    onToggle,
    placeholder = "Chọn...",
    searchPlaceholder = "Tìm kiếm...",
    emptyText = "Không có lựa chọn nào",
    loading = false,
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];
    const filtered = useMemo(() => {
        const safeOptions = Array.isArray(options) ? options : [];
        const q = query.trim().toLowerCase();
        if (!q) return safeOptions;
        return safeOptions.filter((o) => (o.label || "").toLowerCase().includes(q));
    }, [options, query]);

    const summary = safeSelectedIds.length === 0 ? placeholder : `Đã chọn ${safeSelectedIds.length}`;

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`${inputClass} flex items-center justify-between gap-2 text-left ${safeSelectedIds.length === 0 ? "text-gray-400" : "text-gray-700"
                    }`}
            >
                <span className="truncate">{summary}</span>
                <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="absolute z-20 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2">
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className={`${inputClass} mb-1.5`}
                    />
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                        {loading ? (
                            <p className="text-xs text-gray-400 italic px-1 py-1">Đang tải...</p>
                        ) : filtered.length === 0 ? (
                            <p className="text-xs text-gray-400 italic px-1 py-1">
                                {query ? "Không tìm thấy lựa chọn phù hợp" : emptyText}
                            </p>
                        ) : (
                            filtered.map((o) => (
                                <label
                                    key={o.id}
                                    className="flex items-center gap-1.5 text-sm text-gray-600 px-1 py-1 rounded-lg hover:bg-gray-50 cursor-pointer"
                                >
                                    <input type="checkbox" checked={safeSelectedIds.includes(o.id)} onChange={() => onToggle(o.id)} />
                                    <span className="truncate">{o.label}</span>
                                </label>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}