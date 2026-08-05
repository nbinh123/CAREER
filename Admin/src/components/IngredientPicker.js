// components/IngredientPicker.jsx
import { useState, useEffect, useMemo } from "react";
import { Plus, Search, ChevronDown, Minus, X } from "lucide-react";
import fmtVND from "../utils/fmtVND";
import IngredientService from "../service/IngredientService";

/**
 * Bộ chọn nguyên liệu dùng chung — được dùng bởi:
 *   - MenuPage (form Món ăn)
 *   - FruitPage (form Trái cây, form Combo trái cây mix)
 *
 * Props:
 *   selectedIngredients : [{ ingredientId, ingredientName, unit, quantity, cost, image, _costPerUnit }]
 *   onChange            : (newList) => void
 */
export default function IngredientPicker({ selectedIngredients, onChange }) {
    const [allIngredients, setAllIngredients] = useState([]);
    const [fetchStatus, setFetchStatus] = useState("idle"); // idle|loading|error
    const [ingSearch, setIngSearch] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        setFetchStatus("loading");
        IngredientService.getAllIngredients()
            .then(data => { setAllIngredients(data); setFetchStatus("idle"); })
            .catch(() => setFetchStatus("error"));
    }, []);

    const selectedIds = useMemo(
        () => new Set(selectedIngredients.map(i => i.ingredientId)),
        [selectedIngredients]
    );

    const filteredOptions = useMemo(() =>
        allIngredients.filter(ing =>
            !selectedIds.has(ing._id) &&
            ing.ingredientName.toLowerCase().includes(ingSearch.toLowerCase())
        ),
        [allIngredients, selectedIds, ingSearch]
    );

    const addIngredient = ing => {
        // 1 đơn vị lớn (pricePerLargeUnit) = baseQty đơn vị nhỏ
        // => giá 1 đơn vị nhỏ = pricePerLargeUnit / baseQty
        const baseQty = ing.quantity > 0 ? ing.quantity : 1;
        const pricePerLargeUnit = ing.pricePerLargeUnit ?? ing.cost ?? 0;
        const unitPrice = pricePerLargeUnit / baseQty;

        onChange([...selectedIngredients, {
            ingredientId: ing._id,
            ingredientName: ing.ingredientName,
            largeUnit: ing.largeUnit,
            smallUnit: ing.smallUnit,
            image: ing.imageUrl ?? null,
            quantity: 1,            // số lượng đơn vị nhỏ dùng trong món
            unitQuantity: baseQty,  // lưu lại để tính giá đúng khi đổi số lượng
            cost: unitPrice * 1,
            pricePerLargeUnit,
            unit: ing.smallUnit,
        }]);
        setIngSearch("");
        setDropdownOpen(false);
    };

    const updateQty = (ingredientId, qty) => {
        const safeQty = Math.max(0, Number(qty) || 0);
        onChange(
            selectedIngredients.map(row => {
                if (row.ingredientId !== ingredientId) return row;
                const baseQty = row.unitQuantity > 0 ? row.unitQuantity : 1;
                const unitPrice = (row.pricePerLargeUnit || 0) / baseQty;
                return { ...row, quantity: safeQty, cost: unitPrice * safeQty };
            })
        );
    };

    const removeIngredient = ingredientId =>
        onChange(selectedIngredients.filter(r => r.ingredientId !== ingredientId));

    const totalCost = selectedIngredients.reduce((s, r) => s + (r.cost || 0), 0);
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nguyên liệu</label>
                {selectedIngredients.length > 0 && (
                    <span className="text-xs text-gray-500">
                        Tổng: <span className="font-bold text-green-600">{fmtVND(totalCost)}</span>
                    </span>
                )}
            </div>

            {/* Dropdown */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setDropdownOpen(o => !o)}
                    className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-400 hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-300 transition-colors"
                >
                    <span className="flex items-center gap-2"><Plus size={14} />Thêm nguyên liệu…</span>
                    <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {dropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    autoFocus
                                    value={ingSearch}
                                    onChange={e => setIngSearch(e.target.value)}
                                    placeholder="Tìm nguyên liệu..."
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
                                />
                            </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                            {fetchStatus === "loading" && <p className="text-xs text-gray-400 text-center py-4">Đang tải…</p>}
                            {fetchStatus === "error" && <p className="text-xs text-red-400 text-center py-4">Không tải được nguyên liệu</p>}
                            {fetchStatus === "idle" && filteredOptions.length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-4">
                                    {ingSearch ? "Không tìm thấy" : "Đã chọn hết"}
                                </p>
                            )}
                            {filteredOptions.map(ing => (
                                <button key={ing._id} type="button" onClick={() => addIngredient(ing)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-green-50 transition-colors text-left">
                                    {ing.imageUrl
                                        ? <img src={ing.imageUrl} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                                        : <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-300 text-xs font-bold">{ing.ingredientName?.[0]}</div>
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-800 truncate">{ing.ingredientName}</p>
                                        <p className="text-xs text-gray-400">{fmtVND(ing.pricePerLargeUnit || 222)}/ {ing.quantity} {ing.smallUnit}{ing.largeUnit !== "x" ? ("/ 1" + ing.largeUnit) : ""}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Danh sách đã chọn */}
            {selectedIngredients.length > 0 && (
                <div className="space-y-1.5">
                    {selectedIngredients.map(row => (
                        <div key={row.ingredientId} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                            {row.imageUrl
                                ? <img src={row.imageUrl} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
                                : <div className="w-6 h-6 rounded-md bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-400 text-[10px] font-bold">{row.ingredientName?.[0]}</div>
                            }
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-700 truncate">{row.ingredientName}</p>
                                <p className="text-[11px] text-gray-400">{fmtVND(row.cost)}/{row.quantity} {row.smallUnit || row.unit || ""}
                                    {row.largeUnit && row.largeUnit !== "x"
                                        ? `/ 1 ${row.largeUnit}`
                                        : ""}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button type="button"
                                    onClick={() => updateQty(row.ingredientId, row.quantity - 1)}
                                    className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                                    <Minus size={10} />
                                </button>
                                <input
                                    type="number" min="0"
                                    value={row.quantity}
                                    onChange={e => updateQty(row.ingredientId, e.target.value)}
                                    className="w-12 text-center text-xs font-semibold border border-gray-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-green-300"
                                />
                                <span className="text-[11px] text-gray-400 w-8 truncate">{row.smallUnit}</span>
                            </div>
                            <button type="button" onClick={() => removeIngredient(row.ingredientId)}
                                className="text-red-300 hover:text-red-500 transition-colors flex-shrink-0">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <div className="flex justify-between items-center pt-1 px-1">
                        <span className="text-xs text-gray-500">{selectedIngredients.length} nguyên liệu</span>
                        <span className="text-sm font-bold text-green-600">{fmtVND(totalCost)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}