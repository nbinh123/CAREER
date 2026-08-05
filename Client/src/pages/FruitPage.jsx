import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { RotateCcw, Cherry } from "lucide-react";
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";
import FruitPickCard from "../components/fruit/FruitPickCard";
import ComboSuggestions from "../components/fruit/ComboSuggestions";
import FruitMixBar from "../components/fruit/FruitMixBar";
import FlyingFruit from "../components/fruit/FlyingFruit";
import { useFruits } from "../hooks/useFruits";
import { useGuest } from "../context/GuestContext";
import { useSocket } from "../context/SocketContext";
import { useGlobal } from "../context/GlobalContext";
import { API_URL } from "../config/api";
import {
  FRUIT_COMBO_PRICE,
  MIX_CATEGORY,
  findMatchingCombos,
  findExactCombo,
  normalizeText,
} from "../utils/fruit";

const FLIGHT_CLEANUP_MS = 500;

export default function FruitPage() {
  const { fruits, loading: loadingFruits, error: errorFruits, refetch: refetchFruits } = useFruits();
  const { guest } = useGuest();
  const { sendOrder } = useSocket();  // dùng sendOrder thay vì sendFruitOrder
  const { showToast } = useGlobal();

  const [selected, setSelected] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [flight, setFlight] = useState(null);

  const [comboFoods, setComboFoods] = useState([]);
  const [loadingCombos, setLoadingCombos] = useState(true);
  const [errorCombos, setErrorCombos] = useState(null);

  const slotRefs = useRef([null, null, null]);
  const registerSlotRef = useCallback((index, node) => {
    slotRefs.current[index] = node;
  }, []);

  // Lấy combo từ API /api/fruits/combo
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

  const handleSubmit = useCallback(async () => {
    if (!ready) return;
    if (!matchedCombo) {
      showToast("Tổ hợp này chưa có trong thực đơn, bạn chọn 1 trong các combo gợi ý bên dưới giúp mình nhé.");
      return;
    }
    const targetFoodId = matchedCombo.id || matchedCombo._id;
    setSubmitting(true);
    try {
      const note = selected.map((f) => f.fruitName).join(" - ");
      await sendOrder([{ id: targetFoodId, qty: quantity, note }]);

      showToast("Đã gửi đơn trái cây tới nhà hàng!");
      setSelected([]);
      setQuantity(1);
    } catch (err) {
      showToast("Gửi đơn thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }, [ready, matchedCombo, selected, quantity, sendOrder, showToast]);

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
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      </div>

      {flight && <FlyingFruit flight={flight} />}
    </div>
  );
}