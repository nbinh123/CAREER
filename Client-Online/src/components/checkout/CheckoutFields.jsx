import React from "react";
import { BookmarkPlus, BookmarkCheck } from "lucide-react";

const inputClass =
  "w-full rounded-2xl bg-paper-dim border border-ink/10 px-4 py-3 text-sm text-ink placeholder:text-steel-light focus:outline-none focus:ring-2 focus:ring-chili/40 transition";

/**
 * Form nhập thông tin giao hàng, dùng ở bước 2 của CartDrawer. Tách riêng
 * component để dễ tái sử dụng (vd sau này muốn có trang "Sửa thông tin giao
 * hàng" độc lập) và để CartDrawer không phình to quá.
 *
 * `errors` là object { name?, phone? } — chỉ validate 2 trường bắt buộc
 * (tên, SĐT) ngay trên UI; địa chỉ/ghi chú để trống vẫn cho gửi vì có thể
 * khách gọi điện xác nhận địa chỉ, quán vẫn cần thấy đơn ngay.
 *
 * `onSave`/`saved` là CẶP RIÊNG cho nút "Lưu thông tin để dùng cho lần sau" —
 * hành động lưu (ghi vào CustomerContext/localStorage) TÁCH BIỆT hoàn toàn
 * với việc đặt hàng. Khách có thể đặt hàng mà không lưu (vd dùng máy chung),
 * hoặc lưu trước rồi chưa vội đặt — không còn tự lưu ngầm sau khi đặt như
 * bản nháp trước nữa.
 */
export default function CheckoutFields({ value, onChange, errors = {}, onSave, saved = false }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-display font-medium text-steel mb-1.5">
          Tên người nhận *
        </label>
        <input
          type="text"
          value={value.name}
          onChange={set("name")}
          placeholder="Nguyễn Văn A"
          className={inputClass}
        />
        {errors.name && <p className="text-[11px] text-chili mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-xs font-display font-medium text-steel mb-1.5">
          Số điện thoại *
        </label>
        <input
          type="tel"
          inputMode="numeric"
          value={value.phone}
          onChange={set("phone")}
          placeholder="09xx xxx xxx"
          className={inputClass}
        />
        {errors.phone && <p className="text-[11px] text-chili mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-xs font-display font-medium text-steel mb-1.5">
          Địa chỉ giao hàng
        </label>
        <textarea
          value={value.address}
          onChange={set("address")}
          placeholder="Số nhà, đường, phường/xã..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className="block text-xs font-display font-medium text-steel mb-1.5">
          Ghi chú
        </label>
        <textarea
          value={value.note}
          onChange={set("note")}
          placeholder="Ví dụ: giao trước 12h, không hành..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {onSave && (
        <button
          type="button"
          onClick={onSave}
          className={`flex items-center justify-center gap-1.5 text-xs font-display font-medium py-2.5 rounded-full border transition-colors ${
            saved
              ? "border-jade/40 bg-jade-light text-jade"
              : "border-ink/15 text-steel active:bg-ink/5"
          }`}
        >
          {saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
          {saved ? "Đã lưu thông tin" : "Lưu thông tin để dùng cho lần sau"}
        </button>
      )}
    </div>
  );
}
