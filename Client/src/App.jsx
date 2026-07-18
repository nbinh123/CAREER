import React from "react";
import { GlobalProvider } from "./context/GlobalContext";
import { TableProvider, useTable } from "./context/TableContext";
import { CartProvider } from "./context/CartContext";
import { SocketProvider } from "./context/SocketContext";
import Header from "./layout/header/Header";
import Footer from "./layout/footer/Footer";
import Body from "./layout/body/Body";
import Toast from "./components/common/Toast";
import ChatWidget from "./components/chat/ChatWidget";

function AppLayout() {
  const { status } = useTable();
  const showChrome = status === "valid";

  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      {showChrome && <Header />}
      <main className={showChrome ? "pt-16 pb-24" : ""}>
        <Body />
      </main>
      {showChrome && <Footer />}
      {/* Nút chat hỗ trợ hiện mặc định ở mọi trang (không riêng gì trang chờ
          cũ /order/waiting nữa) - chỉ ẩn khi chưa xác thực xong mã bàn, vì
          lúc đó chưa có phiên hợp lệ để nhắn với nhà hàng. */}
      {showChrome && <ChatWidget />}
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <GlobalProvider>
      <TableProvider>
        <CartProvider>
          <SocketProvider>
            <AppLayout />
          </SocketProvider>
        </CartProvider>
      </TableProvider>
    </GlobalProvider>
  );
}