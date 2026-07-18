import React from "react";
import { CheckCircle2 } from "lucide-react";
import { useGlobal } from "../../context/GlobalContext";

export default function Toast() {
  const { toast } = useGlobal();
  if (!toast) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 pointer-events-none">
      <div
        key={toast.key}
        className="flex items-center gap-2 bg-ink text-paper rounded-full px-4 py-2.5 shadow-ticket text-sm font-body animate-fade-in max-w-sm"
      >
        <CheckCircle2 size={16} className="text-turmeric flex-shrink-0" />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
