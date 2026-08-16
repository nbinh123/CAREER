import React from "react";
import { Check } from "lucide-react";
import { ORDER_STATUS } from "../../constants/orderStatus";

// Gộp 5 trạng thái backend thành 4 bước hiển thị:
// pending                    -> "Xác nhận" (đang chờ, chưa xong)
// confirmed, preparing       -> "Đang làm" (quán đã nhận & đang chuẩn bị)
// delivering                 -> "Đang giao"
// completed                  -> "Hoàn thành"
const STEPS = [
  { label: "Xác nhận", statuses: [ORDER_STATUS.PENDING] },
  { label: "Đang làm", statuses: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PREPARING] },
  { label: "Đang giao", statuses: [ORDER_STATUS.DELIVERING] },
  { label: "Hoàn thành", statuses: [ORDER_STATUS.COMPLETED] },
];

export default function OrderStatusProgress({ status }) {
  const foundIndex = STEPS.findIndex((step) => step.statuses.includes(status));
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;

  return (
    <div className="flex items-start pt-2 pb-1">
      {STEPS.map((step, idx) => {
        const isDone = idx < activeIndex;
        const isActive = idx === activeIndex;
        const isLast = idx === STEPS.length - 1;

        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0 w-12">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors
                  ${
                    isDone
                      ? "bg-chili-dark text-white"
                      : isActive
                      ? "bg-chili-dark text-white ring-4 ring-chili-dark/20"
                      : "bg-paper-dim text-steel-light border border-ink/10"
                  }`}
              >
                {isDone ? <Check size={12} /> : idx + 1}
              </div>
              <span
                className={`text-[10px] text-center leading-tight ${
                  isActive ? "text-ink font-medium" : "text-steel-light"
                }`}
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                className={`flex-1 h-[2px] mx-0.5 mt-2.5 rounded-full transition-colors ${
                  idx < activeIndex ? "bg-chili-dark" : "bg-paper-dim"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}