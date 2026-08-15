import React, { useState, useMemo, useEffect } from "react";
import { RotateCcw, X, Minus, Plus } from "lucide-react";
import CategoryTabs from "../components/menu/CategoryTabs";
import MenuItemCard from "../components/menu/MenuItemCard";
import FoodThumbnail from "../components/menu/FoodThumbnail";
import CartFloatingButton from "../components/cart/CartFloatingButton";
import CartDrawer from "../components/cart/CartDrawer";
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";
import { useFoods } from "../hooks/useFoods";
import { useFruits } from "../hooks/useFruits";
import { getBestSellerIds } from "../utils/bestSellers";
import { formatCurrency } from "../utils/formatCurrency";
import { isComboFoodItem } from "../utils/fruit";
import { useCart } from "../context/CartContext";
import { useGlobal } from "../context/GlobalContext";
import { useSocket } from "../context/SocketContext"; // ❗ MỚI

// Không dùng danh mục cứng nữa: `categoryId` trong Food document (Mongo) là
// chuỗi tên hiển thị tự do do người quản lý món tự đặt (vd "Tráng miệng",
// "Đồ chiên", "Lẩu"...), KHÔNG phải slug cố định như trước đây file
// data/mockMenu.js giả định ("khai-vi", "mon-chinh"...). Vì 2 danh sách
// không bao giờ khớp, filter theo danh mục cứng luôn trả về rỗng dù DB có
// món. Nhóm tab giờ được suy ra trực tiếp từ dữ liệu món ăn thật trả về từ
// /api/foods; món nào thiếu categoryId (null/rỗng) được gom vào nhóm "Khác".
const OTHER_CATEGORY_ID = "__khac__";

function getCategoryKey(item) {
  const raw = (item.categoryId || "").trim();
  return raw || OTHER_CATEGORY_ID;
}

// Trang này chỉ được render khi TableGuard.jsx đã xác nhận bàn có tồn tại
// VÀ active === true (xem components/table/TableGuard.jsx) — nên ở đây
// không cần tự kiểm tra lại trạng thái active của bàn nữa. Trước đây từng
// có 1 đoạn tự mở socket riêng + đọc tableId từ useGlobal() để tự kiểm tra,
// nhưng useGlobal() không hề có tableId nên đoạn đó luôn bị treo ở màn
// Loading vĩnh viễn — đã bỏ, thay bằng gác cổng tập trung ở TableGuard.
export default function OrderPage() {
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useGlobal();
  const { onOrderItemsRejected } = useSocket(); // ❗ MỚI
  const { foods: allFoods, loading, error, refetch } = useFoods();
  const { fruits } = useFruits();

  // ❗ MỚI — báo cho khách biết món nào vừa bị loại khỏi đơn do đã ngừng
  // bán, đúng lúc bấm "Gửi đơn" ở CartDrawer (server chặn ở send_to_kitchen).
  // Đặt ở đây (không phải CartDrawer) vì OrderPage là nơi sống suốt phiên
  // xem menu, còn CartDrawer có thể unmount khi đóng — subscribe ở đây đảm
  // bảo không bỏ lỡ sự kiện dù drawer đang đóng lúc server phản hồi.
  useEffect(() => {
    return onOrderItemsRejected((items) => {
      const names = items.map((i) => i.foodName).join(", ");
      showToast(`${names} vừa ngừng bán nên không thể gửi lên bếp — món này đã bị loại khỏi đơn, bạn kiểm tra lại giỏ hàng giúp mình nhé.`);
    });
  }, [onOrderItemsRejected, showToast]);

  // Combo trái cây có sẵn (Food document tên "A - B - C" khớp Fruit) chỉ
  // bán qua trang riêng /fruits, không hiển thị lẫn trong Thực đơn — lọc bỏ
  // ngay từ đây để danh mục (tabs) lẫn danh sách món bên dưới đều không thấy.
  const foods = useMemo(
    () => allFoods.filter((item) => !isComboFoodItem(item, fruits)),
    [allFoods, fruits]
  );

  // Reset số lượng mỗi khi mở món khác (kể cả đóng modal, item về null)
  useEffect(() => {
    setQty(1);
  }, [selectedItem]);

  // Khoá scroll nền khi modal chi tiết món đang mở (trước đây do Modal.jsx lo)
  useEffect(() => {
    if (!selectedItem) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedItem]);

  const unavailable = selectedItem ? !selectedItem.isAvailable : false;

  // Danh mục suy ra từ chính dữ liệu món ăn, giữ nguyên tên hiển thị trong DB
  const categories = useMemo(() => {
    const seen = new Map();
    foods.forEach((item) => {
      const key = getCategoryKey(item);
      if (!seen.has(key)) {
        seen.set(key, key === OTHER_CATEGORY_ID ? "Khác" : item.categoryId.trim());
      }
    });
    const list = Array.from(seen, ([id, label]) => ({ id, label }));
    // Nhóm "Khác" luôn xếp cuối, còn lại sắp theo alphabet tiếng Việt
    list.sort((a, b) => {
      if (a.id === OTHER_CATEGORY_ID) return 1;
      if (b.id === OTHER_CATEGORY_ID) return -1;
      return a.label.localeCompare(b.label, "vi");
    });
    return list;
  }, [foods]);

  // Chọn tab đầu tiên khi danh mục đã tải xong (hoặc khi tab đang chọn không
  // còn tồn tại nữa, vd món cuối cùng của danh mục đó bị xoá/đổi tên)
  useEffect(() => {
    if (categories.length === 0) return;
    if (!activeCategory || !categories.some((c) => c.id === activeCategory)) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // Bán chạy tính theo soldCount trên toàn menu, không phụ thuộc danh mục đang xem
  const bestSellerIds = useMemo(() => getBestSellerIds(foods), [foods]);

  const filteredItems = useMemo(
    () => foods.filter((item) => getCategoryKey(item) === activeCategory),
    [foods, activeCategory]
  );

  const handleQuickAdd = (item) => {
    if (!item.isAvailable) return;
    addItem(item, 1);
    showToast(`Đã thêm ${item.foodName}`);
  };

  if (loading) {
    return <Loading label="Đang tải thực đơn..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
        <p className="text-steel text-sm">Không tải được thực đơn. Vui lòng thử lại.</p>
        <Button variant="outline" icon={RotateCcw} onClick={refetch}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (categories.length === 0) {
    return <p className="text-steel text-sm text-center py-16 px-6">Thực đơn hiện chưa có món nào.</p>;
  }

  return (
    <div>
      <CategoryTabs categories={categories} activeId={activeCategory} onChange={setActiveCategory} />

      <div>
        {filteredItems.map((item) => (
          <MenuItemCard
            key={item.id || item._id}
            item={item}
            isBestSeller={bestSellerIds.has(item.id || item._id)}
            onOpen={setSelectedItem}
            onQuickAdd={handleQuickAdd}
          />
        ))}
        {filteredItems.length === 0 && (
          <p className="text-steel text-sm text-center py-14">Danh mục này chưa có món nào.</p>
        )}
      </div>

      {/* Modal chi tiết món — hard-code trực tiếp ở đây (không dùng lại
          MenuItemDetailModal.jsx) để dễ chỉnh sửa tại một nơi duy nhất. */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-ink/50 animate-fade-in"
            onClick={() => setSelectedItem(null)}
          />

          <div
            className="relative z-10 w-full max-w-md bg-paper rounded-ticket shadow-ticket max-h-[88vh] flex flex-col animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 perforated-top">
              <h3 className="font-display font-semibold text-lg text-ink">
                {selectedItem.foodName}
              </h3>

              <button
                onClick={() => setSelectedItem(null)}
                aria-label="Đóng"
                className="p-1.5 rounded-full text-steel hover:bg-ink/5 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <FoodThumbnail
                src={selectedItem.imageUrl}
                alt={selectedItem.foodName}
                className="w-full h-44 rounded-2xl mb-5"
              />

              <p className="text-steel text-sm leading-relaxed mb-5">
                {selectedItem.description}
              </p>

              <div className="flex items-center justify-between mt-6">
                <span className="ticket-num text-xl font-semibold text-chili-dark">
                  {formatCurrency(selectedItem.originalPrice)}
                </span>

                {!unavailable && (
                  <div className="flex items-center gap-3 bg-paper-dim rounded-full px-2 py-1.5">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 rounded-full bg-paper flex items-center justify-center hover:bg-gray-100 transition"
                      aria-label="Giảm số lượng"
                    >
                      <Minus size={16} />
                    </button>

                    <span className="ticket-num w-8 text-center font-semibold text-base">
                      {qty}
                    </span>

                    <button
                      onClick={() => setQty((q) => q + 1)}
                      className="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center hover:bg-ink-soft transition"
                      aria-label="Tăng số lượng"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer — pb dùng max() để không bị .safe-bottom đè về 0px */}
            <div className="px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] dashed-divider">
              <Button
                fullWidth
                disabled={unavailable}
                onClick={() => {
                  addItem(selectedItem, qty);
                  showToast(`Đã thêm ${selectedItem.foodName}`);
                  setSelectedItem(null);
                }}
              >
                {unavailable
                  ? "Món hiện đang hết hàng"
                  : `Thêm vào giỏ · ${formatCurrency(
                    selectedItem.originalPrice * qty
                  )}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      <CartFloatingButton onOpen={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}