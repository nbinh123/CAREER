import React from "react";
import { UtensilsCrossed } from "lucide-react";
import { useTable } from "../../context/TableContext";
import { useGlobal } from "../../context/GlobalContext";

export default function Header() {
  const { table } = useTable();
  const { restaurant } = useGlobal();

  return (
    <header className="fixed top-0 inset-x-0 z-30 h-16 bg-ink text-paper flex items-center justify-between px-4 safe-top">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-chili flex items-center justify-center flex-shrink-0">
          <UtensilsCrossed size={17} />
        </div>
        <div className="leading-tight">
          <p className="font-display font-semibold text-sm">{restaurant.name}</p>
          <p className="text-[11px] text-steel-light">{restaurant.tagline}</p>
        </div>
      </div>

      {table?.tableLabel && (
        <span className="ticket-num text-xs font-medium bg-turmeric text-ink rounded-full px-3 py-1.5 flex-shrink-0">
          {table.tableLabel}
        </span>
      )}
    </header>
  );
}
