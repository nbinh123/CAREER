// routes/ProtectedRoute.jsx

import { Navigate } from "react-router-dom";

import useAuthZustand from "../zustand/useAuthZustand";

function ProtectedRoute({
    children,
    isAdmin = false,
}) {

    const {
        isAuthenticated,
        currentUser,
        isWorking
    } = useAuthZustand();

    /* =====================================================
       CHƯA ĐĂNG NHẬP
    ===================================================== */

    if (!isAuthenticated) {

        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }
    if(!isWorking){

        return (
            <Navigate
                to="/403"
                replace
            />
        );
    }

    /* =====================================================
       KIỂM TRA ADMIN
    ===================================================== */

    if (
        (isAdmin &&
        currentUser?.role !== "admin" )
    ) {

        return (
            <Navigate
                to="/403"
                replace
            />
        );
    }

    /* =====================================================
       ALLOW
    ===================================================== */

    return children;
}

export default ProtectedRoute;