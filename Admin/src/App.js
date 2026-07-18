import { useState, useEffect, createContext } from "react";
import {
  Home, Package, UtensilsCrossed, ShoppingCart, TrendingUp, Menu, LogIn, LogOut, UserPlus, Bell, DollarSign
} from "lucide-react";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import HomePage from "./pages/HomePage";
import Sidebar from "./pages/SidePage";
import IngredientsPage from "./pages/IngredientsPage";
import MenuPage from "./pages/MenuPage";
import OrdersPage from "./pages/OrdersPage";
import AnalystPage from "./pages/AnalystPage";
import RegisterPage from "./pages/RegisterPage";
import StoragePage from "./pages/StoragePage";
import KitchenPage from "./pages/KitchenPage";
import Page403 from "./pages/403Page";

import MainLayout from "../src/layouts/MainLayout"

import useFoodZustand from "./zustand/useFoodZustand";
import useAuthZustand from "./zustand/useAuthZustand";
import useIngredientZustand from "./zustand/useIngredientZustand";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import StaffManager from "./pages/StaffManager";
import ShiftPage from "./pages/ShiftPage";
import CashFlowPage from "./pages/CashFlow";

const AppCtx = createContext(null);

const NAV = [
  { path: "/", label: "Tổng quan", icon: Home },
  { path: "/ingredients", label: "Nguyên liệu", icon: Package },
  { path: "/menu", label: "Thực đơn", icon: UtensilsCrossed },
  { path: "/orders", label: "Order", icon: ShoppingCart },
  { path: "/analyst", label: "Phân tích", icon: TrendingUp },
  { path: "/cash-flow", label: "Dòng tiền", icon: DollarSign },
];

// ─── APP ─────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("/");
  const [mobileOpen, setMobileOpen] = useState(false);

  const { getFoods } = useFoodZustand();
  const { getIngredients } = useIngredientZustand();

  // ── AUTH STATE ─────────────────────────────────────────
  // Thay bằng useAuthZustand() nếu bạn có store riêng
  // Ví dụ: const { currentUser, logout } = useAuthZustand();
  const { currentUser, logout, stopWorking, beginWorking, isWorking } = useAuthZustand();   // { _id, name, role: "admin" | "staff" }
  const isLoggedIn = !!currentUser;
  // ──────────────────────────────────────────────────────

  async function fetchData() {
    await getFoods();
    await getIngredients();
  }
  useEffect(() => { fetchData(); }, []);

  return (
    <AppCtx.Provider value={{}}>
      <BrowserRouter>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
          *{font-family:'Nunito',sans-serif;}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
          ::-webkit-scrollbar{width:4px;height:4px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:#d1fae5;border-radius:9999px}
          
        `}</style>

        <div className="flex h-screen bg-gray-50 overflow-hidden">
          <Sidebar
            setPage={setPage}
            page={page}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            isShow={isLoggedIn}
          />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* ── HEADER ─────────────────────────────────────── */}
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
              {/* Hamburger mobile */}
              <button
                className="lg:hidden text-gray-500 hover:text-green-600 w-9 h-9 rounded-xl hover:bg-green-50 flex items-center justify-center"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={20} />
              </button>

              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
                <span className="text-gray-300">/</span>
                <span className="font-bold text-gray-700">
                  {NAV.find((n) => n.path === page)?.label}
                </span>
              </div>

              {/* ── RIGHT ACTIONS ─────────────────────────────── */}
              <div className="flex items-center gap-2 ml-auto">

                {/* Thông báo — chỉ hiện khi đã đăng nhập */}
                {(isLoggedIn && !isWorking) ? (
                  <button
                    onClick={() => beginWorking()}
                    className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200"
                  >
                    <Bell size={14} strokeWidth={2.5} />
                    <span>Đã tạm dừng hoạt động</span>
                  </button>
                ) : (
                  <button
                    onClick={() => stopWorking()}
                    className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200"
                  >
                    <Bell size={14} strokeWidth={2.5} />
                    <span>Đang hoạt động</span>
                  </button>
                )}

                {/* ── Chưa đăng nhập ── */}
                {!isLoggedIn && (
                  <button
                    onClick={() => { window.location.href = "/login" }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-colors shadow-sm"
                  >
                    <LogIn size={14} strokeWidth={2.5} />
                    <span>Đăng nhập</span>
                  </button>
                )}

                {/* ── Đã đăng nhập ── */}
                {isLoggedIn && (
                  <>
                    {/* Đăng ký nhân viên — chỉ admin */}
                    {currentUser?.role === "admin" && (
                      <button
                        onClick={() => { window.location.href = "/register" }}
                        className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200"
                      >
                        <UserPlus size={14} strokeWidth={2.5} />
                        <span>Đăng ký nhân viên</span>
                      </button>
                    )}

                    {/* Avatar + tên */}
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-black">
                        {currentUser?.name?.[0]?.toUpperCase() ?? "U"}
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-xs font-bold text-gray-700 leading-tight">
                          {currentUser?.name ?? "Người dùng"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {currentUser?.role === "admin" ? "Quản trị viên" : "Nhân viên"}
                        </p>
                      </div>
                    </div>

                    {/* Đăng xuất */}
                    <button
                      onClick={logout}
                      title="Đăng xuất"
                      className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 hover:text-red-600 transition-colors"
                    >
                      <LogOut size={16} strokeWidth={2.2} />
                    </button>
                  </>
                )}
              </div>
              {/* ────────────────────────────────────────────── */}
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
              <Routes>
                <Route element={<MainLayout />}>
                  {isWorking && <Route path="/" element={<HomePage />} />}
                  <Route path="/403" element={<Page403 />} />
                  <Route path="/login" element={<LoginPage />} />

                  <Route path="/ingredients" element={
                    <ProtectedRoute
                      isAdmin={true}
                    >
                      <IngredientsPage />
                    </ProtectedRoute>} />
                  <Route path="/menu" element={
                    <ProtectedRoute
                      isAdmin={true}
                    >
                      <MenuPage />
                    </ProtectedRoute>} />
                  <Route path="/analyst" element={
                    <ProtectedRoute
                      isAdmin={true}
                    >
                      <AnalystPage />
                    </ProtectedRoute>} />
                  <Route path="/register" element={
                    <ProtectedRoute
                      isAdmin={true}
                    >
                      <RegisterPage />
                    </ProtectedRoute>} />
                  <Route path="/staff-manager" element={
                    <ProtectedRoute
                      isAdmin={true}
                    >
                      <StaffManager />
                    </ProtectedRoute>} />
                  <Route path="/storage" element={
                    <ProtectedRoute
                      isAdmin={true}
                    >
                      <StoragePage />
                    </ProtectedRoute>} />
                  <Route path="/cash-flow" element={
                    <ProtectedRoute
                      isAdmin={true}
                    >
                      <CashFlowPage />
                    </ProtectedRoute>} />
                  <Route path="/kitchen" element={
                    <ProtectedRoute
                      isAdmin={true}
                    >
                      <KitchenPage />
                    </ProtectedRoute>} />
                  {isWorking && <Route path="/orders" element={<OrdersPage />} />}
                  {isWorking && <Route path="/shift" element={<ShiftPage />} />}
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter >
    </AppCtx.Provider >
  );
}