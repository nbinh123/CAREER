import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/50 animate-fade-in" onClick={onClose} />
      <div
        className="relative z-10 w-full sm:max-w-md sm:mx-4 bg-paper rounded-t-ticket sm:rounded-ticket shadow-ticket max-h-[88vh] flex flex-col animate-slide-up sm:animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 perforated-top">
          <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-full text-steel active:bg-ink/5"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 pb-5 pt-3 dashed-divider safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}
