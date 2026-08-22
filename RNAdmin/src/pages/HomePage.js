import React, { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { ArrowUpRight, DollarSign, Flame, ShoppingCart, TrendingUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import StatCard from "../components/StatCard";
import MiniAreaChart from "../components/MiniAreaChart";
import { getData } from "../utils/callAPI";
import fmtVND from "../utils/fmtVND";
import colors from "../theme/tokens";

const DEFAULT_TOP_DISHES = [{ name: "Chưa có dữ liệu", sold: 0 }];

export default function HomePage() {
  const [miniRev, setMiniRev] = useState([]);
  const [todayData, setTodayData] = useState({});
  const [topDishes, setTopDishes] = useState(DEFAULT_TOP_DISHES);

  useEffect(() => {
    getData({ url: "/analyst/stats" })
      .then((response) => {
        const data = response?.data?.data;
        setTodayData(data && typeof data === "object" ? data : {});
      })
      .catch((err) => {
        console.error("Failed to fetch today's data:", err);
        setTodayData({});
      });
  }, []);

  useEffect(() => {
    getData({ url: "/analyst/week-revenue" })
      .then((response) => {
        const data = response?.data?.data;
        setMiniRev(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to fetch week's data:", err);
        setMiniRev([]);
      });
  }, []);

  useEffect(() => {
    getData({ url: "/analyst/top-dishes?period=week" })
      .then((response) => {
        const data = response?.data?.data;
        const filteredData = Array.isArray(data)
          ? data.filter((item) => item?.name !== "Các món khác")
          : [];
        setTopDishes(filteredData.length > 0 ? filteredData : DEFAULT_TOP_DISHES);
      })
      .catch((err) => {
        console.error("Failed to fetch top 5 dishes:", err);
        setTopDishes(DEFAULT_TOP_DISHES);
      });
  }, []);

  const safeMiniRev = Array.isArray(miniRev) ? miniRev : [];
  const safeTopDishes = Array.isArray(topDishes) && topDishes.length > 0 ? topDishes : DEFAULT_TOP_DISHES;

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

      <View className="flex-row flex-wrap gap-3">
        <StatCard icon={DollarSign} label="Doanh thu" value={fmtVND(todayData?.totalRev)} sub="+12% so với hôm qua" color="green" />
        <StatCard icon={ShoppingCart} label="Số đơn" value={todayData?.totalBills ?? 0} sub="Đang xử lý: 3" color="blue" />
        <StatCard icon={TrendingUp} label="Tổng chi phí" value={fmtVND(todayData?.totalCost)} sub="Giờ cao điểm: 12h" color="amber" />
        <StatCard icon={TrendingUp} label="Bill trung bình" value={fmtVND(todayData?.avgBill)} sub="↑ 8% so với tuần trước" color="rose" />
      </View>

      <View className="bg-white rounded-2xl p-4 border border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-bold text-gray-700">Doanh thu 7 ngày qua</Text>
          <View className="flex-row items-center gap-1">
            <ArrowUpRight size={14} color={colors.green[600]} />
            <Text className="text-xs text-green-600 font-semibold">+9.4%</Text>
          </View>
        </View>
        <MiniAreaChart data={safeMiniRev} xKey="d" yKey="v" height={220} />
      </View>

      <View className="bg-white rounded-2xl p-4 border border-gray-100">
        <View className="flex-row items-center gap-2 mb-4">
          <Flame size={17} color="#f97316" />
          <Text className="font-bold text-gray-700">Bán chạy tuần này</Text>
        </View>
        <View style={{ gap: 14 }}>
          {safeTopDishes.map((item, i) => {
            const currentValue = item?.sold || item?.value || 0;
            const maxValue = safeTopDishes[0]?.sold || safeTopDishes[0]?.value || 1;
            const percent = (currentValue / maxValue) * 100;

            return (
              <View key={i}>
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
    </ScrollView>
  );
}
