import { Home, Package, UtensilsCrossed, ShoppingCart, TrendingUp, GiftIcon, GroupIcon, IndentIncreaseIcon, FireExtinguisherIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuthZustand from "../zustand/useAuthZustand";

// ─── SIDEBAR ─────────────────────────────────────────────
const NAV = [
  {
    path: "/",
    label: "Tổng quan",
    icon: Home,
    roles: ["admin", "manager", "cashier", "chef", "staff"],
  },

  {
    path: "/ingredients",
    label: "Nguyên liệu",
    icon: Package,
    roles: ["admin"],
  },

  {
    path: "/menu",
    label: "Thực đơn",
    icon: UtensilsCrossed,
    roles: ["admin"],
  },

  {
    path: "/orders",
    label: "Order",
    icon: ShoppingCart,
    roles: ["admin", "staff", "chef"],
  },

  {
    path: "/analyst",
    label: "Phân tích",
    icon: TrendingUp,
    roles: ["admin"],
  },

  {
    path: "/storage",
    label: "Quản lý nhập/xuất",
    icon: GiftIcon,
    roles: ["admin"],
  },

  {
    path: "/staff-manager",
    label: "Quản lý nhân viên",
    icon: GroupIcon,
    roles: ["admin"],
  },
  {
    path: "/shift",
    label: "Ca làm",
    icon: GroupIcon,
    roles: ["admin", "staff"],
  },
  {
    path: "/cash-flow",
    label: "Dòng tiền",
    icon: IndentIncreaseIcon,
    roles: ["admin"],
  },
  {
    path: "/kitchen",
    label: "Nhà bếp",
    icon: FireExtinguisherIcon,
    roles: ["admin", "chef"],
  }
];

export default function Sidebar({ page, setPage, mobileOpen, setMobileOpen, isShow }) {

  const {
    currentUser,
  } = useAuthZustand();

  const navigate = useNavigate();
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMobileOpen(false)} />}
      {isShow && <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:relative lg:flex ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center text-white text-xl">🍜</div>
            <div>
              <p className="font-black text-green-900 text-sm leading-tight">Xanh lá Là</p>
              <p className="text-xs text-gray-400">Quản lý quán ăn</p>
            </div>
          </div>
        </div>
        {/* NAV */}
        <nav className="flex-1 p-3 space-y-1">

          {NAV
            .filter((item) =>
              item.roles.includes(currentUser?.role)
            )
            .map(({ path, label, icon: Icon }) => (

              <button
                key={path}
                onClick={() => {
                  setPage(path);
                  navigate(path);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${page === path
                    ? "bg-green-500 text-white"
                    : "text-gray-600 hover:bg-green-50 hover:text-green-700"
                  }`}
              >

                <Icon
                  size={18}
                  strokeWidth={
                    page === path ? 2.5 : 2
                  }
                />

                {label}

              </button>

            ))}

        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" style={{ animation: "pulse 2s infinite" }} />
            Kết nối thời gian thực
          </div>
        </div>
      </aside>}
    </>
  );
}