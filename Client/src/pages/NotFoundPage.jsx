import React from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-paper">
      <p className="font-display text-3xl font-semibold text-ink mb-2">404</p>
      <p className="text-steel text-sm mb-6">Không tìm thấy trang này.</p>
      <Link to={ROUTES.ORDER} className="text-chili font-display text-sm font-medium">
        Về trang thực đơn
      </Link>
    </div>
  );
}
