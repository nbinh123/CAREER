import React from "react";
import { NavLink } from "react-router-dom";
import { UtensilsCrossed, Receipt } from "lucide-react";
import { ROUTES } from "../../constants/routes";

const TABS = [
  { to: ROUTES.ORDER, label: "Thực đơn", icon: UtensilsCrossed },
  { to: ROUTES.HISTORY, label: "Lịch sử", icon: Receipt },
];

export default function Footer() {
  return (
    <footer className="fixed bottom-0 inset-x-0 z-30 h-16 bg-paper border-t border-ink/8 flex safe-bottom">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-display font-medium ${
              isActive ? "text-chili" : "text-steel"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </footer>
  );
}
