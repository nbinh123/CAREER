import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RotateCcw, X, Minus, Plus } from "lucide-react-native";
import CategoryTabs from "../components/menu/CategoryTabs";
import MenuItemCard from "../components/menu/MenuItemCard";
import FoodThumbnail from "../components/menu/FoodThumbnail";
import CartFloatingButton from "../components/cart/CartFloatingButton";
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";
import DashedDivider from "../components/common/DashedDivider";
import { useFoods } from "../hooks/useFoods";
import { useFruits } from "../hooks/useFruits";
import { getBestSellerIds } from "../utils/bestSellers";
import { formatCurrency } from "../utils/formatCurrency";
import { isComboFoodItem } from "../utils/fruit";
import { useCart } from "../context/CartContext";
import { useGlobal } from "../context/GlobalContext";
import { COLORS } from "../theme/tokens";

// Port từ src/pages/MenuPage.jsx bản web. Đổi chính:
//   - Modal chi tiết món: web tự dựng overlay bằng <div> cố định; RN dùng
//     <Modal transparent animationType="fade"> có sẵn, khoá back-gesture
//     Android tự động theo onRequestClose.
//   - Danh sách món: web render <div> phẳng trong 1 trang cuộn dài; RN dùng
//     FlatList (ảo hoá danh sách) để mượt hơn khi menu dài.
//   - CategoryTabs không còn `sticky` CSS — đặt NGOÀI FlatList (không cuộn
//     cùng) để tự nhiên "dính" phía trên, đúng hành vi web.
//   - Không còn CartDrawer nhúng trực tiếp ở đây: CartFloatingButton giờ
//     điều hướng sang tab Giỏ hàng riêng (xem component đó để biết vì sao).
const OTHER_CATEGORY_ID = "__khac__";

function getCategoryKey(item) {
  const raw = (item.categoryId || "").trim();
  return raw || OTHER_CATEGORY_ID;
}

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const { showToast } = useGlobal();
  const { foods: allFoods, loading, error, refetch } = useFoods();
  const { fruits } = useFruits();

  const foods = useMemo(
    () => allFoods.filter((item) => !isComboFoodItem(item, fruits)),
    [allFoods, fruits]
  );

  useEffect(() => {
    setQty(1);
  }, [selectedItem]);

  const unavailable = selectedItem ? !selectedItem.isAvailable : false;

  const categories = useMemo(() => {
    const seen = new Map();
    foods.forEach((item) => {
      const key = getCategoryKey(item);
      if (!seen.has(key)) {
        seen.set(key, key === OTHER_CATEGORY_ID ? "Khác" : item.categoryId.trim());
      }
    });
    const list = Array.from(seen, ([id, label]) => ({ id, label }));
    list.sort((a, b) => {
      if (a.id === OTHER_CATEGORY_ID) return 1;
      if (b.id === OTHER_CATEGORY_ID) return -1;
      return a.label.localeCompare(b.label, "vi");
    });
    return list;
  }, [foods]);

  useEffect(() => {
    if (categories.length === 0) return;
    if (!activeCategory || !categories.some((c) => c.id === activeCategory)) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  const bestSellerIds = useMemo(() => getBestSellerIds(foods), [foods]);

  const filteredItems = useMemo(
    () =>
      foods
        .filter((item) => getCategoryKey(item) === activeCategory)
        .sort((a, b) => Number(!a.isAvailable) - Number(!b.isAvailable)),
    [foods, activeCategory]
  );

  const handleQuickAdd = (item) => {
    if (!item.isAvailable) return;
    addItem(item, 1);
    showToast(`Đã thêm ${item.foodName}`);
  };

  if (loading) return <Loading label="Đang tải thực đơn..." />;

  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-3 py-16 px-6">
        <Text className="text-steel text-sm text-center">Không tải được thực đơn. Vui lòng thử lại.</Text>
        <Button variant="outline" icon={RotateCcw} iconColor={COLORS.ink} onPress={refetch}>
          Thử lại
        </Button>
      </View>
    );
  }

  if (categories.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-steel text-sm text-center">Thực đơn hiện chưa có món nào.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper">
      <CategoryTabs categories={categories} activeId={activeCategory} onChange={setActiveCategory} />

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id || item._id}
        renderItem={({ item }) => (
          <MenuItemCard
            item={item}
            isBestSeller={bestSellerIds.has(item.id || item._id)}
            onOpen={setSelectedItem}
            onQuickAdd={handleQuickAdd}
          />
        )}
        contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
        ListEmptyComponent={
          <Text className="text-steel text-sm text-center py-14">Danh mục này chưa có món nào.</Text>
        }
      />

      {/* Modal chi tiết món — tương đương overlay <div> cố định bên web */}
      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View className="flex-1 justify-center px-4 py-8" style={{ backgroundColor: "rgba(34,27,20,0.5)" }}>
          <Pressable className="absolute inset-0" onPress={() => setSelectedItem(null)} />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="bg-paper rounded-ticket max-h-[88%] self-center w-full max-w-md"
          >
            {selectedItem && (
              <>
                <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
                  <Text className="font-display font-semibold text-lg text-ink flex-shrink pr-3">
                    {selectedItem.foodName}
                  </Text>
                  <Pressable
                    onPress={() => setSelectedItem(null)}
                    accessibilityLabel="Đóng"
                    className="p-1.5 rounded-full"
                  >
                    <X size={20} color={COLORS.steel} />
                  </Pressable>
                </View>

                <ScrollView className="px-6" contentContainerStyle={{ paddingBottom: 24 }}>
                  <FoodThumbnail
                    src={selectedItem.imageUrl}
                    alt={selectedItem.foodName}
                    className="w-full h-44 rounded-2xl mb-5"
                  />
                  <Text className="text-steel text-sm leading-relaxed mb-5">
                    {selectedItem.description}
                  </Text>

                  <View className="flex-row items-center justify-between mt-6">
                    <Text className="font-mono text-xl font-semibold text-chili-dark">
                      {formatCurrency(selectedItem.originalPrice)}
                    </Text>

                    {!unavailable && (
                      <View className="flex-row items-center gap-3 bg-paper-dim rounded-full px-2 py-1.5">
                        <Pressable
                          onPress={() => setQty((q) => Math.max(1, q - 1))}
                          accessibilityLabel="Giảm số lượng"
                          className="w-9 h-9 rounded-full bg-paper items-center justify-center"
                        >
                          <Minus size={16} color={COLORS.ink} />
                        </Pressable>
                        <Text className="font-mono w-8 text-center font-semibold text-base">{qty}</Text>
                        <Pressable
                          onPress={() => setQty((q) => q + 1)}
                          accessibilityLabel="Tăng số lượng"
                          className="w-9 h-9 rounded-full bg-ink items-center justify-center"
                        >
                          <Plus size={16} color={COLORS.paper} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </ScrollView>

                <View className="px-6 pt-4" style={{ paddingBottom: Math.max(24, insets.bottom) }}>
                  <DashedDivider className="mb-4" />
                  <Button
                    fullWidth
                    disabled={unavailable}
                    onPress={() => {
                      addItem(selectedItem, qty);
                      showToast(`Đã thêm ${selectedItem.foodName}`);
                      setSelectedItem(null);
                    }}
                  >
                    {unavailable
                      ? "Món hiện đang hết hàng"
                      : `Thêm vào giỏ · ${formatCurrency(selectedItem.originalPrice * qty)}`}
                  </Button>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <CartFloatingButton />
    </View>
  );
}
