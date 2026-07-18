import React from "react";

export default function Loading({ label = "Đang tải..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-steel">
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-chili animate-pulse-dot" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-turmeric animate-pulse-dot" style={{ animationDelay: "180ms" }} />
        <span className="w-2 h-2 rounded-full bg-jade animate-pulse-dot" style={{ animationDelay: "360ms" }} />
      </div>
      <p className="text-sm font-body">{label}</p>
    </div>
  );
}
