import React, { createContext, useContext, useState } from "react";
import { doctors as defaultDoctors, initialAppointments, initialHistory, paymentMethods } from "../data/mockData";

const GlobalContext = createContext(null);

export function GlobalProvider({ children }) {
  // ---------- Auth ----------
  // Khi có API thực tế: đọc token từ localStorage để duy trì session sau khi refresh
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem("token")
  );

  // ---------- User ----------
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");

    return savedUser
      ? JSON.parse(savedUser)
      : {
        name: "",
        email: "",
        phone: "",
      };
  });
  // ---------- Doctor & Booking flow ----------
  const [selectedDoctor, setSelectedDoctor] = useState(defaultDoctors[0]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookingMode, setBookingMode] = useState("online");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [patientInfo, setPatientInfo] = useState({ name: "", phone: "", note: "" });

  // ---------- Data lists ----------
  const [appointments, setAppointments] = useState(initialAppointments);
  const [history, setHistory] = useState(initialHistory);
  const [reviews, setReviews] = useState({});

  // ---------- Global UI ----------
  const [loading, setLoading] = useState(false);

  // ---------- Auth actions ----------
  const login = (userData, token) => {
    localStorage.setItem("token", token);

    localStorage.setItem(
      "user",
      JSON.stringify(userData)
    );

    setUser(userData);

    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser({ name: "", email: "", phone: "" });
    setIsAuthenticated(false);
  };

  // ---------- Data actions ----------
  const addAppointment = (appointment) =>
    setAppointments((prev) => [appointment, ...prev]);

  const addHistory = (entry) =>
    setHistory((prev) => [entry, ...prev]);

  const addReview = (doctorId, review) =>
    setReviews((prev) => ({
      ...prev,
      [doctorId]: [review, ...(prev[doctorId] || [])],
    }));

  const value = {
    // Auth
    isAuthenticated,
    login,
    logout,

    // State
    user, setUser,
    selectedDoctor, setSelectedDoctor,
    selectedDate, setSelectedDate,
    selectedTime, setSelectedTime,
    bookingMode, setBookingMode,
    paymentMethod, setPaymentMethod,
    patientInfo, setPatientInfo,
    appointments, setAppointments,
    history, setHistory,
    reviews, setReviews,
    loading, setLoading,

    // Actions
    addAppointment,
    addHistory,
    addReview,
  };

  return (
    <GlobalContext.Provider value={value}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobal() {
  const ctx = useContext(GlobalContext);
  if (!ctx) throw new Error("useGlobal must be used inside GlobalProvider");
  return ctx;
}

export default GlobalContext;