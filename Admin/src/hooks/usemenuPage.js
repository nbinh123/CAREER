// hooks/useMenuPage.js
import { useState, useEffect, useRef, useCallback } from "react";
import useFoodZustand from "../zustand/useFoodZustand";

export const EMOJIS = ["🍜", "🍲", "🍱", "🍝", "🥗", "🧃", "🥟", "🍮", "🍛", "🥘", "🫕", "🧆"];

/**
 * Food rỗng mặc định khi mở form thêm mới.
 * categoryId sẽ được gán bằng categories[0]._id sau khi fetch xong.
 */
export const makeEmptyFood = (firstCategoryId = "") => ({
    foodName:         "",
    categoryId:       firstCategoryId,   // ObjectId string
    costPrice:        0,
    originalPrice:    0,
    aiTrainingWeight: 0,
    isAvailable:      true,
    emoji:            "🍜",
    imageUrl:         "",
    ingredients:      [],
});

/**
 * Tính biên lợi nhuận (%) từ virtual field do server trả về.
 * Model tính dựa trên discountedPrice (đã trừ ưu đãi danh mục),
 * không phải originalPrice — tránh tính sai khi có discount.
 *
 * food.profitMargin là số thực [0, 1].
 */
export function calcMarginPct(food) {
    if (typeof food.profitMargin === "number") {
        return Math.round(food.profitMargin * 100);
    }
    // Fallback khi chưa populate (hiếm gặp)
    if (!food.discountedPrice && food.originalPrice) {
        return Math.round((food.originalPrice - food.costPrice) / food.originalPrice * 100);
    }
    if (!food.discountedPrice) return 0;
    return Math.round((food.discountedPrice - food.costPrice) / food.discountedPrice * 100);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export default function useMenuPage() {
    const {
        foods, categories, loading, error,
        getFoods, getCategories,
        addFood, updateFood, removeFood,
        clearError,
    } = useFoodZustand();

    // ─── Filter / search ─────────────────────────────────────────────────────
    const [catFilter, setCatFilter] = useState(null);   // null = "Tất cả"
    const [search,    setSearch]    = useState("");

    /**
     * Filter theo categoryId._id (chính xác hơn so với so sánh tên string),
     * và tìm kiếm theo foodName.
     */
    const filteredFoods = foods.filter(fd => {
        const foodCatId = fd.categoryId?._id ?? fd.categoryId;
        const matchCat  = !catFilter || foodCatId === catFilter;
        const matchName = fd.foodName.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchName;
    });

    // ─── Modal ───────────────────────────────────────────────────────────────
    const [modal,   setModal]   = useState(null);   // "add" | "edit" | null
    const [editId,  setEditId]  = useState(null);
    const [form,    setForm]    = useState(() => makeEmptyFood());
    const [saving,  setSaving]  = useState(false);
    const [formError, setFormError] = useState("");

    // Ảnh
    const [imageFile,    setImageFile]    = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const imageInputRef = useRef(null);

    // ─── Fetch dữ liệu khi mount ─────────────────────────────────────────────
    useEffect(() => {
        getFoods();
        getCategories();
    }, [getFoods, getCategories]);

    // Đặt categoryId mặc định khi categories load xong (chỉ lần đầu)
    useEffect(() => {
        if (categories.length > 0 && !form.categoryId) {
            setForm(prev => ({ ...prev, categoryId: categories[0]._id }));
        }
    }, [categories]);  // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup objectURL
    useEffect(() => {
        return () => { if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview); };
    }, [imagePreview]);

    // ─── Handlers ────────────────────────────────────────────────────────────

    const setField = useCallback((key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleImageChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(prev => {
            if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    }, []);

    const openAdd = useCallback(() => {
        const defaultCatId = categories[0]?._id ?? "";
        setForm(makeEmptyFood(defaultCatId));
        setImageFile(null);
        setImagePreview("");
        setFormError("");
        setModal("add");
    }, [categories]);

    const openEdit = useCallback((food) => {
        // categoryId có thể là object đã populate → lấy _id string
        const catId = food.categoryId?._id ?? food.categoryId ?? "";
        setForm({ ...food, categoryId: catId });
        setEditId(food._id);
        setImageFile(null);
        setImagePreview(food.imageUrl || "");
        setFormError("");
        setModal("edit");
    }, []);

    const closeModal = useCallback(() => {
        setModal(null);
        setEditId(null);
        setImageFile(null);
        setImagePreview(prev => {
            if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
            return "";
        });
        setFormError("");
    }, []);

    const handleSave = useCallback(async () => {
        if (!form.foodName.trim())  { setFormError("Tên món không được để trống"); return; }
        if (!form.categoryId)       { setFormError("Vui lòng chọn danh mục");       return; }
        if (!form.originalPrice)    { setFormError("Giá bán không được để trống");  return; }

        setSaving(true);
        setFormError("");
        try {
            if (modal === "add") {
                await addFood(form, imageFile);
            } else {
                await updateFood({ ...form, _id: editId }, imageFile);
            }
            closeModal();
        } catch {
            setFormError("Lưu thất bại, vui lòng thử lại.");
        } finally {
            setSaving(false);
        }
    }, [form, imageFile, modal, editId, addFood, updateFood, closeModal]);

    const handleDelete = useCallback(async (id) => {
        if (!window.confirm("Xóa món ăn này?")) return;
        try { await removeFood(id); } catch { /* error in zustand state */ }
    }, [removeFood]);

    return {
        // data
        filteredFoods,
        categories,
        totalCount:     foods.length,
        availableCount: foods.filter(f => f.isAvailable).length,
        loading,
        error,
        clearError,

        // filter
        catFilter, setCatFilter,
        search,    setSearch,

        // modal
        modal,
        form, setField,
        saving, formError,

        // image
        imagePreview,
        imageInputRef,
        handleImageChange,

        // actions
        openAdd, openEdit, closeModal, handleSave, handleDelete,
    };
}