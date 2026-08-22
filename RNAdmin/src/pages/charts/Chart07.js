// src/pages/charts/Chart07.js
// [UI] Chuyển từ Chart07.js gốc (401 dòng — phức tạp nhất trong 10 chart,
// xem ghi chú "Chart library chưa chốt" cũ ở README). KHÔNG dùng chung
// BarLineChart vì layout hoàn toàn riêng (progress bar hoà vốn, chọn số
// tick, gradient đổi màu tại điểm hoà vốn) — viết component riêng, đúng như
// bản gốc cũng tách hẳn Chart07 khỏi các chart còn lại.
//
// Điểm kỹ thuật quan trọng nhất khi chuyển: gradient đổi màu tại breakeven
// (`cpGrad`) phải tô theo BOUNDING BOX của chính đường vẽ (dataMin..dataMax
// của cumulativeProfit), không theo domain trục Y — y hệt cách recharts vẽ
// <Line connectNulls=false> thành DUY NHẤT 1 <path> có nhiều đoạn "M..L..".
// Vì vậy ở đây cũng gom toàn bộ segment (ngăn ở chỗ null — ngày tương lai)
// vào 1 chuỗi `d` duy nhất cho 1 <Path>, để bounding box khớp beStop tính
// theo dataMin/dataMax — nếu tách thành nhiều <Path> riêng, mỗi đoạn sẽ có
// bounding box khác nhau và gradient bị sai.
//
// Hover tooltip (không có trên RN) → chạm vào biểu đồ để chọn 1 ngày xem số
// liệu, mặc định chọn sẵn ngày gần nhất có dữ liệu.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path, Line as SvgLine, Text as SvgText, Circle } from "react-native-svg";
import { TrendingUp, Target, ArrowUp } from "lucide-react-native";

function fmtVND(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

function fmtShort(v) {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${s}${Math.round(a / 1_000)}k`;
  return v.toString();
}

const TICK_OPTIONS = [4, 5, 6, 8, 10];
const AXIS_TICK_DAYS = [1, 5, 10, 15, 20, 25, 30];
const VIEW_W = 340;

export default function Chart07({ data = [], breakeven: externalBe, breakevenInput: externalBeInput, onBreakeven }) {
  const [localBe, setLocalBe] = useState(300000);
  const [localBeStr, setLocalBeStr] = useState("300000");
  const [tickCount, setTickCount] = useState(6);
  const [selectedDay, setSelectedDay] = useState(null);

  const be = externalBe ?? localBe;
  const beInputV = externalBeInput ?? localBeStr;

  const handleBeChange = (str) => {
    const v = parseInt(str, 10);
    if (onBreakeven) {
      onBreakeven(isNaN(v) ? be : v, str);
    } else {
      setLocalBeStr(str);
      if (!isNaN(v) && v > 0) setLocalBe(v);
    }
  };

  const { chartData, lastDayWithData } = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const filled = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const found = safeData.find((d) => d?.day === day);
      return found ? { ...found, day } : { day, cumulativeProfit: null };
    });

    const lastDay = filled.reduce((acc, d) => (d.cumulativeProfit !== null ? d.day : acc), null);
    let lastVal = null;
    const result = filled.map((d) => {
      if (d.cumulativeProfit !== null) {
        lastVal = d.cumulativeProfit;
        return d;
      }
      if (lastVal !== null && d.day <= lastDay) return { ...d, cumulativeProfit: lastVal };
      return d;
    });
    return { chartData: result, lastDayWithData: lastDay };
  }, [data]);

  const daysInMonth = chartData.length;
  const validProfits = chartData.map((d) => d.cumulativeProfit).filter((v) => v !== null && v !== undefined);
  const maxProfit = validProfits.length ? Math.max(...validProfits) : 0;
  const minProfit = validProfits.length ? Math.min(...validProfits, 0) : 0;
  const latestProfit = validProfits.length ? validProfits[validProfits.length - 1] : 0;
  const exceeded = latestProfit >= be;
  const progress = Math.min(100, Math.max(0, be > 0 ? (latestProfit / be) * 100 : 0));
  const remaining = be - latestProfit;

  const topTick = maxProfit > be ? maxProfit * 2 : be * 2;
  let bottomTick = 0;
  if (minProfit < 0) {
    const rawStep = topTick / tickCount;
    bottomTick = Math.floor(minProfit / rawStep) * rawStep;
  }
  const totalRange = topTick - bottomTick;
  const step = totalRange / tickCount;
  const customTicks = Array.from({ length: tickCount + 1 }, (_, i) => bottomTick + i * step);

  const dataMin = validProfits.length ? Math.min(...validProfits) : 0;
  const dataMax = validProfits.length ? Math.max(...validProfits) : 0;
  let beStop;
  if (dataMax <= be) beStop = 100;
  else if (dataMin >= be) beStop = 0;
  else beStop = (((be - dataMin) / (dataMax - dataMin)) === 0 ? 0 : (1 - (be - dataMin) / (dataMax - dataMin)) * 100).toFixed(2);

  // ── Toạ độ vẽ ──
  const padL = 42;
  const padR = 10;
  const padT = 10;
  const padB = 20;
  const height = 320;
  const plotW = VIEW_W - padL - padR;
  const plotH = height - padT - padB;

  const xOfDay = (day) => padL + ((day - 1) / Math.max(1, daysInMonth - 1)) * plotW;
  const yOfVal = (v) => {
    const clamped = Math.min(topTick, Math.max(bottomTick, v));
    return padT + plotH - ((clamped - bottomTick) / (totalRange || 1)) * plotH;
  };

  // Gom toàn bộ đoạn (ngăn cách ở chỗ null) vào 1 path duy nhất — xem ghi
  // chú đầu file về lý do (bounding box của gradient).
  const pathD = useMemo(() => {
    const segments = [];
    let current = [];
    chartData.forEach((d) => {
      if (d.cumulativeProfit === null || d.cumulativeProfit === undefined) {
        if (current.length) segments.push(current);
        current = [];
        return;
      }
      current.push({ x: xOfDay(d.day), y: yOfVal(d.cumulativeProfit) });
    });
    if (current.length) segments.push(current);
    return segments
      .map((seg) => `M ${seg[0].x} ${seg[0].y} ` + seg.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" "))
      .join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, topTick, bottomTick, tickCount]);

  const selDay = selectedDay ?? lastDayWithData ?? 1;
  const selRow = chartData.find((d) => d.day === selDay);
  const selPoint = selRow && selRow.cumulativeProfit !== null ? { x: xOfDay(selDay), y: yOfVal(selRow.cumulativeProfit) } : null;

  return (
    <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* ══ HEADER ══ */}
      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-start justify-between gap-3 mb-4">
          <View className="flex-row items-center gap-3" style={{ flexShrink: 1 }}>
            <View className="rounded-xl bg-green-50 items-center justify-center" style={{ width: 34, height: 34 }}>
              <TrendingUp size={15} color="#16a34a" />
            </View>
            <View>
              <Text className="text-xs font-semibold text-gray-400" style={{ letterSpacing: 1 }}>LỢI NHUẬN TÍCH LŨY</Text>
              <Text className="font-bold" style={{ fontSize: 22, color: exceeded ? "#16a34a" : "#111827" }}>
                {fmtVND(latestProfit)}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5 rounded-xl px-3 py-2" style={{ backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa" }}>
            <Target size={12} color="#f97316" />
            <Text className="text-xs font-medium" style={{ color: "#f97316" }}>Hòa vốn</Text>
            <TextInput
              value={beInputV}
              onChangeText={handleBeChange}
              keyboardType="numeric"
              style={{ fontSize: 12, fontFamily: "monospace", fontWeight: "600", color: "#ea580c", textAlign: "right", padding: 0, minWidth: 70 }}
            />
          </View>
        </View>

        {/* Thanh tiến trình */}
        <View className="mt-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-medium text-gray-400">Tiến trình hòa vốn</Text>
            <View className="flex-row items-center gap-2">
              {exceeded && (
                <View className="flex-row items-center gap-1 rounded-full px-2" style={{ backgroundColor: "#dcfce7", paddingVertical: 2 }}>
                  <ArrowUp size={9} color="#15803d" />
                  <Text className="font-bold" style={{ fontSize: 10, color: "#15803d" }}>Đã vượt</Text>
                </View>
              )}
              <Text className="font-bold" style={{ fontSize: 14, color: exceeded ? "#16a34a" : "#f97316" }}>{progress.toFixed(1)}%</Text>
            </View>
          </View>
          <View className="rounded-full overflow-hidden" style={{ height: 8, backgroundColor: "#f3f4f6" }}>
            <View style={{ height: "100%", width: `${progress}%`, backgroundColor: exceeded ? "#22c55e" : "#fb923c", borderRadius: 999 }} />
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs text-gray-300">₫0</Text>
            {exceeded ? (
              <Text className="text-xs font-medium" style={{ color: "#16a34a" }}>+{fmtVND(Math.abs(remaining))} vượt mục tiêu</Text>
            ) : (
              <Text className="text-xs" style={{ color: "#fdba74" }}>Còn {fmtVND(remaining)}</Text>
            )}
          </View>
        </View>
      </View>

      {/* ══ TICK SELECTOR ══ */}
      <View className="flex-row items-center gap-2 px-5 py-2" style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#f9fafb" }}>
        <Text className="text-xs font-medium text-gray-400" style={{ marginRight: 4 }}>Số tick:</Text>
        {TICK_OPTIONS.map((n) => {
          const active = tickCount === n;
          return (
            <Pressable
              key={n}
              onPress={() => setTickCount(n)}
              style={{
                minWidth: 28,
                height: 24,
                borderRadius: 6,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: active ? "#bbf7d0" : "#f3f4f6",
                backgroundColor: active ? "#dcfce7" : "transparent",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: active ? "#15803d" : "#9ca3af" }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ══ CHART ══ */}
      <View style={{ padding: 8 }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_W} ${height}`}>
          <Defs>
            <LinearGradient id="cpGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#22c55e" />
              <Stop offset={`${beStop}%`} stopColor="#22c55e" />
              <Stop offset={`${beStop}%`} stopColor="#ef4444" />
              <Stop offset="100%" stopColor="#ef4444" />
            </LinearGradient>
          </Defs>

          {customTicks.map((t, i) => (
            <SvgLine key={`g${i}`} x1={padL} y1={yOfVal(t)} x2={VIEW_W - padR} y2={yOfVal(t)} stroke="#f3f4f6" strokeWidth={1} strokeDasharray="3 3" />
          ))}
          {customTicks.map((t, i) => (
            <SvgText key={`y${i}`} x={padL - 6} y={yOfVal(t) + 3} fontSize={9} fill="#9ca3af" textAnchor="end">
              {fmtShort(t)}
            </SvgText>
          ))}
          {AXIS_TICK_DAYS.filter((d) => d <= daysInMonth).map((d) => (
            <SvgText key={`x${d}`} x={xOfDay(d)} y={height - 6} fontSize={9} fill="#9ca3af" textAnchor="middle">
              {`Ng.${d}`}
            </SvgText>
          ))}

          {/* Đường hoà vốn */}
          <SvgLine x1={padL} y1={yOfVal(be)} x2={VIEW_W - padR} y2={yOfVal(be)} stroke="#f97316" strokeWidth={1.5} strokeDasharray="6 4" />
          <SvgText x={VIEW_W - padR} y={yOfVal(be) - 4} fontSize={10} fontWeight="700" fill="#f97316" textAnchor="end">Hòa vốn</SvgText>

          {/* Đường lợi nhuận tích luỹ */}
          <Path d={pathD} stroke="url(#cpGrad)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {selPoint && <Circle cx={selPoint.x} cy={selPoint.y} r={5} fill="#0ea5e9" />}
        </Svg>

        {/* Vùng chạm chọn ngày — thay hover tooltip */}
        <View style={{ flexDirection: "row", marginTop: -height, height: plotH + padT }}>
          {chartData.map((d) => (
            <Pressable key={d.day} onPress={() => setSelectedDay(d.day)} style={{ width: `${100 / daysInMonth}%` }} />
          ))}
        </View>
      </View>

      {selRow && (
        <View className="mx-5 mb-2 bg-gray-50 rounded-lg px-3 py-2">
          <Text className="text-xs text-gray-500">
            Ngày {selRow.day}: <Text className="font-mono font-bold text-gray-800">{fmtVND(selRow.cumulativeProfit)}</Text>
          </Text>
        </View>
      )}

      {/* ══ LEGEND ══ */}
      <View className="flex-row gap-5 pb-4 pt-3 justify-center flex-wrap" style={{ borderTopWidth: 1, borderColor: "#f9fafb" }}>
        <LegendDot color="#22c55e" label="Vượt hòa vốn" />
        <LegendDot color="#ef4444" label="Chưa đạt hòa vốn" />
        <LegendDot color="#f97316" dashed label="Điểm hòa vốn" />
      </View>
    </View>
  );
}

function LegendDot({ color, label, dashed }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {dashed ? (
        <View style={{ width: 20, borderTopWidth: 2, borderStyle: "dashed", borderColor: color }} />
      ) : (
        <View style={{ width: 20, height: 2, backgroundColor: color, borderRadius: 999 }} />
      )}
      <Text className="text-xs text-gray-400">{label}</Text>
    </View>
  );
}


