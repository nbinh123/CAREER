import React, { useState } from "react";
import { UserRound, Phone as PhoneIcon } from "lucide-react";
import Button from "../common/Button";
import { formatCurrency } from "../../utils/formatCurrency";

const PHONE_REGEX = /^[0-9]{10}$/;

// Khối tên/SĐT + nút gửi — nằm trong luồng cuộn BÌNH THƯỜNG (không còn
// fixed) ở cuối trang, khách lướt xuống mới thấy, thay vì che màn hình
// suốt lúc đang chọn trái cây như bản cũ. 3 ô slot + số lượng đã tách sang
// FruitMixBar (vẫn cố định phía dưới, luôn nhìn thấy trong lúc chọn).
// Validate tên/SĐT giống hệt GuestInfoPage.jsx.
export default function FruitGuestForm({
    ready,
    totalPrice,
    initialName,
    initialPhone,
    onSubmit,
    submitting,
}) {
    const [name, setName] = useState(initialName || "");
    const [phone, setPhone] = useState(initialPhone || "");
    const [errors, setErrors] = useState({});

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
        <div className="px-4 pt-5 pb-8">
            <p className="font-display font-semibold text-ink text-sm mb-3">Thông tin gửi đơn</p>

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
                        className={`w-full rounded-full bg-paper-dim px-3.5 py-2.5 text-sm text-ink placeholder:text-steel-light focus:outline-none focus:ring-2 ${errors.name ? "ring-2 ring-chili" : "focus:ring-turmeric"
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
                        className={`w-full rounded-full bg-paper-dim px-3.5 py-2.5 text-sm text-ink placeholder:text-steel-light focus:outline-none focus:ring-2 ${errors.phone ? "ring-2 ring-chili" : "focus:ring-turmeric"
                            }`}
                    />
                    {errors.phone && <p className="text-chili text-[11px] mt-1 ml-1">{errors.phone}</p>}
                </div>
            </div>

            {!ready && (
                <p className="text-steel text-xs mb-3 text-center">Chọn đủ 3 loại trái cây ở trên để gửi đơn nhé.</p>
            )}
            {errors.form && <p className="text-chili text-xs mb-2 text-center">{errors.form}</p>}

            <Button fullWidth disabled={!ready || submitting} onClick={handleSubmit}>
                {submitting
                    ? "Đang gửi..."
                    : `Gửi đơn trái cây${ready ? ` · ${formatCurrency(totalPrice)}` : ""}`}
            </Button>
        </div>
    );
}