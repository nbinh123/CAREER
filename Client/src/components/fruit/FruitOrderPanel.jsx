import React, { useState } from "react";
import { X, Minus, Plus, UserRound, Phone as PhoneIcon, PartyPopper } from "lucide-react";
import Button from "../common/Button";
import { formatCurrency } from "../../utils/formatCurrency";

const PHONE_REGEX = /^[0-9]{10}$/;

// Panel cố định phía dưới trang Trái cây: tóm tắt 3 loại đã chọn, số lượng
// combo muốn đặt, form tên/SĐT (điền sẵn từ phiên khách hiện tại nếu có,
// cho sửa) và nút gửi đơn. Validate tên/SĐT giống hệt GuestInfoPage.jsx.
export default function FruitOrderPanel({
  selected,
  onRemove,
  matchedCombo,
  quantity,
  onQuantityChange,
  totalPrice,
  initialName,
  initialPhone,
  onSubmit,
  submitting,
}) {
  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [errors, setErrors] = useState({});

  const ready = selected.length === 3;

  const handleSubmit = () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const nextErrors = {};
    if (!ready) nextErrors.form = "Chọn đủ 3 loại trái cây trước đã nhé.";
    if (!cleanName) nextErrors.name = "Vui lòng nhập tên của bạn";
    if (!PHONE_REGEX.test(cleanPhone)) nextErrors.phone = "Số điện thoại phải gồm đúng 10 chữ số";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    onSubmit(cleanName, cleanPhone);
  };

  return (
    <div className="bg-paper rounded-t-ticket shadow-float border-t border-ink/8 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {/* Slot đã chọn */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-display font-semibold text-ink text-sm">Combo của bạn · {selected.length}/3</p>
        {matchedCombo && (
          <span className="flex items-center gap-1 text-[11px] font-display font-medium text-jade bg-jade-light px-2 py-1 rounded-full">
            <PartyPopper size={12} />
            Đã có sẵn trong thực đơn
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {[0, 1, 2].map((slot) => {
          const item = selected[slot];
          return (
            <div
              key={slot}
              className={`flex-1 h-14 rounded-xl border flex items-center justify-center px-2 text-center ${
                item ? "border-jade/40 bg-jade-light" : "border-dashed border-ink/15 bg-paper-dim"
              }`}
            >
              {item ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-display text-xs font-medium text-ink truncate">{item.fruitName}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(item)}
                    aria-label={`Bỏ ${item.fruitName}`}
                    className="flex-shrink-0 w-4 h-4 rounded-full bg-ink/10 flex items-center justify-center text-steel"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <span className="text-steel-light text-[11px]">Chọn loại {slot + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Số lượng phần combo */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-steel uppercase tracking-wide">Số phần</span>
        <div className="flex items-center gap-3 bg-paper-dim rounded-full px-2 py-1.5">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            className="w-8 h-8 rounded-full bg-paper flex items-center justify-center hover:bg-gray-100 transition"
            aria-label="Giảm số lượng"
          >
            <Minus size={14} />
          </button>
          <span className="ticket-num w-6 text-center font-semibold text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => onQuantityChange(quantity + 1)}
            className="w-8 h-8 rounded-full bg-ink text-paper flex items-center justify-center hover:bg-ink-soft transition"
            aria-label="Tăng số lượng"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Tên + SĐT */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div>
          <label className="flex items-center gap-1 text-[11px] font-medium text-steel uppercase tracking-wide mb-1">
            <UserRound size={11} /> Tên
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Tên của bạn"
            autoComplete="name"
            className={`w-full rounded-full bg-paper-dim px-3.5 py-2.5 text-sm text-ink placeholder:text-steel-light focus:outline-none focus:ring-2 ${
              errors.name ? "ring-2 ring-chili" : "focus:ring-turmeric"
            }`}
          />
          {errors.name && <p className="text-chili text-[11px] mt-1 ml-1">{errors.name}</p>}
        </div>
        <div>
          <label className="flex items-center gap-1 text-[11px] font-medium text-steel uppercase tracking-wide mb-1">
            <PhoneIcon size={11} /> SĐT
          </label>
          <input
            value={phone}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
              setPhone(digitsOnly);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            inputMode="numeric"
            placeholder="10 số"
            autoComplete="tel"
            className={`w-full rounded-full bg-paper-dim px-3.5 py-2.5 text-sm text-ink placeholder:text-steel-light focus:outline-none focus:ring-2 ${
              errors.phone ? "ring-2 ring-chili" : "focus:ring-turmeric"
            }`}
          />
          {errors.phone && <p className="text-chili text-[11px] mt-1 ml-1">{errors.phone}</p>}
        </div>
      </div>

      {errors.form && <p className="text-chili text-xs mb-2 text-center">{errors.form}</p>}

      <Button fullWidth disabled={!ready || submitting} onClick={handleSubmit}>
        {submitting
          ? "Đang gửi..."
          : `Gửi đơn trái cây${ready ? ` · ${formatCurrency(totalPrice)}` : ""}`}
      </Button>
    </div>
  );
}