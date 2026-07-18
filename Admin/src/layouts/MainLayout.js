import React from "react";
import { Outlet } from "react-router-dom";
export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
