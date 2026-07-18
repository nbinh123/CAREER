import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../common/Modal";
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Đơn của bạn${totalCount ? ` · ${totalCount} món` : ""}`}
      footer={
        items.length > 0 && (
          <Button fullWidth onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Đang gửi..." : `Gửi đơn cho nhà hàng · ${formatCurrency(totalPrice)}`}
          </Button>
        )
      }
    >
      {items.length === 0 ? (
        <p className="text-steel text-sm text-center py-10">Giỏ hàng của bạn đang trống.</p>
      ) : (
        <div>
          {items.map((item) => (
            <CartItem key={item.id} item={item} onUpdateQty={updateQty} />
          ))}
        </div>
      )}
    </Modal>
  );
}