import React, { useState, useMemo, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import CategoryTabs from "../components/menu/CategoryTabs";
import MenuItemCard from "../components/menu/MenuItemCard";
import MenuItemDetailModal from "../components/menu/MenuItemDetailModal";
import CartFloatingButton from "../components/cart/CartFloatingButton";
import CartDrawer from "../components/cart/CartDrawer";
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";
import { useFoods } from "../hooks/useFoods";
import { getBestSellerIds } from "../utils/bestSellers";
import { useCart } from "../context/CartContext";
import { useGlobal } from "../context/GlobalContext";

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
  const [cartOpen, setCartOpen] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useGlobal();
  const { foods, loading, error, refetch } = useFoods();

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

      <MenuItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onAdd={(item, qty) => {
          addItem(item, qty);
          showToast(`Đã thêm ${item.foodName}`);
        }}
      />

      <CartFloatingButton onOpen={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}