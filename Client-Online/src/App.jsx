import React from "react";
import { GlobalProvider } from "./context/GlobalContext";
import { CustomerProvider } from "./context/CustomerContext";
import { CartProvider } from "./context/CartContext";
import { SocketProvider } from "./context/SocketContext";
import Header from "./layout/header/Header";
import Footer from "./layout/footer/Footer";
import Body from "./layout/body/Body";
import Toast from "./components/common/Toast";
import ChatWidget from "./components/chat/ChatWidget";

// Bản gốc chỉ hiện Header/Footer/ChatWidget SAU KHI xác thực xong mã bàn
// (status === "valid"), vì trước đó chưa biết bàn nào để mà thao tác. Bản
// online không còn bước xác thực nào cả — khách vào thẳng là dùng được luôn,
// nên không cần điều kiện `showChrome` nữa.
function AppLayout() {
  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      <Header />
      <main className="pt-16 pb-24">
        <Body />
      </main>
      <Footer />
      <Toast />
      <ChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <GlobalProvider>
      <CustomerProvider>
        <CartProvider>
          <SocketProvider>
            <AppLayout />
          </SocketProvider>
        </CartProvider>
      </CustomerProvider>
    </GlobalProvider>
  );
}
