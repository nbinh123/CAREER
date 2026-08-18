import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronLeft } from "lucide-react";
import Button from "../common/Button";
import CartItem from "./CartItem";
import CheckoutFields from "../checkout/CheckoutFields";
import { useCart } from "../../context/CartContext";
import { useSocket } from "../../context/SocketContext";
import { useCustomer } from "../../context/CustomerContext";
import { useGlobal } from "../../context/GlobalContext";
import { formatCurrency } from "../../utils/formatCurrency";
import { ROUTES } from "../../constants/routes";

const PHONE_RE = /^(0|\+84)\d{9,10}$/;

// Khác biệt chính so với bản gọi món tại bàn: bản gốc bấm "Gửi đơn" là xong
// ngay (đã có sẵn tableId + tên/SĐT từ GuestInfoPage lúc vào bàn). Bản online
// không có bước xin thông tin trước đó, nên CartDrawer giờ có 2 bước:
//   1) "cart"     - xem lại/chỉnh số lượng món, giống hệt bản gốc
//   2) "checkout" - nhập tên, SĐT, địa chỉ, ghi chú rồi mới thật sự đặt hàng
export default function CartDrawer({ open, onClose }) {
  const { items, updateQty, totalPrice, totalCount, clearCart } = useCart();
  const { placeOrder, validateVoucher } = useSocket();
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null); // { code, discountAmount, finalTotal }
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const { profile, saveProfile } = useCustomer();
  const { showToast } = useGlobal();
  const navigate = useNavigate();

  const [step, setStep] = useState("cart"); // "cart" | "checkout"
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Mỗi lần mở giỏ hàng: quay về bước "cart" và điền sẵn thông tin khách đã
  // nhập ở lần đặt gần nhất (nếu có), để khách quen không phải gõ lại.
  useEffect(() => {
    if (!open) return;
    setStep("cart");
    setErrors({});
    setJustSaved(false);
    setForm({
      name: profile?.name || "",
      phone: profile?.phone || "",
      address: profile?.address || "",
      note: "",
    });
  }, [open, profile]);

  useEffect(() => {
    setAppliedVoucher(null);
  }, [items]);
  // Khoá scroll nền khi giỏ hàng đang mở
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Vui lòng nhập tên người nhận.";
    if (!form.phone.trim()) next.phone = "Vui lòng nhập số điện thoại.";
    else if (!PHONE_RE.test(form.phone.trim())) next.phone = "Số điện thoại không hợp lệ.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleContinue = () => {
    if (items.length === 0) return;
    setStep("checkout");
  };
  const handleApplyVoucher = async () => {
    if (!voucherInput.trim()) return;
    setVoucherChecking(true);
    setVoucherError("");
    try {
      const result = await validateVoucher(voucherInput, items);
      setAppliedVoucher(result);
    } catch (err) {
      setAppliedVoucher(null);
      setVoucherError(err.message);
    } finally {
      setVoucherChecking(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput("");
    setVoucherError("");
  };
  // Lưu hồ sơ (tên/SĐT/địa chỉ) là hành động RIÊNG, khách chủ động bấm —
  // không còn tự lưu ngầm mỗi khi đặt hàng xong như trước, để khách dùng
  // máy chung (vd tablet ở quầy) không bị lộ thông tin cho người đặt sau.
  const handleSaveInfo = () => {
    if (!validate()) return;
    saveProfile({ name: form.name, phone: form.phone, address: form.address });
    showToast("Đã lưu thông tin giao hàng cho lần sau.");
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await placeOrder(items, form, appliedVoucher?.code); // ❗ SỬA — thêm voucherCode
      clearCart();
      onClose();
      showToast("Đã gửi đơn, đang chờ quán xác nhận!");
      navigate(ROUTES.ORDERS);
    } catch (err) {
      showToast("Gửi đơn thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const title =
    step === "cart"
      ? `Đơn của bạn${totalCount ? ` · ${totalCount} món` : ""}`
      : "Thông tin giao hàng";

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
          <div className="flex items-center gap-1">
            {step === "checkout" && (
              <button
                onClick={() => setStep("cart")}
                aria-label="Quay lại giỏ hàng"
                className="p-1.5 -ml-1.5 rounded-full text-steel hover:bg-ink/5 transition"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
          </div>

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
          {step === "cart" ? (
            items.length === 0 ? (
              <p className="text-steel text-sm text-center py-10">Giỏ hàng của bạn đang trống.</p>
            ) : (
              <div>
                {items.map((item) => (
                  <CartItem key={item.id} item={item} onUpdateQty={updateQty} />
                ))}
              </div>
            )
          ) : (
            <CheckoutFields
              value={form}
              onChange={setForm}
              errors={errors}
              onSave={handleSaveInfo}
              saved={justSaved}
            />
          )}
        </div>

        {/* Footer — pb dùng max() để không bị .safe-bottom đè về 0px */}
        {step === "cart" && items.length > 0 && (
          <div className="px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] dashed-divider">
            {/* ❗ MỚI — nhập mã voucher */}
            <div className="mb-3">
              {!appliedVoucher ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    placeholder="Nhập mã giảm giá"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-ink/10 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-ink/20"
                  />
                  <Button
                    variant="outline"
                    onClick={handleApplyVoucher}
                    disabled={voucherChecking || !voucherInput.trim()}
                  >
                    {voucherChecking ? "Đang kiểm tra..." : "Áp dụng"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-paper-dim rounded-xl px-3 py-2">
                  <span className="text-sm text-ink">
                    Đã áp {appliedVoucher.code} · -{formatCurrency(appliedVoucher.discountAmount)}
                  </span>
                  <button
                    onClick={handleRemoveVoucher}
                    aria-label="Bỏ mã giảm giá"
                    className="p-1 rounded-full text-steel hover:bg-ink/5 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {voucherError && <p className="text-chili-dark text-xs mt-1.5">{voucherError}</p>}
            </div>

            <Button fullWidth onClick={handleContinue}>
              {appliedVoucher
                ? `Tiếp tục · ${formatCurrency(appliedVoucher.finalTotal)}`
                : `Tiếp tục · ${formatCurrency(totalPrice)}`}
            </Button>
          </div>
        )}

        {step === "checkout" && (
          <div className="px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] dashed-divider">
            <Button fullWidth onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? "Đang gửi..."
                : `Đặt hàng · ${formatCurrency(appliedVoucher ? appliedVoucher.finalTotal : totalPrice)}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
