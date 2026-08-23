import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { DollarSign, ShoppingCart, Users, TrendingUp, RefreshCw } from "lucide-react-native";
import fmtVND from "../utils/fmtVND";
import StatCard from "../components/StatCard";
import { apiFetch } from "./charts/helpers/apiHelpers";

import Chart01 from "./charts/Chart01";
import Chart02 from "./charts/Chart02";
import Chart03 from "./charts/Chart03";
import Chart04 from "./charts/Chart04";
import Chart05 from "./charts/Chart05";
import Chart06 from "./charts/Chart06";
import Chart07 from "./charts/Chart07";
import Chart08 from "./charts/Chart08";
import Chart09 from "./charts/Chart09";
import Chart10 from "./charts/Chart10";

export default function AnalystPage() {
  // ── Refresh control ───────────────────────────────────────────────────────
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((k) => k + 1);
    setLastRefresh(new Date());
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  const toArray = (data) => (Array.isArray(data) ? data : []);

  const toStats = (data) =>
    data && typeof data === "object" && !Array.isArray(data)
      ? {
          totalRevenue: Number(data.totalRevenue) || 0,
          totalBills: Number(data.totalBills) || 0,
          avgBill: Number(data.avgBill) || 0,
          totalCost: Number(data.totalCost) || 0,
        }
      : { totalRevenue: 0, totalBills: 0, avgBill: 0, totalCost: 0 };

  // [PERF-FIX] NGUYÊN NHÂN CHÍNH gây delay 1-1,5s khi chuyển trang: Drawer
  // không unmount AnalystPage khi rời tab, nên interval 60s này vẫn chạy
  // NGẦM vô thời hạn dù đang đứng ở trang khác — mỗi lần bắn, `refresh()`
  // đổi refreshKey → 8/11 effect bên dưới refetch đồng thời + 10 chart
  // (EMA/MA/PID/heatmap) re-render lại toàn bộ. Nếu người dùng bấm chuyển
  // trang đúng lúc tick này nổ ra, JS thread bận xử lý loạt request/re-render
  // đó, khiến thao tác chuyển trang bị khựng lại 1-1,5s dù không liên quan
  // gì tới trang đích. Chặn theo isFocused để việc polling dừng hẳn ngay khi
  // rời trang, chỉ chạy lại khi quay về Analyst.
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [isFocused, refresh]);

  // ── Timeframe states ──────────────────────────────────────────────────────
  const [tf2, setTf2] = useState("week");
  const [tf4, setTf4] = useState("day");
  const [tf5, setTf5] = useState("day");
  const [tf6, setTf6] = useState("week");
  const [tfPie, setTfPie] = useState("day");
  const [tfCustomer, setTfCustomer] = useState("hour");
  const [tfPid, setTfPid] = useState("day");

  // ── EMA / MA period states ────────────────────────────────────────────────
  const [c3MaPeriod, setC3MaPeriod] = useState(7);
  const [c4EmaPeriod, setC4EmaPeriod] = useState(5);
  const [c5EmaPeriod, setC5EmaPeriod] = useState(5);

  // ── Chart 3 date range ────────────────────────────────────────────────────
  const today = new Date();
  const fmtDate = (d) => d.toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(fmtDate(today));

  // ── Chart 7 breakeven ─────────────────────────────────────────────────────
  const [breakeven, setBreakeven] = useState(300_000);
  const [breakevenInput, setBreakevenInput] = useState("300000");

  // ── Fetched data ──────────────────────────────────────────────────────────
  const [statsData, setStatsData] = useState({ totalRevenue: 0, totalBills: 0, avgBill: 0, totalCost: 0 });
  const [chart1Data, setChart1Data] = useState([]);
  const [chart2Data, setChart2Data] = useState([]);
  const [chart3Data, setChart3Data] = useState([]);
  const [chart4Data, setChart4Data] = useState([]);
  const [chart5Data, setChart5Data] = useState([]);
  const [chart6Data, setChart6Data] = useState([]);
  const [cumulativeData, setCumulativeData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [pidRows, setPidRows] = useState([]);

  // ── API effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/weekly?offset=0").then((data) => setStatsData(toStats(data))).catch(console.error);
  }, [refreshKey]);

  useEffect(() => {
    apiFetch("/chart-data?tf=day").then((data) => setChart1Data(toArray(data))).catch(console.error);
  }, [refreshKey]);

  useEffect(() => {
    apiFetch(`/${tf2 !== "month" ? "weekly?offset=0" : "monthly?offset=0"}`).then((data) => setChart2Data(toArray(data))).catch(console.error);
  }, [tf2, refreshKey]);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    apiFetch(`/range?from=${dateFrom}&to=${dateTo}`).then((data) => setChart3Data(toArray(data))).catch(console.error);
  }, [dateFrom, dateTo, refreshKey]);

  useEffect(() => {
    apiFetch(`/chart-data?tf=${tf4}`).then((data) => setChart4Data(toArray(data))).catch(console.error);
  }, [tf4, refreshKey]);

  useEffect(() => {
    apiFetch(`/chart-data?tf=${tf5}`).then((data) => setChart5Data(toArray(data))).catch(console.error);
  }, [tf5, refreshKey]);

  useEffect(() => {
    apiFetch(`/chart-data?tf=${tf6}`).then((data) => setChart6Data(toArray(data))).catch(console.error);
  }, [tf6, refreshKey]);

  useEffect(() => {
    apiFetch("/cumulative").then((data) => setCumulativeData(toArray(data))).catch(console.error);
  }, [refreshKey]);

  useEffect(() => {
    const tf = tfCustomer === "hour" ? "day" : "week";
    apiFetch(`/chart-data?tf=${tf}`).then((data) => setCustomerData(toArray(data))).catch(console.error);
  }, [tfCustomer, refreshKey]);

  useEffect(() => {
    apiFetch(`/top-dishes?period=${tfPie}&top=7`).then((data) => setPieData(toArray(data))).catch(console.error);
  }, [tfPie, refreshKey]);

  useEffect(() => {
    apiFetch("/heatmap").then((data) => setHeatmapData(toArray(data))).catch(console.error);
  }, [refreshKey]);

  useEffect(() => {
    apiFetch(`/pid?tf=${tfPid}`).then((data) => setPidRows(toArray(data))).catch(console.error);
  }, [tfPid, refreshKey]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, gap: 20 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
    >
      {/* ── Header ── */}
      <View className="flex-row items-center justify-between flex-wrap gap-3">
        <View>
          <Text className="text-2xl font-black text-green-900">Dòng tiền hôm nay</Text>
          <Text className="text-gray-500 text-sm">
            Tổng quan hoạt động kinh doanh
            <Text className="text-xs text-gray-400">
              {"  ·  Cập nhật lúc "}
              {lastRefresh.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </Text>
          </Text>
        </View>
        <Pressable
          onPress={refresh}
          disabled={isRefreshing}
          className="flex-row items-center gap-2 px-4 py-2 rounded-xl bg-green-500"
          style={{ opacity: isRefreshing ? 0.6 : 1 }}
        >
          <RefreshCw size={14} color="white" />
          <Text className="text-white text-sm font-bold">{isRefreshing ? "Đang tải..." : "Làm mới"}</Text>
        </Pressable>
      </View>

      {/* ── Stat cards ── */}
      <View className="flex-row flex-wrap gap-3">
        <StatCard icon={DollarSign} label="Doanh thu hôm nay" value={fmtVND(statsData.totalRevenue)} color="green" />
        <StatCard icon={ShoppingCart} label="Tổng số bill" value={statsData.totalBills.toLocaleString()} color="blue" />
        <StatCard icon={Users} label="Bill trung bình" value={fmtVND(statsData.avgBill)} color="amber" />
        <StatCard icon={TrendingUp} label="Chi phí nguyên liệu" value={fmtVND(Math.round(statsData.totalCost))} color="rose" />
      </View>

      {/* ── Chart 01: Revenue by hour + EMA ── */}
      <Chart01 data={chart1Data} />

      {/* ── Chart 02: Revenue week/month ── */}
      <Chart02 data={chart2Data} tf={tf2} onTf={setTf2} />

      {/* ── Chart 03: Date range + MA ── */}
      <Chart03
        data={chart3Data}
        dateFrom={dateFrom}
        dateTo={dateTo}
        maPeriod={c3MaPeriod}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        onMaPeriod={setC3MaPeriod}
      />

      {/* ── Charts 04 & 05: Bill count + Avg bill ── */}
      <View style={{ gap: 20 }}>
        <Chart04 data={chart4Data} tf={tf4} emaPeriod={c4EmaPeriod} onTf={setTf4} onEma={setC4EmaPeriod} />
        <Chart05 data={chart5Data} tf={tf5} emaPeriod={c5EmaPeriod} onTf={setTf5} onEma={setC5EmaPeriod} />
      </View>

      {/* ── Chart 06: Revenue + Cost + Profit ── */}
      <Chart06 data={chart6Data} tf={tf6} onTf={setTf6} />

      {/* ── Chart 07: Cumulative profit + breakeven ── */}
      <Chart07
        data={cumulativeData}
        breakeven={breakeven}
        breakevenInput={breakevenInput}
        onBreakeven={(numVal, strVal) => {
          setBreakeven(numVal);
          setBreakevenInput(strVal);
        }}
      />

      {/* ── Chart 08: Customer traffic + avg bill ── */}
      <Chart08 data={customerData} tf={tfCustomer} onTf={setTfCustomer} />

      {/* ── Chart 09: Pie top dishes + Heatmap ── */}
      <Chart09 pieData={pieData} heatmapData={heatmapData} tfPie={tfPie} onTfPie={setTfPie} />

      {/* ── Chart 10: PID Ingredient Planning ── */}
      <Chart10 pidRows={pidRows} tf={tfPid} onTf={setTfPid} onRowsChange={setPidRows} />
    </ScrollView>
  );
}
