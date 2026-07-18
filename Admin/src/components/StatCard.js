import React from "react";

export default function StatCard({ icon: Icon, label, value, sub, color = "green" }) {
    const c = { green: "bg-green-500", blue: "bg-blue-500", amber: "bg-amber-500", rose: "bg-rose-500" };
    return (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c[color]} text-white`}>
                <Icon size={20} />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className="text-xl font-bold text-gray-800 mt-0.5 truncate">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}