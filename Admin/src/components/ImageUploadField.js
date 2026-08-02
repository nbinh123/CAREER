import { useState, useEffect } from "react";
import { ImagePlus } from "lucide-react";

// Chọn ảnh + xem trước, KHÔNG tự gọi API upload — chỉ trả File gốc ra ngoài
// qua onSelect(file). Ảnh thật sự được gửi lên server khi form cha gọi
// addFood(food, file) / updateFood(food, file) (hoặc bản staged
// stageAddFood/stageUpdateFood) từ useFoodZustand — FoodService.buildPayload
// sẽ tự đóng gói file này vào field "image" trong cùng request multipart
// với các field khác của món ăn, khớp với upload.single('image') ở backend.
export default function ImageUploadField({ currentUrl, onSelect }) {
    const [preview, setPreview] = useState(currentUrl || null);
    useEffect(() => {
        setPreview(currentUrl || null);
    }, [currentUrl]);

    const handleChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPreview(URL.createObjectURL(file));
        onSelect(file);
    };

    return (
        <label className="cursor-pointer block">
            <div className={`relative w-full h-36 rounded-xl overflow-hidden border-2 border-dashed transition-colors
                ${preview ? "border-transparent" : "border-gray-200 hover:border-green-300"}`}>
                {preview ? (
                    <img src={preview} alt="Xem trước" className="w-full h-full object-cover" />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                        <ImagePlus size={22} />
                        <span className="text-xs">Nhấn để tải ảnh lên</span>
                    </div>
                )}
            </div>
            <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleChange}
            />
        </label>
    );
}