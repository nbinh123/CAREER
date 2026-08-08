import React, { useEffect, useState } from "react";
import FoodThumbnail from "../menu/FoodThumbnail";

// Bản sao ảnh trái cây "bay" từ vị trí thẻ vừa bấm ở lưới phía trên tới
// đúng ô slot trống trong FruitMixBar — chỉ hiệu ứng thị giác, không mang
// ý nghĩa tương tác gì (state `selected` đã cập nhật ngay khi bấm, xem
// FruitPage.js). Tự gỡ khỏi DOM sau khi bay xong — FruitPage.js đặt
// setTimeout hơi dài hơn thời lượng transition bên dưới 1 chút cho chắc.
//
// `flight` = { key, item, from: {top,left,width,height}, to: {...} } —
// toạ độ tuyệt đối trên viewport (từ getBoundingClientRect), nên component
// này luôn dùng position: fixed.
export default function FlyingFruit({ flight }) {
    const [landed, setLanded] = useState(false);

    useEffect(() => {
        // Đợi 1 khung hình để trình duyệt render xong vị trí "from" trước khi
        // đổi sang "to" — nếu đổi ngay trong cùng frame thì transition sẽ
        // không chạy (trình duyệt gộp lại thành 1 bước, không nội suy).
        const raf = requestAnimationFrame(() => setLanded(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    const rect = landed ? flight.to : flight.from;

    return (
        <div
            className="fixed z-50 pointer-events-none rounded-full overflow-hidden shadow-float"
            style={{
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                opacity: landed ? 0 : 1,
                transform: landed ? "scale(0.4) rotate(10deg)" : "scale(1) rotate(0deg)",
                transition:
                    "top 420ms cubic-bezier(0.34,1.56,0.64,1), left 420ms cubic-bezier(0.34,1.56,0.64,1), " +
                    "width 420ms cubic-bezier(0.34,1.56,0.64,1), height 420ms cubic-bezier(0.34,1.56,0.64,1), " +
                    "transform 420ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease-in 150ms",
            }}
        >
            <FoodThumbnail src={flight.item.imageUrl} alt={flight.item.fruitName} className="w-full h-full" />
        </div>
    );
}