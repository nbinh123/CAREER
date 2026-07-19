import React, { useEffect, useState, useRef } from "react";
import {
    AlertTriangle, Check, Edit2, FolderOpen, Loader2,
    Plus, RefreshCw, Save, Search, Trash2, X, Upload
} from "lucide-react";
import fmtVND from "../utils/fmtVND";
import Btn from "../components/Button";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";
import useIngredientZustand from "../zustand/useIngredientZustand";

import exportJSON from "../utils/exportJSON"
import importJSON from "../utils/importJSON";
import { API_URL } from "../config/api"

const EMPTY_ING = {
    displayOrder: 0,
    ingredientName: "",
    quantity: 0,
    smallUnit: "",
    largeUnit: "",
    pricePerLargeUnit: 0,
    expiryDays: 0,
    note: "",
    needContinuousRestock: false,
};

export default function IngredientsPage() {
    // ─── Selectors Zustand ─────────────────────────────────
    // Mỗi field/action được lấy riêng bằng selector, thay vì
    // destructure toàn bộ store. Nhờ vậy component chỉ re-render
    // khi field mà nó thực sự dùng thay đổi, không phải mỗi khi
    // BẤT KỲ field nào trong store đổi (vd isSaving đổi thì
    // các phần chỉ dùng ingredients sẽ không bị render lại).
    const ingredients = useIngredientZustand((s) => s.ingredients);
    const pendingChanges = useIngredientZustand((s) => s.pendingChanges);
    const isLoading = useIngredientZustand((s) => s.isLoading);
    const isSaving = useIngredientZustand((s) => s.isSaving);
    const saveError = useIngredientZustand((s) => s.saveError);
    const getIngredients = useIngredientZustand((s) => s.getIngredients);
    const addIngredientLocal = useIngredientZustand((s) => s.addIngredientLocal);
    const editIngredientLocal = useIngredientZustand((s) => s.editIngredientLocal);
    const deleteIngredientLocal = useIngredientZustand((s) => s.deleteIngredientLocal);
    const saveAllChanges = useIngredientZustand((s) => s.saveAllChanges);
    const discardChanges = useIngredientZustand((s) => s.discardChanges);
    const clearSaveError = useIngredientZustand((s) => s.clearSaveError);

    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState(null);

    const [search, setSearch] = useState("");
    const [modal, setModal] = useState(null); // null | "add" | "edit"
    const [form, setForm] = useState(EMPTY_ING);
    const [editId, setEditId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [discardOpen, setDiscardOpen] = useState(false);

    // Fetch dữ liệu lần đầu
    useEffect(() => {
        function fetchData() {
            getIngredients();
        }
        fetchData();
    }, [getIngredients]);

    // ─── Thống kê pending ─────────────────────────────────
    const pendingCount =
        pendingChanges.added.length +
        pendingChanges.updated.length +
        pendingChanges.deleted.length;
    const hasPending = pendingCount > 0;

    // ─── Search ───────────────────────────────────────────
    const filtered = ingredients.filter((i) =>
        i.ingredientName.toLowerCase().includes(search.toLowerCase())
    );

    // ─── Helpers form ─────────────────────────────────────
    const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

    const exportData = () => {
        exportJSON(`${API_URL}/api/ingredients`, "ingrendient")
    }
    const triggerImport = () => fileInputRef.current?.click();

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportError(null);

        try {
            await importJSON(`${API_URL}/api/ingredients`, file, "ingredients");
            await getIngredients(); // tải lại danh sách mới nhất từ server
        } catch (err) {
            setImportError(
                err.response?.data?.message || err.message || "Import thất bại"
            );
        } finally {
            setIsImporting(false);
            e.target.value = ""; // reset để chọn lại cùng file được
        }
    };

    const openAdd = () => {
        setForm(EMPTY_ING);
        setModal("add");
    };

    const openEdit = (ing) => {
        setForm({ ...ing });
        setEditId(ing._id);
        setModal("edit");
    };

    const closeModal = () => {
        setModal(null);
        setEditId(null);
    };

    // ─── CRUD local (chưa gọi API) ────────────────────────
    const handleSave = () => {
        if (!form.ingredientName.trim()) return;
        if (modal === "add") {
            addIngredientLocal(form);
        } else {
            editIngredientLocal({ ...form, _id: editId });
        }
        closeModal();
    };

    const handleDelete = () => {
        deleteIngredientLocal(deleteId);
        setDeleteId(null);
    };

    // ─── Lưu tất cả lên server ────────────────────────────
    const handleSaveAll = async () => {
        try {
            await saveAllChanges();
        } catch {
            // Lỗi đã được lưu vào saveError trong zustand
        }
    };

    // ─── Trạng thái của từng hàng ─────────────────────────
    const getRowStatus = (ing) => {
        if (pendingChanges.added.some((i) => i._id === ing._id)) return "added";
        if (pendingChanges.updated.some((i) => i._id === ing._id)) return "updated";
        return "normal";
    };

    const rowStatusStyle = {
        added: "bg-green-50 border-l-2 border-l-green-400",
        updated: "bg-amber-50 border-l-2 border-l-amber-400",
        normal: "",
    };

    const rowStatusBadge = {
        added: <span className="text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-md">Mới</span>,
        updated: <span className="text-xs font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">Đã sửa</span>,
        normal: null,
    };

    // ─── Render ───────────────────────────────────────────
    return (
        <div className="space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-green-900">Nguyên liệu</h1>
                    <p className="text-gray-500 text-sm">
                        {ingredients.length} nguyên liệu trong kho
                        {hasPending && (
                            <span className="ml-2 text-amber-600 font-semibold">
                                • {pendingCount} thay đổi chưa lưu
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Huỷ thay đổi */}
                    {hasPending && (
                        <Btn variant="outline" onClick={() => setDiscardOpen(true)}>
                            <X size={14} />
                            Huỷ thay đổi
                        </Btn>
                    )}

                    {/* LƯU TẤT CẢ THAY ĐỔI */}
                    <Btn
                        variant={hasPending ? "primary" : "secondary"}
                        disabled={!hasPending || isSaving}
                        onClick={handleSaveAll}
                        className="relative"
                    >
                        {isSaving ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <Save size={15} />
                        )}
                        {isSaving ? "Đang lưu..." : "Lưu tất cả thay đổi"}
                        {hasPending && !isSaving && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center">
                                {pendingCount}
                            </span>
                        )}
                    </Btn>

                    <Btn onClick={openAdd}>
                        <Plus size={15} />
                        Thêm nguyên liệu
                    </Btn>
                    <Btn onClick={exportData}>
                        <FolderOpen size={15} />
                        Xuất JSON
                    </Btn>
                    <Btn onClick={triggerImport} disabled={isImporting}>
                        {isImporting ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                        {isImporting ? "Đang tải lên..." : "Tải lên JSON"}
                    </Btn>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        onChange={handleImportFile}
                        className="hidden"
                    />
                </div>
            </div>

            {/* Banner lỗi lưu */}
            {saveError && (
                <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <span>{saveError}</span>
                    <button onClick={clearSaveError} className="hover:opacity-70">
                        <X size={16} />
                    </button>
                </div>
            )}
            {importError && (
                <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <span>{importError}</span>
                    <button onClick={() => setImportError(null)} className="hover:opacity-70">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Legend pending */}
            {hasPending && (
                <div className="flex items-center gap-4 text-xs text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-2.5">
                    <span className="font-semibold text-gray-600">Trạng thái chưa lưu:</span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded border-l-2 border-green-400 bg-green-50 inline-block" />
                        Mới thêm ({pendingChanges.added.length})
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded border-l-2 border-amber-400 bg-amber-50 inline-block" />
                        Đã sửa ({pendingChanges.updated.length})
                    </span>
                    <span className="flex items-center gap-1.5 text-red-500">
                        Sẽ xóa ({pendingChanges.deleted.length})
                    </span>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm nguyên liệu..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm">Đang tải nguyên liệu...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-green-50 border-b border-green-100">
                                    {["STT", "Tên nguyên liệu", "Số lượng", "ĐV nhỏ", "ĐV lớn", "Giá/ĐVL", "Hạn SD", "Ghi chú", "Cần bổ sung", ""].map(
                                        (h, i) => (
                                            <th key={i} className="px-4 py-3 text-left text-xs font-bold text-green-800 whitespace-nowrap">
                                                {h}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((ing) => {
                                    const status = getRowStatus(ing);
                                    return (
                                        <tr
                                            key={ing._id}
                                            className={`border-t border-gray-50 hover:brightness-95 transition-all ${rowStatusStyle[status]}`}
                                        >
                                            <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    {ing.displayOrder}
                                                    {rowStatusBadge[status]}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-gray-800">{ing.ingredientName}</td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-700">{ing.quantity.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-gray-500">{ing.smallUnit}</td>
                                            <td className="px-4 py-3 text-gray-500">{ing.largeUnit}</td>
                                            <td className="px-4 py-3 font-mono text-right text-gray-700">{fmtVND(ing.pricePerLargeUnit)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ing.expiryDays <= 1
                                                    ? "bg-red-100 text-red-600"
                                                    : ing.expiryDays <= 7
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-green-100 text-green-700"
                                                    }`}>
                                                    {ing.expiryDays}d
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 text-xs max-w-32 truncate">{ing.note || "—"}</td>
                                            <td className="px-4 py-3">
                                                {ing.needContinuousRestock ? (
                                                    <span className="flex items-center gap-1 text-xs font-semibold text-orange-600">
                                                        <AlertTriangle size={12} />Có
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Không</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1.5">
                                                    <Btn sm variant="secondary" onClick={() => openEdit(ing)}>
                                                        <Edit2 size={12} />
                                                    </Btn>
                                                    <Btn sm variant="danger" onClick={() => setDeleteId(ing._id)}>
                                                        <Trash2 size={12} />
                                                    </Btn>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="text-center py-12 text-gray-400 text-sm">
                                            Không tìm thấy nguyên liệu nào
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Thêm / Sửa */}
            <Modal
                open={!!modal}
                onClose={closeModal}
                title={modal === "add" ? "Thêm nguyên liệu mới" : "Chỉnh sửa nguyên liệu"}
            >
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        <FormInput label="Tên nguyên liệu *" value={form.ingredientName} onChange={(e) => setField("ingredientName", e.target.value)} />
                    </div>
                    <FormInput label="Số thứ tự" type="number" value={form.displayOrder} onChange={(e) => setField("displayOrder", +e.target.value)} />
                    <FormInput label="Số lượng" type="number" value={form.quantity} onChange={(e) => setField("quantity", +e.target.value)} />
                    <FormInput label="Đơn vị nhỏ" value={form.smallUnit} onChange={(e) => setField("smallUnit", e.target.value)} />
                    <FormInput label="Đơn vị lớn" value={form.largeUnit} onChange={(e) => setField("largeUnit", e.target.value)} />
                    <FormInput label="Giá / ĐVL (₫)" type="number" value={form.pricePerLargeUnit} onChange={(e) => setField("pricePerLargeUnit", +e.target.value)} />
                    <FormInput label="Hạn sử dụng (ngày)" type="number" value={form.expiryDays} onChange={(e) => setField("expiryDays", +e.target.value)} />
                    <div className="col-span-2">
                        <FormInput label="Ghi chú" value={form.note} onChange={(e) => setField("note", e.target.value)} />
                    </div>
                    <div className="col-span-2 flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            id="rst"
                            checked={form.needContinuousRestock}
                            onChange={(e) => setField("needContinuousRestock", e.target.checked)}
                            className="accent-green-500 w-4 h-4 rounded"
                        />
                        <label htmlFor="rst" className="text-sm font-medium text-gray-600">
                            Cần bổ sung liên tục
                        </label>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
                    <Btn variant="outline" onClick={closeModal}>Hủy</Btn>
                    <Btn onClick={handleSave}>
                        <Check size={14} />
                        {modal === "add" ? "Thêm vào danh sách" : "Cập nhật"}
                    </Btn>
                </div>
            </Modal>

            {/* Modal Xác nhận xóa */}
            <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Xác nhận xóa">
                <p className="text-sm text-gray-600">
                    Nguyên liệu sẽ bị đánh dấu xóa và sẽ được xóa khỏi database khi bạn nhấn{" "}
                    <strong>Lưu tất cả thay đổi</strong>.
                </p>
                <div className="flex justify-end gap-2 mt-5">
                    <Btn variant="outline" onClick={() => setDeleteId(null)}>Hủy</Btn>
                    <Btn variant="danger" onClick={handleDelete}>
                        <Trash2 size={14} />
                        Xác nhận xóa
                    </Btn>
                </div>
            </Modal>

            {/* Modal Huỷ thay đổi */}
            <Modal open={discardOpen} onClose={() => setDiscardOpen(false)} title="Huỷ tất cả thay đổi?">
                <p className="text-sm text-gray-600">
                    Tất cả {pendingCount} thay đổi chưa lưu sẽ bị huỷ và dữ liệu sẽ được tải lại từ server.
                </p>
                <div className="flex justify-end gap-2 mt-5">
                    <Btn variant="outline" onClick={() => setDiscardOpen(false)}>Không</Btn>
                    <Btn variant="danger" onClick={async () => { await discardChanges(); setDiscardOpen(false); }}>
                        <RefreshCw size={14} />
                        Huỷ thay đổi &amp; tải lại
                    </Btn>
                </div>
            </Modal>
        </div>
    );
}