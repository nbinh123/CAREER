import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import Button from "../common/Button";
import CartItem from "./CartItem";
import { useCart } from "../../context/CartContext";
import { useSocket } from "../../context/SocketContext";
import { useGlobal } from "../../context/GlobalContext";
import { formatCurrency } from "../../utils/formatCurrency";
import { ROUTES } from "../../constants/routes";

export default function CartDrawer({ open, onClose }) {
  const { items, updateQty, totalPrice, totalCount, clearCart } = useCart();
  const { sendOrder } = useSocket();
  const { showToast } = useGlobal();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Khoá scroll nền khi giỏ hàng đang mở (trước đây do Modal.jsx lo)
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Server tự tính lại foodName/unitPrice từ DB theo foodId, không tin số
      // liệu FE gửi lên - nên ở đây chỉ cần gửi foodId + quantity là đủ.
      await sendOrder(items);
      clearCart();
      onClose();
      showToast("Đã gửi món tới nhà hàng, đang chờ xác nhận!");
      // Đã bỏ route /order/waiting - chuyển sang Lịch sử vì đây là trang duy
      // nhất còn hiển thị trạng thái pending/cooking/ready realtime của bàn.
      navigate(ROUTES.HISTORY);
    } catch (err) {
      showToast("Gửi đơn thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-ink/50 animate-fade-in" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-md bg-paper rounded-ticket shadow-ticket max-h-[88vh] flex flex-col animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 perforated-top">
          <h3 className="font-display font-semibold text-lg text-ink">
            {`Đơn của bạn${totalCount ? ` · ${totalCount} món` : ""}`}
          </h3>

          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-full text-steel hover:bg-ink/5 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {items.length === 0 ? (
            <p className="text-steel text-sm text-center py-10">Giỏ hàng của bạn đang trống.</p>
          ) : (
            <div>
              {items.map((item) => (
                <CartItem key={item.id} item={item} onUpdateQty={updateQty} />
              ))}
            </div>
          )}
        </div>

        {/* Footer — pb dùng max() để không bị .safe-bottom đè về 0px */}
        {items.length > 0 && (
          <div className="px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] dashed-divider">
            <Button fullWidth onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang gửi..." : `Gửi đơn cho nhà hàng · ${formatCurrency(totalPrice)}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}