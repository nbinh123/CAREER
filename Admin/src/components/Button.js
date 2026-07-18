import React from "react";

export default function Btn({ children, variant = "primary", sm, className = "", disabled, ...props }) {
    const base = `inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${sm ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2"}`;
    const v = {
        primary: "bg-green-500 hover:bg-green-600 text-white",
        secondary: "bg-green-50 hover:bg-green-100 text-green-700 border border-green-200",
        danger: "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200",
        ghost: "hover:bg-gray-100 text-gray-600",
        outline: "bg-white hover:bg-green-50 text-gray-700 border border-gray-200",
    };
    return <button className={`${base} ${v[variant] || v.primary} ${className}`} disabled={disabled} {...props}>{children}</button>;
}