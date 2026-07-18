import { Home, Package, UtensilsCrossed, ShoppingCart, TrendingUp } from "lucide-react";
const NAV = [
    { path: "/", label: "Tổng quan", icon: Home },
    { path: "/ingredients", label: "Nguyên liệu", icon: Package },
    { path: "/menu", label: "Thực đơn", icon: UtensilsCrossed },
    { path: "/orders", label: "Order", icon: ShoppingCart },
    { path: "/analyst", label: "Phân tích", icon: TrendingUp },
];
// ─── BOTTOM NAV (mobile) ─────────────────────────────────
export default function BottomNav({ page, setPage }) {
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex lg:hidden z-20">
            {NAV.map(({ path, label, icon: Icon }) => (
                <button key={path} onClick={() => setPage(path)}
                    className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-semibold transition-all ${page === path ? "text-green-600" : "text-gray-400"}`}>
                    <Icon size={19} strokeWidth={page === path ? 2.5 : 1.8} />
                    <span className="text-xs leading-tight" style={{ fontSize: 10 }}>{label}</span>
                </button>
            ))}
        </nav>
    );
}