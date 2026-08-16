import { Home, Package, UtensilsCrossed, ShoppingCart, GiftIcon, CherryIcon, TrendingUpIcon, ChefHatIcon, UserCogIcon, ChartColumnBigIcon, UserIcon } from "lucide-react";
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
    path: "/fruit",
    label: "Trái cây",
    icon: CherryIcon,
    roles: ["admin", "staff"],
  },
  {
    path: "/orders",
    label: "Order",
    icon: ShoppingCart,
    roles: ["admin", "staff", "chef"],
  },
  {
    path: "/online",
    label: "Đơn hàng online",
    icon: ShoppingCart,
    roles: ["admin"],
  },
  {
    path: "/analyst",
    label: "Phân tích",
    icon: ChartColumnBigIcon,
    roles: ["admin"],
  },

  {
    path: "/storage",
    label: "Quản lý nhập/xuất",
    icon: GiftIcon,
    roles: ["admin"],
  },
  {
    path: "/customers",
    label: "Khách hàng",
    icon: UserIcon,
    roles: ["admin"],
  },
  {
    path: "/staff-manager",
    label: "Quản lý nhân viên",
    icon: UserCogIcon,
    roles: ["admin"],
  },
  {
    path: "/cash-flow",
    label: "Dòng tiền",
    icon: TrendingUpIcon,
    roles: ["admin"],
  },
  {
    path: "/kitchen",
    label: "Nhà bếp",
    icon: ChefHatIcon,
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
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex flex-col gap-1.5 overflow-hidden">
            <div className="w-16 h-16 sm:w-16 sm:h-16 shrink-0 rounded-md overflow-hidden bg-black flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Logo"
                className="block w-full h-full object-contain"
              />
            </div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <p className="font-black text-green-900 text-sm leading-tight truncate">Nguyen Binh</p>
              {/* <span className="text-gray-300 text-xs">•</span> */}
            </div>
            <p className="text-xs text-gray-400 truncate">Quản lý quán ăn</p>
          </div>
        </div>
        {/* NAV */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">

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