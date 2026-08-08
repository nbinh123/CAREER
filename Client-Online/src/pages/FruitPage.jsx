import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { RotateCcw, Cherry } from "lucide-react";
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";
import FruitPickCard from "../components/fruit/FruitPickCard";
import ComboSuggestions from "../components/fruit/ComboSuggestions";
import FruitMixBar from "../components/fruit/FruitMixBar";
import FlyingFruit from "../components/fruit/FlyingFruit";
import { useFruits } from "../hooks/useFruits";
import { useCart } from "../context/CartContext";
import { useGlobal } from "../context/GlobalContext";
import { API_URL } from "../config/api";
import {
  FRUIT_COMBO_PRICE,
  findMatchingCombos,
  findExactCombo,
  normalizeText,
} from "../utils/fruit";

const FLIGHT_CLEANUP_MS = 500;

// Giao diện của trang này giữ NGUYÊN so với bản gọi món tại bàn (lưới chọn
// trái cây, gợi ý combo, thanh mix + animation "bay" vào ô chọn). Khác biệt
// DUY NHẤT: khi ghép đủ 3 loại khớp 1 combo có sẵn trong thực đơn, bấm nút
// giờ THÊM combo đó vào giỏ hàng chung (CartContext) thay vì gửi thẳng đơn
// lên server — khách gộp chung với các món ăn khác rồi mới đặt hàng 1 lần ở
// CartDrawer (kèm tên/SĐT/địa chỉ/ghi chú).
export default function FruitPage() {
  const { fruits, loading: loadingFruits, error: errorFruits, refetch: refetchFruits } = useFruits();
  const { addItem } = useCart();
  const { showToast } = useGlobal();

  const [selected, setSelected] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [flight, setFlight] = useState(null);

  const [comboFoods, setComboFoods] = useState([]);
  const [loadingCombos, setLoadingCombos] = useState(true);
  const [errorCombos, setErrorCombos] = useState(null);

  const slotRefs = useRef([null, null, null]);
  const registerSlotRef = useCallback((index, node) => {
    slotRefs.current[index] = node;
  }, []);

  // Lấy combo có sẵn trong thực đơn từ API /api/fruits/combo
  const fetchCombos = useCallback(async () => {
    try {
      setLoadingCombos(true);
      setErrorCombos(null);
      const res = await fetch(`${API_URL}/api/fruits/combo`);
      if (!res.ok) throw new Error("Lỗi tải combo");
      const json = await res.json();
      const data = json.data || []; // API trả về { success, count, data }
      const normalized = data.map((c) => ({
        ...c,
        id: c._id || c.id,
        comboParts: (c.foodName || "")
          .split("-")
          .map((s) => s.trim())
          .filter(Boolean),
      }));
      setComboFoods(normalized);
    } catch (err) {
      setErrorCombos(err.message);
    } finally {
      setLoadingCombos(false);
    }
  }, []);

  useEffect(() => {
    fetchCombos();
  }, [fetchCombos]);

  const loading = loadingFruits || loadingCombos;
  const error = errorFruits || errorCombos;
  const refetch = () => {
    refetchFruits();
    fetchCombos();
  };

  const selectedNames = useMemo(() => selected.map((s) => s.fruitName), [selected]);

  const suggestedCombos = useMemo(() => {
    if (selected.length === 0 || selected.length === 3) return [];
    return findMatchingCombos(comboFoods, selectedNames);
  }, [comboFoods, selectedNames, selected.length]);

  const matchedCombo = useMemo(
    () => findExactCombo(comboFoods, selectedNames),
    [comboFoods, selectedNames]
  );

  const totalPrice = FRUIT_COMBO_PRICE * quantity;
  const ready = selected.length === 3;

  const flyToSlot = useCallback((cardEl, targetIndex, item) => {
    const slotEl = slotRefs.current[targetIndex];
    if (!cardEl || !slotEl) return;
    const from = cardEl.getBoundingClientRect();
    const to = slotEl.getBoundingClientRect();
    const key = Date.now();
    setFlight({
      key,
      item,
      from: { top: from.top, left: from.left, width: from.width, height: from.height },
      to: { top: to.top, left: to.left, width: to.width, height: to.height },
    });
    setTimeout(() => setFlight((cur) => (cur?.key === key ? null : cur)), FLIGHT_CLEANUP_MS);
  }, []);

  const handleToggle = useCallback(
    (item, event) => {
      const itemId = item.id || item._id;
      const exists = selected.some((p) => (p.id || p._id) === itemId);
      if (exists) {
        setSelected((prev) => prev.filter((p) => (p.id || p._id) !== itemId));
        return;
      }
      if (selected.length >= 3) return;
      flyToSlot(event?.currentTarget, selected.length, item);
      setSelected((prev) => [...prev, item]);
    },
    [selected, flyToSlot]
  );

  const handleRemove = useCallback((item) => {
    setSelected((prev) => prev.filter((p) => (p.id || p._id) !== (item.id || item._id)));
  }, []);

  const handlePickCombo = useCallback(
    (combo) => {
      const resolved = combo.comboParts.map((part) =>
        fruits.find((f) => normalizeText(f.fruitName) === normalizeText(part))
      );
      if (resolved.some((r) => !r)) {
        showToast("Combo này có loại trái cây không còn bán, bạn tự chọn giúp mình nhé.");
        return;
      }
      setSelected(resolved);
    },
    [fruits, showToast]
  );

  const handleAddToCart = useCallback(() => {
    if (!ready) return;
    if (!matchedCombo) {
      showToast("Tổ hợp này chưa có trong thực đơn, bạn chọn 1 trong các combo gợi ý bên dưới giúp mình nhé.");
      return;
    }
    const targetFoodId = matchedCombo.id || matchedCombo._id;
    // Giá luôn CỐ ĐỊNH FRUIT_COMBO_PRICE (không lấy originalPrice của Food
    // document), khớp nguyên tắc "đồng giá mọi combo" của bản gốc — server
    // khi xử lý đơn thật cũng cần tự áp giá này, không tin số FE gửi lên.
    addItem(
      { id: targetFoodId, foodName: matchedCombo.foodName, originalPrice: FRUIT_COMBO_PRICE },
      quantity
    );
    showToast(`Đã thêm ${matchedCombo.foodName} vào giỏ hàng!`);
    setSelected([]);
    setQuantity(1);
  }, [ready, matchedCombo, quantity, addItem, showToast]);

  if (loading) return <Loading label="Đang tải danh sách trái cây..." />;
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
        <p className="text-steel text-sm">Không tải được dữ liệu. Vui lòng thử lại.</p>
        <Button variant="outline" icon={RotateCcw} onClick={refetch}>
          Thử lại
        </Button>
      </div>
    );
  }
  if (fruits.length === 0) {
    return <p className="text-steel text-sm text-center py-16 px-6">Hiện chưa có loại trái cây nào.</p>;
  }

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1.5">
          <Cherry size={17} className="text-chili" />
          <h2 className="font-display font-semibold text-ink text-[15px]">Mix combo trái cây</h2>
        </div>
        <p className="text-steel text-xs leading-relaxed">
          Chọn đúng 3 loại trái cây bạn thích để ghép combo riêng — nếu trùng combo có sẵn trong thực
          đơn, bọn mình sẽ báo ngay bên dưới. Mỗi phần combo đồng giá{" "}
          {FRUIT_COMBO_PRICE.toLocaleString("vi-VN")}đ.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-4 pb-4">
        {fruits.map((item) => {
          const itemId = item.id || item._id;
          const isSelected = selected.some((s) => (s.id || s._id) === itemId);
          return (
            <FruitPickCard
              key={itemId}
              item={item}
              selected={isSelected}
              disabled={selected.length >= 3}
              onToggle={handleToggle}
            />
          );
        })}
      </div>

      <ComboSuggestions combos={suggestedCombos} onPick={handlePickCombo} />

      <div className="h-56" />

      <div className="fixed inset-x-0 z-30" style={{ bottom: "4rem" }}>
        <FruitMixBar
          selected={selected}
          onRemove={handleRemove}
          quantity={quantity}
          onQuantityChange={setQuantity}
          matchedCombo={matchedCombo}
          registerSlotRef={registerSlotRef}
          ready={ready}
          totalPrice={totalPrice}
          onAddToCart={handleAddToCart}
        />
      </div>

      {flight && <FlyingFruit flight={flight} />}
    </div>
  );
}
