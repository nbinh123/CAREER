import React from "react";
import { GlobalProvider } from "./context/GlobalContext";
import { CartProvider } from "./context/CartContext";
import { SocketProvider } from "./context/SocketContext";
import Toast from "./components/common/Toast";
import ChatWidget from "./components/chat/ChatWidget";

/**
 * Tương đương phần <GlobalProvider><CustomerProvider><CartProvider>
 * <SocketProvider> của App.jsx bản web, ĐÃ BỎ CustomerProvider (không còn
 * khái niệm khách ẩn danh trên mobile — thay bằng AuthProvider của giai
 * đoạn 4, đặt NGOÀI component này vì SocketProvider (RN) cần đọc
 * useAuth().accessToken).
 *
 * Cách gắn vào App.jsx gốc (giai đoạn 4 đã có AuthProvider + NavigationContainer):
 *
 *   <AuthProvider>                  // đã có từ giai đoạn 4
 *     <AppProviders>                // file này
 *       <NavigationContainer>       // đã có từ giai đoạn 4
 *         <RootNavigator />         // Auth Stack <-> Main Tab Navigator, đã có
 *       </NavigationContainer>
 *     </AppProviders>
 *   </AuthProvider>
 *
 * Toast + ChatWidget mount NGAY TẠI ĐÂY (không phải trong từng screen) để
 * nổi trên MỌI màn hình — đúng vai trò global của chúng bên bản web (nằm
 * ngoài <Routes> trong App.jsx gốc).
 */
export default function AppProviders({ children }) {
  return (
    <GlobalProvider>
      <CartProvider>
        <SocketProvider>
          {children}
          <Toast />
          <ChatWidget />
        </SocketProvider>
      </CartProvider>
    </GlobalProvider>
  );
}
