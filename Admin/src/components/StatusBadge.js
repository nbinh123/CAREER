import React from "react";

export default function StatusBadge({ status }) {
    const map = { PENDING: "bg-yellow-100 text-yellow-700", PROCESSING: "bg-blue-100 text-blue-700", COMPLETED: "bg-green-100 text-green-700", CANCELLED: "bg-red-100 text-red-600" };
    const lbl = { PENDING: "Chờ", PROCESSING: "Đang làm", COMPLETED: "Hoàn thành", CANCELLED: "Hủy" };
    return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${map[status] || "bg-gray-100 text-gray-500"}`}>{lbl[status] || status}</span>;
}
