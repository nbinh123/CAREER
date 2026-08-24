import React from "react";
import { View, Text, ScrollView } from "react-native";
import { ArrowUpRight, DollarSign, Flame, ShoppingCart, TrendingUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import StatCard from "../components/StatCard";
import MiniAreaChart from "../components/MiniAreaChart";
import { getData } from "../utils/callAPI";
import fmtVND from "../utils/fmtVND";
import colors from "../theme/tokens";

const DEFAULT_TOP_DISHES = [{ name: "Chưa có dữ liệu", sold: 0 }];

/* ════════════════════════════════════════════════════════════
   REACT-QUERY: query functions thuần
   Đặt ở module scope, không phụ thuộc closure — mỗi hàm tự chuẩn hoá
   response về đúng shape mà component cần (giữ nguyên toàn bộ fallback
   logic của bản gốc: {} nếu thiếu data, [] nếu không phải mảng...).
════════════════════════════════════════════════════════════ */
const fetchHomeStats = async () => {
    try {
        const res = await getData({ url: "/analyst/stats" });
        const data = res?.data?.data;
        return data && typeof data === "object" ? data : {};
    } catch (err) {
        console.error("Failed to fetch today's data:", err);
        throw err;
    }
};

const fetchWeekRevenue = async () => {
    try {
        const res = await getData({ url: "/analyst/week-revenue" });
        const data = res?.data?.data;
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("Failed to fetch week's data:", err);
        throw err;
    }
};

const fetchTopDishes = async () => {
    try {
        const res = await getData({ url: "/analyst/top-dishes?period=week" });
        const data = res?.data?.data;
        const filteredData = Array.isArray(data)
            ? data.filter((item) => item?.name !== "Các món khác")
            : [];
        return filteredData.length > 0 ? filteredData : DEFAULT_TOP_DISHES;
    } catch (err) {
        console.error("Failed to fetch top 5 dishes:", err);
        throw err;
    }
};

/* ════════════════════════════════════════════════════════════
   Tách từng khối UI thành component riêng + React.memo.

   Lý do: HomePage có 3 useQuery ĐỘC LẬP (todayData/miniRev/topDishes) —
   không đảm bảo cả 3 resolve CÙNG lúc (độ trễ mạng/backend khác nhau).
   Nếu để nguyên inline như bản gốc, MỖI lần 1 trong 3 query resolve
   xong, HomePage re-render lại TOÀN BỘ — kéo theo cả 4 StatCard, biểu
   đồ MiniAreaChart, và danh sách top dishes render lại dù chỉ 1 trong 3
   mảng dữ liệu thực sự thay đổi. Tách riêng + memo để mỗi phần CHỈ
   re-render khi đúng dữ liệu của chính nó thay đổi.

   StatsRow nhận PRIMITIVE (number) thay vì nguyên object `todayData` —
   để React.memo so sánh đúng GIÁ TRỊ hiển thị thay vì so theo reference
   của object (vốn luôn mới sau mỗi lần refetch dù số liệu không đổi).
════════════════════════════════════════════════════════════ */
const StatsRow = React.memo(function StatsRow({ totalRev, totalBills, totalCost, avgBill }) {
    return (
        <View className="flex-row flex-wrap gap-3">
            <StatCard icon={DollarSign} label="Doanh thu" value={fmtVND(totalRev)} sub="+12% so với hôm qua" color="green" />
            <StatCard icon={ShoppingCart} label="Số đơn" value={totalBills ?? 0} sub="Đang xử lý: 3" color="blue" />
            <StatCard icon={TrendingUp} label="Tổng chi phí" value={fmtVND(totalCost)} sub="Giờ cao điểm: 12h" color="amber" />
            <StatCard icon={TrendingUp} label="Bill trung bình" value={fmtVND(avgBill)} sub="↑ 8% so với tuần trước" color="rose" />
        </View>
    );
});

// Ghi chú (chưa vá, mức độ thấp — cùng lý do như StatsSection ở
// VoucherPage.js): `data` vẫn là mảng nguyên reference từ react-query, về
// lý thuyết có thể "mới nhưng giá trị giống hệt" nếu có refetch nền trong
// lúc trang đang mở. Không xử lý thêm vì staleTime 10s + RN mặc định
// không tự bật refetch-on-focus khiến khả năng xảy ra thấp, và đây chỉ là
// 1 card (không phải danh sách N phần tử).
const RevenueChartCard = React.memo(function RevenueChartCard({ data }) {
    return (
        <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row items-center justify-between mb-3">
                <Text className="font-bold text-gray-700">Doanh thu 7 ngày qua</Text>
                <View className="flex-row items-center gap-1">
                    <ArrowUpRight size={14} color={colors.green[600]} />
                    <Text className="text-xs text-green-600 font-semibold">+9.4%</Text>
                </View>
            </View>
            <MiniAreaChart data={data} xKey="d" yKey="v" height={220} />
        </View>
    );
});

const TopDishesCard = React.memo(function TopDishesCard({ dishes, maxValue }) {
    return (
        <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row items-center gap-2 mb-4">
                <Flame size={17} color="#f97316" />
                <Text className="font-bold text-gray-700">Bán chạy tuần này</Text>
            </View>
            <View style={{ gap: 14 }}>
                {dishes.map((item, i) => {
                    const currentValue = item?.sold || item?.value || 0;
                    const percent = (currentValue / maxValue) * 100;

                    return (
                        <View key={item?.name ?? i}>
                            <View className="flex-row justify-between mb-1">
                                <Text className="text-sm font-semibold text-gray-700 flex-1 mr-2" numberOfLines={1}>
                                    {item?.name}
                                </Text>
                                <Text className="text-xs font-bold text-green-600">{currentValue}</Text>
                            </View>
                            <View className="h-1.5 bg-green-100 rounded-full">
                                <View style={{ width: `${percent}%` }} className="h-full bg-green-400 rounded-full" />
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
});

// Nội dung 100% tĩnh (không đọc bất kỳ state/query nào — kể cả dòng "8 món
// • 6 danh mục • 7 món đang bán" trong bản gốc vốn đã là text cố định, không
// đổi khi có). Không nhận prop nào → React.memo luôn bailout sau lần render
// đầu, KHÔNG BAO GIỜ re-render lại trong suốt vòng đời trang.
const MenuBanner = React.memo(function MenuBanner() {
    return (
        <LinearGradient
            colors={[colors.green[500], colors.emerald[500], "#14b8a6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 16, padding: 20 }}
        >
            <View className="flex-row items-start justify-between">
                <View>
                    <Text className="text-xl font-black text-white">Menu hôm nay</Text>
                    <Text className="text-green-100 text-sm mt-1">8 món • 6 danh mục • 7 món đang bán</Text>
                </View>
                <View className="bg-white/20 rounded-xl px-3 py-1.5">
                    <Text className="text-sm font-bold text-white">Đang mở</Text>
                </View>
            </View>
        </LinearGradient>
    );
});

export default function HomePage() {
    // 3 query độc lập, key cố định (không có filter/search nào ở trang này) —
    // chạy song song tự nhiên như 3 useEffect cũ, nhưng có cache: quay lại
    // trang trong vòng staleTime sẽ không gọi lại API.
    const { data: todayData = {} } = useQuery({
        queryKey: ["home-stats"],
        queryFn: fetchHomeStats,
    });

    const { data: miniRev = [] } = useQuery({
        queryKey: ["home-week-revenue"],
        queryFn: fetchWeekRevenue,
    });

    const { data: topDishes = DEFAULT_TOP_DISHES } = useQuery({
        queryKey: ["home-top-dishes"],
        queryFn: fetchTopDishes,
    });

    // Không bọc useMemo cho 3 dòng dưới đây — đây là phép tính CỰC RẺ (kiểm
    // tra Array.isArray, đọc 1 phần tử đầu mảng), bản thân bộ máy useMemo
    // (so sánh dependency array) còn tốn hơn phép tính này. Bọc useMemo ở
    // đây là phản tác dụng, không phải tối ưu — xem mục "không over-
    // optimize" trong quy tắc chung. Chúng vẫn giữ ổn định reference một
    // cách tự nhiên: khi miniRev/topDishes không đổi, biểu thức bên dưới
    // luôn trả về ĐÚNG reference cũ (không tạo mảng mới), nên StatsRow/
    // RevenueChartCard/TopDishesCard vẫn bailout đúng cách nhờ React.memo.
    const safeMiniRev = Array.isArray(miniRev) ? miniRev : [];
    const safeTopDishes = Array.isArray(topDishes) && topDishes.length > 0 ? topDishes : DEFAULT_TOP_DISHES;
    const topDishMaxValue = safeTopDishes[0]?.sold || safeTopDishes[0]?.value || 1;

    const todayLabel = new Date().toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, gap: 20 }}>
            <View>
                <Text className="text-2xl font-black text-green-900">Tổng quan 7 ngày gần nhất</Text>
                <Text className="text-gray-500 text-sm mt-0.5">{todayLabel}</Text>
            </View>

            <StatsRow
                totalRev={todayData?.totalRev}
                totalBills={todayData?.totalBills}
                totalCost={todayData?.totalCost}
                avgBill={todayData?.avgBill}
            />

            <RevenueChartCard data={safeMiniRev} />

            <TopDishesCard dishes={safeTopDishes} maxValue={topDishMaxValue} />

            <MenuBanner />
        </ScrollView>
    );
}