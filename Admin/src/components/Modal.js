import { X } from "lucide-react";
import React from "react";

export default function Modal({ open, onClose, title, children, maxW = "max-w-lg" }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
            <div className={`relative bg-white rounded-2xl shadow-xl w-full ${maxW} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-green-100">
                    <h3 className="text-base font-bold text-green-900">{title}</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <X size={16} className="text-gray-400" />
                    </button>
                </div>
                <div className="px-6 py-5">{children}</div>
            </div>
        </div>
    );
}