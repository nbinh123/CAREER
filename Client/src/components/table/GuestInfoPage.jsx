import React, { useState } from "react";
import { UserRound, Phone as PhoneIcon } from "lucide-react";
import { useTable } from "../../context/TableContext";
import { useGuest } from "../../context/GuestContext";
import { useSocket } from "../../context/SocketContext";
import Button from "../common/Button";

const PHONE_REGEX = /^[0-9]{10}$/;

// Cùng vai trò "màn chắn" như InvalidTablePage/TableWaitingPage — hiện SAU
// khi đã xác nhận bàn có thật, TRƯỚC khi vào thực đơn. Tên + SĐT nhập ở đây
// được gửi lên server (set_guest_info) để admin nhìn thấy ngay trong hộp
// thoại chat, dạng "Bàn 1 - Bình - 0123456789".
export default function GuestInfoPage() {
  const { table } = useTable();
  const { submitGuest } = useGuest();
  const { sendGuestInfo } = useSocket();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const nextErrors = {};

    if (!cleanName) nextErrors.name = "Vui lòng nhập tên của bạn";
    if (!PHONE_REGEX.test(cleanPhone)) nextErrors.phone = "Số điện thoại phải gồm đúng 10 chữ số";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    submitGuest(cleanName, cleanPhone);
    sendGuestInfo(cleanName, cleanPhone);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-turmeric/15 flex items-center justify-center mx-auto mb-5">
            <UserRound size={28} className="text-turmeric-dark" />
          </div>
          <h1 className="font-display text-xl font-semibold text-ink mb-2">
            Chào mừng đến {table?.tableLabel || "bàn của bạn"}
          </h1>
          <p className="text-steel text-sm leading-relaxed">
            Vui lòng cho chúng tôi biết tên và số điện thoại để phục vụ bạn tốt hơn.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-steel uppercase tracking-wide mb-1.5">
              <UserRound size={13} /> Tên của bạn
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="Nhập tên của bạn"
              autoComplete="name"
              className={`w-full rounded-full bg-paper-dim px-4 py-3 text-sm text-ink placeholder:text-steel-light focus:outline-none focus:ring-2 ${
                errors.name ? "ring-2 ring-chili" : "focus:ring-turmeric"
              }`}
            />
            {errors.name && <p className="text-chili text-xs mt-1.5 ml-1">{errors.name}</p>}
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-steel uppercase tracking-wide mb-1.5">
              <PhoneIcon size={13} /> Số điện thoại
            </label>
            <input
              value={phone}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                setPhone(digitsOnly);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              inputMode="numeric"
              placeholder="Nhập số điện thoại (10 số)"
              autoComplete="tel"
              className={`w-full rounded-full bg-paper-dim px-4 py-3 text-sm text-ink placeholder:text-steel-light focus:outline-none focus:ring-2 ${
                errors.phone ? "ring-2 ring-chili" : "focus:ring-turmeric"
              }`}
            />
            {errors.phone && <p className="text-chili text-xs mt-1.5 ml-1">{errors.phone}</p>}
          </div>

          <Button type="submit" fullWidth className="mt-2">
            Bắt đầu gọi món
          </Button>
        </form>
      </div>
    </div>
  );
}
