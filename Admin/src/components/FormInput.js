import React from "react";

export default function FormInput({ label, ...props }) {
    return (
        <div className="flex flex-col gap-1.5">
            {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>}
            <input className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent transition bg-white" {...props} />
        </div>
    );
}