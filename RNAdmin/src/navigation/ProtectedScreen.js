import React from "react";
import useAuthZustand from "../zustand/useAuthZustand";
import ForbiddenPage from "../pages/ForbiddenPage";

export default function ProtectedScreen({ requireAdmin = false, children }) {
  const isAuthenticated = useAuthZustand((s) => s.isAuthenticated);
  const currentUser = useAuthZustand((s) => s.currentUser);
  const isWorking = useAuthZustand((s) => s.isWorking);

  if (!isAuthenticated) {
    return <ForbiddenPage reason="unauthenticated" />;
  }

  if (!isWorking) {
    return <ForbiddenPage reason="not-working" />;
  }

  if (requireAdmin && currentUser?.role !== "admin") {
    return <ForbiddenPage reason="forbidden" />;
  }

  return children;
}
export function withProtection(Component, { requireAdmin = false } = {}) {
  return function Protected(props) {
    return (
      <ProtectedScreen requireAdmin={requireAdmin}>
        <Component {...props} />
      </ProtectedScreen>
    );
  };
}
