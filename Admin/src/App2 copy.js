import { useState, useEffect, createContext, useContext } from "react";
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
    Home, Package, UtensilsCrossed, ShoppingCart, TrendingUp,
    Plus, Edit2, Trash2, X, Search, Bell, DollarSign, Users,
    Clock, Check, ChefHat, Flame, AlertTriangle, Menu,
    BarChart2, ArrowUpRight, RefreshCw, Filter, Star
} from "lucide-react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import fmtVND from "./utils/fmtVND";

import StatCard from "./components/StatCard";
import FormInput from "./components/FormInput";
import StatusBadge from "./components/StatusBadge";
import Button from "./components/Button";

import HomePage from "./pages/HomePage";
import Sidebar from "./pages/SidePage";
import BottomNav from "./pages/BottomNav";
import IngredientsPage from "./pages/IngredientsPage";
import MenuPage from "./pages/MenuPage";
import OrdersPage from "./pages/OrdersPage";
import AnalystPage from "./pages/AnalystPage";

import MainLayout from "../src/layouts/MainLayout"

import { initIngredients, initFoods, seedOrders } from "./data/seedData";

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

const NAV = [
    { path: "/", label: "Tổng quan", icon: Home },
    { path: "/ingredients", label: "Nguyên liệu", icon: Package },
    { path: "/menu", label: "Thực đơn", icon: UtensilsCrossed },
    { path: "/orders", label: "Order", icon: ShoppingCart },
    { path: "/analyst", label: "Phân tích", icon: TrendingUp },
];

// ─── APP ─────────────────────────────────────────────────
export default function App() {
    const [page, setPage] = useState("/");
    const [mobileOpen, setMobileOpen] = useState(false);
    const [ingredients, setIngredients] = useState(initIngredients);
    const [foods, setFoods] = useState(initFoods);
    const [orders, setOrders] = useState(seedOrders);

    const PAGE_MAP = { "/": HomePage, "/ingredients": IngredientsPage, "/menu": MenuPage, "/orders": OrdersPage, "/analyst": AnalystPage };
    const PageComp = PAGE_MAP[page] || HomePage;

    return (
        <AppCtx.Provider value={{ ingredients, setIngredients, foods, setFoods, orders, setOrders }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        *{font-family:'Nunito',sans-serif;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#d1fae5;border-radius:9999px}
      `}</style>
            <div className="flex h-screen bg-gray-50 overflow-hidden">
                <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                        <button className="lg:hidden text-gray-500 hover:text-green-600 w-9 h-9 rounded-xl hover:bg-green-50 flex items-center justify-center" onClick={() => setMobileOpen(true)}>
                            <Menu size={20} />
                        </button>
                        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                            <span className="text-gray-300">/</span>
                            <span className="font-bold text-gray-700">{NAV.find(n => n.path === page)?.label}</span>
                        </div>
                        <div className="flex items-center gap-3 ml-auto">
                            <button className="relative w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                                <Bell size={17} />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-black">A</div>
                                <div className="hidden sm:block">
                                    <p className="text-xs font-bold text-gray-700 leading-tight">Admin</p>
                                    <p className="text-xs text-gray-400">Chủ quán</p>
                                </div>
                            </div>
                        </div>
                    </header>
                    <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
                        {/* <PageComp /> */}
                        <BrowserRouter>
                            <Routes>
                                {/* Auth layout — không có Header & Footer */}
                                {/* <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
              </Route> */}

                                {/* Main layout — có Header & Footer */}
                                <Route element={<MainLayout />}>
                                    {/* Public — ai cũng vào được */}
                                    <Route path="/" element={<HomePage />} />
                                    {/* <Route path="/detail" element={<DetailPage />} /> */}

                                    {/* Private — phải đăng nhập mới vào được */}
                                    {/* <Route element={<PrivateRoute />}>
                  <Route path="/booking">
                    <Route path=":_id/reschedule" element={<RescheduleBooking />} />
                    <Route path=":_id" element={<BookingPage />} />
                  </Route>
                  <Route path="/payment/:_id" element={<PaymentPage />} />
                  <Route path="/submit" element={<SubmitPage />} />
                  <Route path="/user" element={<UserPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/review" element={<ReviewPage />} />
                </Route> */}
                                </Route>
                                {/* Fallback */}
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </BrowserRouter>
                    </main>
                </div>
            </div>
            <BottomNav page={page} setPage={setPage} />
        </AppCtx.Provider>
    );
}