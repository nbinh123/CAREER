// src/pages/AnalystPage.js
// [UI] Chuyển đổi AnalystPage.js gốc. Giữ nguyên 100% state của UI (timeframe
// tf2/tf4/tf5/tf6/tfPie/tfCustomer/tfPid, EMA/MA period, date range Chart03,
// breakeven Chart07) — chỉ thay LỚP DỮ LIỆU (useEffect + useState + fetch thủ
// công + refreshKey) bằng @tanstack/react-query, theo yêu cầu tối ưu hiệu
// suất tiếp theo sau đợt phân tích trước đó. Lý do đổi và lợi ích cụ thể:
//
//   1) Cache + dedup theo query key: chart1 (cố định "day"), chart4/5/6 (tf4/
//      tf5/tf6) và customerData (Chart08) đều gọi CÙNG endpoint
//      `/chart-data?tf=X` — bản cũ gọi riêng lẻ 4-5 request dù tf trùng nhau
//      (vd mặc định tf4=tf5="day" đã trùng ngay từ lúc mount). Dùng chung 1
//      queryKey ["analyst","chart-data",tf] cho tất cả → trùng tf thì chỉ 1
//      request thật, các chart còn lại dùng lại cache — giảm số lượng gọi
//      mạng thực tế mà không đổi hành vi hiển thị.
//   2) refetchInterval thay cho setInterval thủ công — mỗi query tự poll độc
//      lập, và tự động tôn trọng focusManager (xem App.js: AppState → app
//      xuống nền thì toàn bộ polling tạm dừng, không cần code thêm).
//   3) Thêm useIsFocused() (React Navigation) gate refetchInterval — dừng
//      polling khi người dùng đang ở màn hình KHÁC trong app (không chỉ lúc
//      app xuống nền) — đúng ý "chạy mượt, không lãng phí" đã nêu ở đợt phân
//      tích trước, mà bản setInterval cũ không làm được (nó chạy bất kể màn
//      hình có đang được xem hay không, miễn AnalystPage còn mounted).
//   4) placeholderData: keepPreviousData cho các query đổi theo lựa chọn
//      người dùng (đổi tf/kỳ/ngày) — giữ biểu đồ cũ hiển thị trong lúc chờ
//      dữ liệu mới, tránh biểu đồ nháy về rỗng rồi mới có số — mượt hơn hẳn
//      bản cũ (trước đó state reset về [] ngay khi tf đổi, đợi fetch xong).
//   5) isRefreshing/lastRefresh không còn là state thủ công — suy ra trực
//      tiếp từ useIsFetching()/dataUpdatedAt của react-query, bớt 1 nguồn
//      state có thể lệch với thực tế đang fetch hay không.
//
// Chart10 (PID) là điểm cần chú ý nhất: Chart10.js gọi onRowsChange(newRows)
// SAU KHI PATCH THÀNH CÔNG để cập nhật lạc quan UI — hàm này KHÔNG đổi chữ ký
// (vẫn nhận nguyên mảng rows mới), chỉ đổi bên trong từ setPidRows(newRows)
// sang queryClient.setQueryData(pidQueryKey, newRows) — nên Chart10.js không
// phải sửa gì cả.
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, InteractionManager } from "react-native";
import { DollarSign, ShoppingCart, Users, TrendingUp, RefreshCw } from "lucide-react-native";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient, useIsFetching, keepPreviousData } from "@tanstack/react-query";
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

// [GIU-NGUYEN] toArray/toStats giữ nguyên nguyên văn bản gốc — chỉ hoist ra
// module scope vì không phụ thuộc props/state, không cần định nghĩa lại mỗi
// render (trước đây định nghĩa trong thân component, vô hại nhưng thừa).
const toArray = (data) => (Array.isArray(data) ? data : []);

const DEFAULT_STATS = { totalRevenue: 0, totalBills: 0, avgBill: 0, totalCost: 0 };

const toStats = (data) =>
  data && typeof data === "object" && !Array.isArray(data)
    ? {
        totalRevenue: Number(data.totalRevenue) || 0,
        totalBills: Number(data.totalBills) || 0,
        avgBill: Number(data.avgBill) || 0,
        totalCost: Number(data.totalCost) || 0,
      }
    : DEFAULT_STATS;

const POLL_MS = 60_000; // giữ đúng chu kỳ auto-poll 60s của bản gốc

// [MOI — tối ưu hiệu suất, đợt 2] 10 chart đều vẽ SVG khá nặng (nhiều nhất
// là Chart07/Chart10) — nếu mount đồng thời NGAY khi màn hình Analyst vừa
// chuyển vào (đúng lúc animation chuyển màn hình của Drawer đang chạy) sẽ
// giật/khựng animation đó. StatCards (rẻ, không SVG) vẫn render ngay; 10
// chart hoãn mount tới khi InteractionManager báo mọi animation/tương tác đã
// xong. Việc fetch dữ liệu (các useQuery ở trên) KHÔNG bị hoãn theo — chạy
// song song ngay từ đầu — nên phần lớn trường hợp khi chart thật sự mount
// (thường chỉ trễ vài trăm ms) thì dữ liệu đã sẵn sàng, không có màn hình
// trống rồi mới có số.
const SKELETON_HEIGHTS = [340, 340, 380, 230, 230, 350, 500, 340, 280, 620];

function ChartsSkeleton() {
  return (
    <>
      {SKELETON_HEIGHTS.map((h, i) => (
        <View key={i} className="bg-white rounded-2xl border border-gray-100" style={{ height: h }} />
      ))}
    </>
  );
}

export default function AnalystPage() {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused(); // màn hình Analyst có đang được xem hay không
  const refetchInterval = isFocused ? POLL_MS : false;

  // Hoãn mount 10 chart tới sau khi interaction/animation hiện tại (vd
  // animation mở Drawer) đã xong — xem ghi chú SKELETON_HEIGHTS ở trên.
  const [chartsReady, setChartsReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setChartsReady(true));
    return () => task.cancel();
  }, []);

  // ── Timeframe states (giữ nguyên) ─────────────────────────────────────────
  const [tf2, setTf2] = useState("week");
  const [tf4, setTf4] = useState("day");
  const [tf5, setTf5] = useState("day");
  const [tf6, setTf6] = useState("week");
  const [tfPie, setTfPie] = useState("day");
  const [tfCustomer, setTfCustomer] = useState("hour");
  const [tfPid, setTfPid] = useState("day");

  // ── EMA / MA period states (giữ nguyên) ───────────────────────────────────
  const [c3MaPeriod, setC3MaPeriod] = useState(7);
  const [c4EmaPeriod, setC4EmaPeriod] = useState(5);
  const [c5EmaPeriod, setC5EmaPeriod] = useState(5);

  // ── Chart 3 date range (giữ nguyên) ───────────────────────────────────────
  const today = new Date();
  const fmtDate = (d) => d.toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(fmtDate(today));

  // ── Chart 7 breakeven (giữ nguyên, chỉ bọc useCallback để prop ổn định
  //    tham chiếu — cần cho React.memo ở Chart07 không bị re-render thừa) ───
  const [breakeven, setBreakeven] = useState(300_000);
  const [breakevenInput, setBreakevenInput] = useState("300000");
  const handleBreakeven = useCallback((numVal, strVal) => {
    setBreakeven(numVal);
    setBreakevenInput(strVal);
  }, []);

  // ── Derived tf cho Chart08 (giữ đúng logic gốc: hour→day, còn lại→week) ──
  const customerTf = tfCustomer === "hour" ? "day" : "week";

  // ══ QUERIES ════════════════════════════════════════════════════════════
  // Ghi chú key: nhiều chart cùng gọi `/chart-data?tf=X` (Chart01 cố định
  // "day", Chart04→tf4, Chart05→tf5, Chart06→tf6, Chart08→customerTf) — dùng
  // chung tiền tố ["analyst","chart-data",tf] để trùng tf thì tự dedup.
  const statsQuery = useQuery({
    queryKey: ["analyst", "weekly", 0],
    queryFn: () => apiFetch("/weekly?offset=0"),
    refetchInterval,
  });

  const chart1Query = useQuery({
    queryKey: ["analyst", "chart-data", "day"],
    queryFn: () => apiFetch("/chart-data?tf=day"),
    refetchInterval,
  });

  const chart2Query = useQuery({
    queryKey: ["analyst", "revenue-period", tf2],
    queryFn: () => apiFetch(`/${tf2 !== "month" ? "weekly?offset=0" : "monthly?offset=0"}`),
    refetchInterval,
    placeholderData: keepPreviousData,
  });

  const chart3Query = useQuery({
    queryKey: ["analyst", "range", dateFrom, dateTo],
    queryFn: () => apiFetch(`/range?from=${dateFrom}&to=${dateTo}`),
    enabled: !!dateFrom && !!dateTo,
    refetchInterval,
    placeholderData: keepPreviousData,
  });

  const chart4Query = useQuery({
    queryKey: ["analyst", "chart-data", tf4],
    queryFn: () => apiFetch(`/chart-data?tf=${tf4}`),
    refetchInterval,
    placeholderData: keepPreviousData,
  });

  const chart5Query = useQuery({
    queryKey: ["analyst", "chart-data", tf5],
    queryFn: () => apiFetch(`/chart-data?tf=${tf5}`),
    refetchInterval,
    placeholderData: keepPreviousData,
  });

  const chart6Query = useQuery({
    queryKey: ["analyst", "chart-data", tf6],
    queryFn: () => apiFetch(`/chart-data?tf=${tf6}`),
    refetchInterval,
    placeholderData: keepPreviousData,
  });

  const cumulativeQuery = useQuery({
    queryKey: ["analyst", "cumulative"],
    queryFn: () => apiFetch("/cumulative"),
    refetchInterval,
  });

  const customerQuery = useQuery({
    queryKey: ["analyst", "chart-data", customerTf],
    queryFn: () => apiFetch(`/chart-data?tf=${customerTf}`),
    refetchInterval,
    placeholderData: keepPreviousData,
  });

  const pieQuery = useQuery({
    queryKey: ["analyst", "top-dishes", tfPie, 7],
    queryFn: () => apiFetch(`/top-dishes?period=${tfPie}&top=7`),
    refetchInterval,
    placeholderData: keepPreviousData,
  });

  const heatmapQuery = useQuery({
    queryKey: ["analyst", "heatmap"],
    queryFn: () => apiFetch("/heatmap"),
    refetchInterval,
  });

  const pidQueryKey = ["analyst", "pid", tfPid];
  const pidQuery = useQuery({
    queryKey: pidQueryKey,
    queryFn: () => apiFetch(`/pid?tf=${tfPid}`),
    refetchInterval,
    placeholderData: keepPreviousData,
  });

  // Chart10 cập nhật lạc quan sau khi PATCH thành công — ghi thẳng vào cache
  // của query hiện hành thay vì setState cục bộ (xem ghi chú đầu file).
  const handlePidRowsChange = useCallback(
    (newRows) => {
      queryClient.setQueryData(pidQueryKey, newRows);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, tfPid]
  );

  // ── Trạng thái làm mới suy ra từ react-query, không cần state thủ công ───
  const isRefreshing = useIsFetching({ queryKey: ["analyst"] }) > 0;
  const lastRefresh = statsQuery.dataUpdatedAt ? new Date(statsQuery.dataUpdatedAt) : new Date();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["analyst"] });
  }, [queryClient]);

  // ── Giá trị hiển thị (áp dụng toArray/toStats như bản gốc) ────────────────
  const statsData = toStats(statsQuery.data);
  const chart1Data = toArray(chart1Query.data);
  const chart2Data = toArray(chart2Query.data);
  const chart3Data = toArray(chart3Query.data);
  const chart4Data = toArray(chart4Query.data);
  const chart5Data = toArray(chart5Query.data);
  const chart6Data = toArray(chart6Query.data);
  const cumulativeData = toArray(cumulativeQuery.data);
  const customerData = toArray(customerQuery.data);
  const pieData = toArray(pieQuery.data);
  const heatmapData = toArray(heatmapQuery.data);
  const pidRows = toArray(pidQuery.data);

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

      {/* ── 10 chart — hoãn mount tới khi hết animation/tương tác (xem ghi
          chú SKELETON_HEIGHTS đầu file); trong lúc chờ hiện khung skeleton
          giữ đúng chiều cao gần đúng để không giật layout khi chart popIn. */}
      {chartsReady ? (
        <>
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
          <Chart07 data={cumulativeData} breakeven={breakeven} breakevenInput={breakevenInput} onBreakeven={handleBreakeven} />

          {/* ── Chart 08: Customer traffic + avg bill ── */}
          <Chart08 data={customerData} tf={tfCustomer} onTf={setTfCustomer} />

          {/* ── Chart 09: Pie top dishes + Heatmap ── */}
          <Chart09 pieData={pieData} heatmapData={heatmapData} tfPie={tfPie} onTfPie={setTfPie} />

          {/* ── Chart 10: PID Ingredient Planning ── */}
          <Chart10 pidRows={pidRows} tf={tfPid} onTf={setTfPid} onRowsChange={handlePidRowsChange} />
        </>
      ) : (
        <ChartsSkeleton />
      )}
    </ScrollView>
  );
}
