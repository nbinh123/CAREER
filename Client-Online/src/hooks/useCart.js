// Logic thực tế nằm ở CartContext (đi cùng CartProvider) để tránh 2 nguồn sự thật.
// File này chỉ re-export để đúng theo cấu trúc /hooks đã thống nhất, và để các
// component khác có thể `import { useCart } from "../hooks/useCart"` nếu muốn.
export { useCart } from "../context/CartContext";
