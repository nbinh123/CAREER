import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}) {
  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0 bg-ink/50 animate-fade-in"
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-md bg-paper rounded-ticket shadow-ticket max-h-[88vh] flex flex-col animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 perforated-top">
          <h3 className="font-display font-semibold text-lg text-ink">
            {title}
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
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pt-4 pb-6 dashed-divider safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}