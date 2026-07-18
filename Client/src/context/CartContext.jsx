import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const CartContext = createContext(null);

// ⚠️ Không có field "note" theo từng món - backend (initSocket.js: send_to_kitchen)
// hiện chỉ nhận { foodId, quantity }, pendingItems/items ở server cũng không có
// chỗ lưu ghi chú riêng từng món. Nếu thêm lại note, phải sửa cả initSocket.js.
export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { id, name, price, qty }

  const addItem = useCallback((menuItem, qty = 1) => {
    const itemId = menuItem.id || menuItem._id;
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === itemId);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { id: itemId, name: menuItem.foodName, price: menuItem.originalPrice, qty }];
    });
  }, []);

  const updateQty = useCallback((id, qty) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.id !== id);
      return prev.map((i) => (i.id === id ? { ...i, qty } : i));
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalCount = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, i) => sum + i.qty * i.price, 0), [items]);

  const value = useMemo(
    () => ({ items, addItem, updateQty, removeItem, clearCart, totalCount, totalPrice }),
    [items, addItem, updateQty, removeItem, clearCart, totalCount, totalPrice]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart phải dùng trong CartProvider");
  return ctx;
}
