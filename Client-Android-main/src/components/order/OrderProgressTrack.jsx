// src/components/order/OrderProgressTrack.jsx
import React from "react";
import { View, Text } from "react-native";
import { Check } from "lucide-react-native";

// 4 giai đoạn hiển thị trên thanh. `pending` (trước "confirmed") không có
// vị trí riêng trên thanh — được xử lý bằng label phụ phía trên.
const STAGES = [
    { key: "confirmed", label: "Đã nhận" },
    { key: "preparing", label: "Đang làm" },
    { key: "delivering", label: "Đang giao" },
    { key: "completed", label: "Hoàn tất" },
];

export default function OrderProgressTrack({ status }) {
    if (status === "cancelled") {
        return (
            <View className="bg-chili/10 rounded-lg px-3 py-2 my-2">
                <Text className="text-chili-dark text-xs font-display font-medium text-center">
                    Đơn hàng đã bị huỷ
                </Text>
            </View>
        );
    }

    const currentIndex = STAGES.findIndex((s) => s.key === status);
    // pending => currentIndex = -1, chưa có bước nào active/done

    return (
        <View className="py-2">
            {status === "pending" ? (
                <Text className="text-steel text-[11px] mb-2 text-center">
                    Đang chờ xác nhận...
                </Text>
            ) : null}

            <View className="flex-row items-start">
                {STAGES.map((stage, idx) => {
                    const isDone = idx < currentIndex || (idx === currentIndex && status === "completed");
                    const isActive = idx === currentIndex && status !== "completed";

                    return (
                        <React.Fragment key={stage.key}>
                            <View className="items-center" style={{ width: 56 }}>
                                <View
                                    className={`w-6 h-6 rounded-full items-center justify-center ${isDone
                                            ? "bg-chili"
                                            : isActive
                                                ? "bg-chili/15 border-2 border-chili"
                                                : "bg-paper-dim border border-ink/10"
                                        }`}
                                >
                                    {isDone ? (
                                        <Check size={12} color="#fff" />
                                    ) : (
                                        <View
                                            className={`w-2 h-2 rounded-full ${isActive ? "bg-chili" : "bg-steel-light"
                                                }`}
                                        />
                                    )}
                                </View>
                                <Text
                                    className={`text-[10px] mt-1 text-center ${isDone || isActive ? "text-ink font-medium" : "text-steel-light"
                                        }`}
                                >
                                    {stage.label}
                                </Text>
                            </View>

                            {idx < STAGES.length - 1 ? (
                                <View
                                    className={`flex-1 h-[2px] mt-3 ${idx < currentIndex ? "bg-chili" : "bg-paper-dim"
                                        }`}
                                />
                            ) : null}
                        </React.Fragment>
                    );
                })}
            </View>
        </View>
    );
}