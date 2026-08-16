import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { View, Text, FlatList, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RotateCcw, Cherry } from "lucide-react-native";
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";
import FruitPickCard from "../components/fruit/FruitPickCard";
import ComboSuggestions from "../components/fruit/ComboSuggestions";
import FruitMixBar from "../components/fruit/FruitMixBar";
import FlyingFruit from "../components/fruit/FlyingFruit";
import { useFruits } from "../hooks/useFruits";
import { useCart } from "../context/CartContext";
import { useGlobal } from "../context/GlobalContext";
import { getComboFoods } from "../api/fruitApi";
import {
  FRUIT_COMBO_PRICE,
  findMatchingCombos,
  findExactCombo,
  normalizeText,
} from "../utils/fruit";
import { formatCurrency } from "../utils/formatCurrency";
import { COLORS } from "../theme/tokens";

const FLIGHT_CLEANUP_MS = 500;
const GRID_COLUMNS = 3;

/**
 * Port từ src/pages/FruitPage.jsx bản web. Giao diện/hành vi giữ nguyên:
 * chọn đúng 3 loại trái cây, gợi ý combo có sẵn, thanh mix + hiệu ứng "bay".
 * Khác biệt kỹ thuật (không phải hành vi):
 *   - Toạ độ bay lấy qua measureInWindow thay vì getBoundingClientRect (xem
 *     FruitPickCard.jsx, FruitMixBar.jsx, FlyingFruit.jsx).
 *   - Overlay FlyingFruit đặt trong 1 <Modal transparent> để toạ độ window
 *     luôn đúng bất kể FruitScreen đang lồng bao sâu trong navigator/tab.
 *   - Gọi API /api/fruits/combo qua api/fruitApi.js (getComboFoods) thay vì
 *     fetch() trực tiếp như bản web, cho nhất quán với các hàm api khác.
 *   - Hành vi cuối (thêm vào giỏ hàng chung, KHÔNG gửi thẳng đơn) giữ nguyên
 *     y hệt bản web — chỉ khác cách port ở trên.
 */
export default function FruitScreen() {
  const insets = useSafeAreaInsets();
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

  const fetchCombos = useCallback(async () => {
    try {
      setLoadingCombos(true);
      setErrorCombos(null);
      const data = await getComboFoods();
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

  const availableFruitNames = useMemo(
    () => new Set(fruits.filter((f) => f.isAvailable).map((f) => normalizeText(f.fruitName))),
    [fruits]
  );

  const availableCombos = useMemo(
    () =>
      comboFoods.filter((c) =>
        c.comboParts.every((part) => availableFruitNames.has(normalizeText(part)))
      ),
    [comboFoods, availableFruitNames]
  );

  const suggestedCombos = useMemo(() => {
    if (selected.length === 0 || selected.length === 3) return [];
    return findMatchingCombos(availableCombos, selectedNames);
  }, [availableCombos, selectedNames, selected.length]);

  const matchedCombo = useMemo(
    () => findExactCombo(availableCombos, selectedNames),
    [availableCombos, selectedNames]
  );

  const totalPrice = FRUIT_COMBO_PRICE * quantity;
  const ready = selected.length === 3;

  // rect = { x, y, width, height } đo được ngay tại thẻ vừa bấm (từ
  // FruitPickCard, xem component đó) — đo tiếp toạ độ slot đích rồi mới
  // dựng flight, vì slot đích cần đo LÚC BAY chứ không đo trước.
  const flyToSlot = useCallback((rect, targetIndex, item) => {
    const slotNode = slotRefs.current[targetIndex];
    if (!rect || !slotNode) return;
    slotNode.measureInWindow((x, y, width, height) => {
      const key = Date.now();
      setFlight({
        key,
        item,
        from: rect,
        to: { x, y, width, height },
      });
      setTimeout(() => setFlight((cur) => (cur?.key === key ? null : cur)), FLIGHT_CLEANUP_MS);
    });
  }, []);

  const handleToggle = useCallback(
    (item, rect) => {
      const itemId = item.id || item._id;
      const exists = selected.some((p) => (p.id || p._id) === itemId);
      if (exists) {
        setSelected((prev) => prev.filter((p) => (p.id || p._id) !== itemId));
        return;
      }
      if (selected.length >= 3) return;
      flyToSlot(rect, selected.length, item);
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
      if (resolved.some((r) => !r || !r.isAvailable)) {
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
      <View className="flex-1 items-center justify-center gap-3 py-16 px-6">
        <Text className="text-steel text-sm text-center">Không tải được dữ liệu. Vui lòng thử lại.</Text>
        <Button variant="outline" icon={RotateCcw} iconColor={COLORS.ink} onPress={refetch}>
          Thử lại
        </Button>
      </View>
    );
  }
  if (fruits.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-steel text-sm text-center">Hiện chưa có loại trái cây nào.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper">
      <FlatList
        data={fruits}
        keyExtractor={(item) => item.id || item._id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 240 + insets.bottom }}
        ListHeaderComponent={
          <View className="px-4 pt-4 pb-3">
            <View className="flex-row items-center gap-2 mb-1.5">
              <Cherry size={17} color={COLORS.chili} />
              <Text className="font-display font-semibold text-ink text-[15px]">Mix combo trái cây</Text>
            </View>
            <Text className="text-steel text-xs leading-relaxed">
              Chọn đúng 3 loại trái cây bạn thích để ghép combo riêng — nếu trùng combo có sẵn
              trong thực đơn, bọn mình sẽ báo ngay bên dưới. Mỗi phần combo đồng giá{" "}
              {FRUIT_COMBO_PRICE.toLocaleString("vi-VN")}đ.
            </Text>
          </View>
        }
        ListFooterComponent={
          <ComboSuggestions combos={suggestedCombos} onPick={handlePickCombo} />
        }
        renderItem={({ item }) => {
          const itemId = item.id || item._id;
          const isSelected = selected.some((s) => (s.id || s._id) === itemId);
          return (
            <View style={{ flex: 1 / GRID_COLUMNS }}>
              <FruitPickCard
                item={item}
                selected={isSelected}
                disabled={selected.length >= 3}
                onToggle={handleToggle}
              />
            </View>
          );
        }}
      />

      <View className="absolute inset-x-0" style={{ bottom: 0 }}>
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
      </View>

      {/* Modal trong suốt: đảm bảo FlyingFruit luôn định vị theo TOÀN cửa sổ,
          bất kể FruitScreen đang lồng sâu bao nhiêu trong Tab/Stack navigator. */}
      <Modal transparent visible={Boolean(flight)} animationType="none">
        <View pointerEvents="none" className="flex-1">
          {flight && <FlyingFruit flight={flight} />}
        </View>
      </Modal>
    </View>
  );
}
