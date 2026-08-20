import React from "react";

export default function CategoryTabs({ categories, activeId, onChange }) {
  return (
    <div className="sticky top-[64px] z-20 bg-paper/95 backdrop-blur-sm border-b border-ink/5 pt-8">
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 pb-3.5">
        {categories.map((cat) => {
          const active = cat.id === activeId;
          return (
            <button
              key={cat.id}
              onClick={() => onChange(cat.id)}
              className={`flex-shrink-0 rounded-full px-5 py-2.5 text-sm font-display font-medium leading-none transition-colors ${
                active ? "bg-ink text-paper" : "bg-paper-dim text-steel"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}