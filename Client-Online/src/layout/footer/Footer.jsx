import React from "react";
import { NavLink } from "react-router-dom";
import { UtensilsCrossed, Cherry, Receipt } from "lucide-react";
import { ROUTES } from "../../constants/routes";
import { useSocket } from "../../hooks/useSocket";
import { ACTIVE_ORDER_STATUSES } from "../../constants/orderStatus";

const TABS = [
  { to: ROUTES.MENU, label: "Thực đơn", icon: UtensilsCrossed },
  { to: ROUTES.FRUITS, label: "Trái cây", icon: Cherry },
  { to: ROUTES.ORDERS, label: "Đơn hàng", icon: Receipt },
];

export default function Footer() {
  const { orders } = useSocket();
  const activeCount = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length;

  return (
    <footer className="fixed bottom-0 inset-x-0 z-30 h-16 bg-paper border-t border-ink/8 flex safe-bottom">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === ROUTES.MENU}
          className={({ isActive }) =>
            `relative flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-display font-medium ${
              isActive ? "text-chili" : "text-steel"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                {to === ROUTES.ORDERS && activeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-chili text-paper text-[9px] leading-4 text-center font-body font-semibold">
                    {activeCount}
                  </span>
                )}
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </footer>
  );
}
