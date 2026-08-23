// src/pages/charts/Chart10.js
// [UI] Chuyển từ Chart10.js gốc. Giữ nguyên 100% pidCalc/r1 + logic
// updateK (optimistic bubble-up qua onRowsChange, PATCH nền). <input
// type="range"> → RangeSlider tự dựng (xem sub_components/RangeSlider.js).
// Bar chart tổng quan → BarLineChart. <sub> (Q_dự đoán) không có trên RN —
// viết phẳng thành text, không ảnh hưởng nội dung công thức.
//
// [SUA — tối ưu hiệu suất, đợt 2] Đây là chart tương tác nhiều nhất trang
// (mỗi nguyên liệu có 3 slider Kp/Ki/Kd + nút mở rộng) nên tách hẳn phần thẻ
// nguyên liệu ra IngredientCard (React.memo riêng) thay vì render trực tiếp
// trong .map() của Chart10:
//   - updateK đổi từ đóng gói trực tiếp `pidRows` sang đọc qua pidRowsRef —
//     nhờ vậy updateK có tham chiếu ỔN ĐỊNH giữa các lần render (chỉ đổi khi
//     đổi tf ngày/tuần), không đổi mỗi khi có 1 dòng được cập nhật.
//   - onRowsChange (từ AnalystPage) tạo mảng mới nhưng GIỮ NGUYÊN object
//     tham chiếu của các dòng KHÔNG đổi (`rows.map((d,i)=> i===idx? updated
//     : d)`) — kết hợp với IngredientCard đã memo, kéo 1 slider ở dòng nào
//     chỉ dòng đó re-render, N-1 dòng còn lại được React bỏ qua hoàn toàn.
import React, { useState, useMemo, useCallback, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { Package, ChevronUp, ChevronDown } from "lucide-react-native";
import ChartCard from "./sub_components/ChartCard";
import TabToggle from "./sub_components/TabToggle";
import BarLineChart from "./sub_components/BarLineChart";
import MiniSparkline from "./sub_components/MiniSparkLine";
import RangeSlider from "./sub_components/RangeSlider";
import { pidCalc, r1 } from "./helpers/mathHelpers";
import { apiPatch } from "./helpers/apiHelpers";

const K_PARAMS = [
  ["Kp", "Proportional", 0.01, 1, "#22c55e"],
  ["Ki", "Integral", 0.01, 0.5, "#60a5fa"],
  ["Kd", "Derivative", 0.01, 0.3, "#f59e0b"],
];

const TF_OPTIONS = [
  ["day", "Hôm nay"],
  ["week", "Tuần này"],
];

const SUMMARY_BAR_FMT = (v) => `${v}%`;
const SUMMARY_AXIS_FMT = (v) => `${Math.round(v)}%`;

function Chart10({ pidRows = [], tf = "day", onTf, onRowsChange }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const pidChartData = useMemo(
    () =>
      pidRows.map((ing) => {
        const hist = tf === "day" ? ing.dayHistory : ing.weekHistory;
        const exp = tf === "day" ? ing.dayExpected : ing.weekExpected;
        const { pred } = pidCalc(hist || [], exp || 0, ing.Kp, ing.Ki, ing.Kd);
        const actual = hist?.length ? hist[hist.length - 1] : 0;
        return {
          label: (ing.name || "").split(" ").pop(),
          actual: Math.round((actual / (exp || 1)) * 100),
          predicted: Math.round((pred / (exp || 1)) * 100),
          actualRaw: actual,
          predictedRaw: r1(pred),
          unit: ing.unit,
        };
      }),
    [pidRows, tf]
  );

  const summaryMax = pidChartData.length
    ? Math.max(120, ...pidChartData.map((d) => Math.max(d.actual, d.predicted))) * 1.1
    : 120;
  const summaryTicks = useMemo(
    () => [0, summaryMax * 0.25, summaryMax * 0.5, summaryMax * 0.75, summaryMax],
    [summaryMax]
  );
  const summaryBars = useMemo(
    () => [
      { key: "actual", name: "Kỳ này", color: "#93c5fd", format: SUMMARY_BAR_FMT },
      { key: "predicted", name: "PID dự đoán", color: "#f97316", format: SUMMARY_BAR_FMT },
    ],
    []
  );
  const summaryBarAxis = useMemo(
    () => ({ max: summaryTicks[4], ticks: summaryTicks, formatter: SUMMARY_AXIS_FMT }),
    [summaryTicks]
  );
  const summaryReferenceLine = useMemo(
    () => ({ value: 100, color: "#22c55e", label: "Kỳ vọng", axis: "bar" }),
    []
  );

  // pidRowsRef: đọc dòng mới nhất bên trong updateK mà KHÔNG cần pidRows làm
  // dependency — nhờ vậy updateK giữ nguyên tham chiếu giữa các lần cập nhật
  // (xem ghi chú đầu file).
  const pidRowsRef = useRef(pidRows);
  pidRowsRef.current = pidRows;

  const updateK = useCallback(
    async (idx, key, val) => {
      const rows = pidRowsRef.current;
      const ing = rows[idx];
      const updated = { ...ing, [key]: val };
      const newRows = rows.map((d, i) => (i === idx ? updated : d));
      onRowsChange?.(newRows); // optimistic bubble-up, giữ nguyên như bản gốc
      try {
        await apiPatch(`/pid/${ing.ingredientId}`, { Kp: updated.Kp, Ki: updated.Ki, Kd: updated.Kd });
      } catch (err) {
        console.error("updateK failed:", err);
      }
    },
    [onRowsChange]
  );

  const onToggleExpand = useCallback((idx) => {
    setExpandedRow((prev) => (prev === idx ? null : idx));
  }, []);

  return (
    <ChartCard>
      {/* ── Header ── */}
      <View className="flex-row items-center justify-between mb-1 flex-wrap gap-2">
        <View className="flex-row items-center gap-2">
          <Package size={16} color="#16a34a" />
          <Text className="font-bold text-gray-700">Nguyên liệu cần chuẩn bị — PID Controller</Text>
        </View>
        <TabToggle value={tf} onChange={onTf} options={TF_OPTIONS} />
      </View>

      {/* ── Formula banner ── */}
      <View className="bg-amber-50 rounded-xl px-4 py-2.5 mb-5" style={{ borderWidth: 1, borderColor: "#fde68a" }}>
        <Text className="text-xs text-amber-800" style={{ fontFamily: "monospace" }}>
          <Text className="font-black">Q dự đoán = Q kỳ trước + Kp·e + Ki·Σe + Kd·Δe</Text>
          {"   |   e = kỳ vọng − thực tế   |   "}
          <Text className="text-amber-600">─── lịch sử</Text>
          {"  ·  "}
          <Text style={{ color: "#f97316" }}>- - - dự đoán</Text>
        </Text>
      </View>

      {/* ── Summary bar chart ── */}
      <View className="mb-6">
        <Text className="text-xs text-gray-400 mb-2" style={{ textAlign: "right" }}>
          Giá trị theo % kỳ vọng | 100% = đúng kỳ vọng
        </Text>
        <BarLineChart
          data={pidChartData}
          height={200}
          bars={summaryBars}
          barAxis={summaryBarAxis}
          referenceLine={summaryReferenceLine}
          gridColor="#f0fdf4"
          emptyLabel="Chưa có nguyên liệu"
        />
      </View>

      {/* ── Ingredient cards ── */}
      <View className="flex-row flex-wrap gap-4">
        {pidRows.map((ing, idx) => (
          <MemoIngredientCard
            key={ing.ingredientId ?? idx}
            ing={ing}
            idx={idx}
            tf={tf}
            isExpanded={expandedRow === idx}
            onToggleExpand={onToggleExpand}
            onUpdateK={updateK}
          />
        ))}
      </View>

      {/* ── Bottom legend ── */}
      <View className="flex-row gap-6 mt-5 pt-4 flex-wrap" style={{ borderTopWidth: 1, borderColor: "#f3f4f6" }}>
        <View className="flex-row items-center gap-2">
          <View style={{ width: 16, height: 2, backgroundColor: "#4ade80", borderRadius: 999 }} />
          <Text className="text-xs text-gray-500">Lịch sử tiêu thụ</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View style={{ width: 16, borderTopWidth: 2, borderStyle: "dashed", borderColor: "#fb923c" }} />
          <Text className="text-xs text-gray-500">Dự đoán PID (kỳ tiếp theo)</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#fb923c" }} />
          <Text className="text-xs text-gray-500">Điểm dự đoán</Text>
        </View>
      </View>
    </ChartCard>
  );
}

function IngredientCard({ ing, idx, tf, isExpanded, onToggleExpand, onUpdateK }) {
  const rawHist = tf === "day" ? ing.dayHistory : ing.weekHistory;
  const hist = Array.isArray(rawHist) ? rawHist : [];
  const exp = (tf === "day" ? ing.dayExpected : ing.weekExpected) || 0;
  const { pred, pTerm, iTerm, dTerm, e } = pidCalc(hist, exp, ing.Kp, ing.Ki, ing.Kd);
  const predR = r1(pred);
  const lastAct = hist.length > 0 ? hist[hist.length - 1] : 0;
  const delta = r1(pred - lastAct);

  const changeRatio = lastAct !== 0 ? Math.abs(delta / lastAct) : delta === 0 ? 0 : Infinity;
  const stable = changeRatio < 0.03;
  const statusBg = stable ? "#f3f4f6" : delta > 0 ? "#ffedd5" : "#dcfce7";
  const statusColor = stable ? "#6b7280" : delta > 0 ? "#ea580c" : "#16a34a";
  const statusLabel = stable ? "Ổn định" : delta > 0 ? `+${r1(delta)} ${ing.unit}` : `${r1(delta)} ${ing.unit}`;

  return (
    <View className="rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: "#f3f4f6", width: "100%" }}>
      {/* Card header */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <View className="flex-row items-center">
          <Text className="font-bold text-gray-800 text-sm">{ing.name}</Text>
          <Text className="ml-1.5 text-xs text-gray-400 bg-gray-100 px-1.5 rounded-full" style={{ paddingVertical: 1 }}>
            {ing.unit}
          </Text>
        </View>
        <Text className="text-xs font-bold px-2 rounded-full" style={{ backgroundColor: statusBg, color: statusColor, paddingVertical: 2 }}>
          {statusLabel}
        </Text>
      </View>

      {/* Sparkline + summary */}
      <View className="flex-row items-center gap-3 px-4 pb-3">
        <MiniSparkline data={hist} predicted={predR} color="#22c55e" w={110} h={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View className="flex-row justify-between mb-0.5">
            <Text className="text-xs text-gray-400">Kỳ trước</Text>
            <Text className="text-xs text-gray-700" style={{ fontFamily: "monospace" }}>{lastAct} {ing.unit}</Text>
          </View>
          <View className="flex-row justify-between mb-0.5">
            <Text className="text-xs text-gray-400">Kỳ vọng</Text>
            <Text className="text-xs text-gray-500" style={{ fontFamily: "monospace" }}>{exp} {ing.unit}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-xs font-semibold" style={{ color: "#f97316" }}>PID dự đoán</Text>
            <Text className="text-xs font-black" style={{ color: "#ea580c", fontFamily: "monospace" }}>{predR} {ing.unit}</Text>
          </View>
        </View>
      </View>

      {/* Expand toggle */}
      <Pressable
        onPress={() => onToggleExpand(idx)}
        className="flex-row items-center justify-between px-4 py-2 bg-gray-50"
        style={{ borderTopWidth: 1, borderColor: "#f3f4f6" }}
      >
        <Text className="text-xs text-gray-500">Chỉnh thông số K — Kp={ing.Kp} · Ki={ing.Ki} · Kd={ing.Kd}</Text>
        {isExpanded ? <ChevronUp size={14} color="#9ca3af" /> : <ChevronDown size={14} color="#9ca3af" />}
      </Pressable>

      {/* Expanded K params */}
      {isExpanded && (
        <View className="px-4 pb-4 pt-3 bg-gray-50" style={{ borderTopWidth: 1, borderColor: "#f3f4f6", gap: 12 }}>
          {K_PARAMS.map(([k, label, step, max, color]) => (
            <View key={k}>
              <View className="flex-row justify-between mb-1">
                <Text className="font-semibold" style={{ color, fontFamily: "monospace", fontSize: 12 }}>{k}</Text>
                <Text className="text-xs text-gray-500">{label}</Text>
                <Text className="text-xs text-gray-700" style={{ fontFamily: "monospace" }}>{ing[k]}</Text>
              </View>
              <RangeSlider min={0} max={max} step={step} value={ing[k]} onChange={(v) => onUpdateK(idx, k, v)} color={color} />
            </View>
          ))}

          {/* PID breakdown */}
          <View className="pt-2" style={{ borderTopWidth: 1, borderColor: "#e5e7eb" }}>
            <Text className="text-xs text-gray-400 font-semibold mb-2" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              Phân tích PID
            </Text>
            <PidRow label="e (lỗi kỳ này)" value={`${r1(e)} ${ing.unit}`} color={e >= 0 ? "#f97316" : "#16a34a"} />
            <PidRow label="P = Kp·e" value={r1(pTerm)} color="#2563eb" />
            <PidRow label="I = Ki·Σe" value={r1(iTerm)} color="#2563eb" />
            <PidRow label="D = Kd·Δe" value={r1(dTerm)} color="#2563eb" />
            <View className="flex-row justify-between pt-1 mt-1" style={{ borderTopWidth: 1, borderColor: "#e5e7eb" }}>
              <Text className="text-xs font-bold text-gray-600">Dự đoán kỳ sau</Text>
              <Text className="text-xs font-black" style={{ color: "#ea580c", fontFamily: "monospace" }}>{predR} {ing.unit}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const MemoIngredientCard = React.memo(IngredientCard);

function PidRow({ label, value, color }) {
  return (
    <View className="flex-row justify-between mb-1">
      <Text className="text-xs text-gray-400">{label}</Text>
      <Text className="text-xs" style={{ color, fontFamily: "monospace" }}>{value}</Text>
    </View>
  );
}

export default React.memo(Chart10);
