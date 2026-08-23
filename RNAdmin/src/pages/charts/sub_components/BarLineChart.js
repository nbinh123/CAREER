// src/pages/charts/sub_components/BarLineChart.js
// [MOI — quyết định thư viện chart, mục 0.6 progress.md] recharts không chạy
// trên RN. Đã thử victory-native / react-native-gifted-charts nhưng cả 2 đều
// cần thêm dependency mới (không có sẵn trong package.json, phải
// `npx expo install` + rebuild dev client mới dùng được native module bên
// trong) trong khi react-native-svg (đã có sẵn, dùng cho MiniAreaChart.js)
// là đủ cho toàn bộ combo Bar+Line xuất hiện ở Chart01/02/03/04/05/06/08/10.
// Viết 1 component dùng chung duy nhất thay vì lặp lại lần lượt cho mỗi
// Chart0X, vì phần lớn logic (scale trục Y, group bar, vẽ line có khoảng
// trống null) giống hệt nhau giữa các chart — chỉ khác data/màu/label.
//
// Khác biệt có chủ đích so với recharts:
//   - Line vẽ đoạn thẳng nối điểm (không "monotone" cong) — đơn giản hoá vẽ
//     tay bằng SVG, không ảnh hưởng số liệu.
//   - Không có tooltip khi hover (RN không có hover) — thay bằng "chạm 1 cột
//     để xem số" (tap-to-inspect), mặc định chọn sẵn cột cuối cùng.
//   - Bar bo tròn đều 4 góc (rx/ry) thay vì chỉ bo 2 góc trên — react-native-svg
//     <Rect> không hỗ trợ bo riêng từng góc.
//
// [SUA — tối ưu hiệu suất, đợt 2]
//   1) Vùng chạm chọn cột trước đây là N <Pressable> xếp hàng ngang (N = số
//      category — Chart02/Chart03 tháng có thể tới ~31) → giờ gộp về ĐÚNG 1
//      Pressable, tự tính cột bị chạm từ locationX (đo layout 1 lần qua
//      onLayout, quy đổi tỉ lệ) — giảm số native view phải mount/layout mỗi
//      lần chart này render, cùng cách làm với RangeSlider.js.
//   2) Bọc React.memo — component này chiếm phần lớn cây SVG của trang, nếu
//      không memo thì bất kỳ re-render nào ở AnalystPage (dù không đổi data/
//      cấu hình của CHÍNH chart này) cũng vẽ lại toàn bộ SVG bên trong. Điều
//      kiện để memo có tác dụng: props mảng/object (bars/lines/barAxis/...)
//      phải ổn định tham chiếu giữa các render — trách nhiệm này nằm ở từng
//      Chart0X.js (bọc useMemo trước khi truyền xuống đây, xem ghi chú ở đó).
import React, { useState, useMemo, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Rect, Polyline, Line as SvgLine, Text as SvgText } from "react-native-svg";

const VIEW_W = 340;
const DEFAULT_FMT = (v) => (v ?? 0).toLocaleString("vi-VN");

function buildLineSegments(data, key, scaleFn, xOfIndex) {
  const segments = [];
  let current = [];
  data.forEach((d, i) => {
    const v = d[key];
    if (v === null || v === undefined) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: xOfIndex(i), y: scaleFn(v) });
  });
  if (current.length) segments.push(current);
  return segments;
}

function BarLineChart({
  data = [],
  height = 240,
  bars = [], // [{ key, color, name, colorByIndex?: (i) => color }]
  lines = [], // [{ key, color, name, dashed? }]
  barAxis, // { max, ticks: number[], formatter }
  lineAxis, // optional dual axis — { max, ticks, formatter }
  referenceLine, // optional { value, color, label, axis: "bar" | "line" }
  xTickEvery = 1,
  gridColor = "#f3f4f6",
  emptyLabel = "Chưa có dữ liệu",
}) {
  const [selected, setSelected] = useState(data.length ? data.length - 1 : null);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const effectiveSelected = selected != null && selected < data.length ? selected : data.length - 1;

  const hasDualAxis = !!lineAxis;
  const padL = 40;
  const padR = hasDualAxis ? 38 : 10;
  const padT = 8;
  const padB = 20;
  const plotW = VIEW_W - padL - padR;
  const plotH = height - padT - padB;
  const n = data.length;
  const slotW = n > 0 ? plotW / n : 0;

  const xOfIndex = (i) => padL + slotW * (i + 0.5);
  const scaleBar = (v) => padT + plotH - (Math.max(0, Math.min(v, barAxis?.max || 1)) / (barAxis?.max || 1)) * plotH;
  const scaleLine = (v) => {
    const axis = lineAxis || barAxis;
    return padT + plotH - (Math.max(0, Math.min(v, axis?.max || 1)) / (axis?.max || 1)) * plotH;
  };
  const barHeightOf = (v) => plotH - (scaleBar(v) - padT);

  const barGroupWidth = Math.min(slotW * 0.62, 34);
  const barCount = bars.length;
  const gap = 3;
  const singleBarWidth = barCount > 0 ? (barGroupWidth - gap * (barCount - 1)) / barCount : 0;

  const lineSegmentsByKey = useMemo(() => {
    const out = {};
    lines.forEach((ln) => {
      out[ln.key] = buildLineSegments(data, ln.key, scaleLine, xOfIndex);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lines, barAxis, lineAxis, slotW]);

  // 1 Pressable duy nhất thay vì N — tự suy ra cột bị chạm từ locationX.
  const handleOverlayPress = useCallback(
    (evt) => {
      if (overlayWidth <= 0 || n === 0) return;
      const ratio = Math.min(1, Math.max(0, evt.nativeEvent.locationX / overlayWidth));
      const idx = Math.min(n - 1, Math.floor(ratio * n));
      setSelected(idx);
    },
    [overlayWidth, n]
  );

  if (n === 0) {
    return (
      <View style={{ height: 80, alignItems: "center", justifyContent: "center" }}>
        <Text className="text-sm text-gray-400">{emptyLabel}</Text>
      </View>
    );
  }

  const legendItems = [...bars.map((b) => ({ color: b.color, name: b.name, dashed: false })), ...lines.map((l) => ({ color: l.color, name: l.name, dashed: !!l.dashed }))];

  const selRow = data[effectiveSelected];

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEW_W} ${height}`}>
        {/* Gridlines theo trục bar */}
        {(barAxis?.ticks || []).map((t, i) => {
          const y = scaleBar(t);
          return <SvgLine key={`g${i}`} x1={padL} y1={y} x2={VIEW_W - padR} y2={y} stroke={gridColor} strokeWidth={1} strokeDasharray="3 3" />;
        })}

        {/* Nhãn trục Y trái */}
        {(barAxis?.ticks || []).map((t, i) => (
          <SvgText key={`ytl${i}`} x={padL - 6} y={scaleBar(t) + 3} fontSize={9} fill="#9ca3af" textAnchor="end">
            {(barAxis.formatter || DEFAULT_FMT)(t)}
          </SvgText>
        ))}

        {/* Nhãn trục Y phải (dual axis) */}
        {hasDualAxis &&
          (lineAxis.ticks || []).map((t, i) => (
            <SvgText key={`ytr${i}`} x={VIEW_W - padR + 6} y={scaleLine(t) + 3} fontSize={9} fill="#9ca3af" textAnchor="start">
              {(lineAxis.formatter || DEFAULT_FMT)(t)}
            </SvgText>
          ))}

        {/* Reference line (vd Chart10: mốc 100% kỳ vọng) */}
        {referenceLine &&
          (() => {
            const y = referenceLine.axis === "line" ? scaleLine(referenceLine.value) : scaleBar(referenceLine.value);
            return (
              <>
                <SvgLine x1={padL} y1={y} x2={VIEW_W - padR} y2={y} stroke={referenceLine.color} strokeWidth={1.2} strokeDasharray="5 3" />
                {referenceLine.label ? (
                  <SvgText x={VIEW_W - padR} y={y - 3} fontSize={9} fill={referenceLine.color} fontWeight="700" textAnchor="end">
                    {referenceLine.label}
                  </SvgText>
                ) : null}
              </>
            );
          })()}

        {/* Bars */}
        {data.map((d, i) => {
          const groupLeft = xOfIndex(i) - barGroupWidth / 2;
          return bars.map((b, j) => {
            const v = d[b.key] || 0;
            const x = groupLeft + j * (singleBarWidth + gap);
            const y = scaleBar(v);
            const hgt = Math.max(0, barHeightOf(v));
            const fill = b.colorByIndex ? b.colorByIndex(i) : b.color;
            return <Rect key={`${b.key}-${i}`} x={x} y={y} width={singleBarWidth} height={hgt} rx={3} ry={3} fill={fill} />;
          });
        })}

        {/* Lines */}
        {lines.map((ln) =>
          (lineSegmentsByKey[ln.key] || []).map((seg, si) => (
            <Polyline
              key={`${ln.key}-${si}`}
              points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={ln.color}
              strokeWidth={2.2}
              strokeDasharray={ln.dashed ? "5 3" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        )}

        {/* Điểm chạm đã chọn */}
        {lines.map((ln) => {
          const v = selRow?.[ln.key];
          if (v === null || v === undefined) return null;
          return <Rect key={`sel-${ln.key}`} x={xOfIndex(effectiveSelected) - 2.5} y={scaleLine(v) - 2.5} width={5} height={5} rx={2.5} ry={2.5} fill={ln.color} />;
        })}
      </Svg>

      {/* Vùng chạm chọn cột — 1 Pressable duy nhất (xem ghi chú tối ưu đầu file) */}
      <Pressable
        onLayout={(e) => setOverlayWidth(e.nativeEvent.layout.width)}
        onPress={handleOverlayPress}
        style={{ marginTop: -height, height: height - padB }}
      />

      {/* Nhãn trục X */}
      <View className="flex-row" style={{ paddingLeft: `${(padL / VIEW_W) * 100}%`, paddingRight: `${(padR / VIEW_W) * 100}%` }}>
        {data.map((d, i) => (
          <Text key={i} className="text-[9px] text-gray-400" style={{ width: `${100 / n}%`, textAlign: "center" }} numberOfLines={1}>
            {i % xTickEvery === 0 || i === n - 1 ? d.label : ""}
          </Text>
        ))}
      </View>

      {/* Legend */}
      {legendItems.length > 0 && (
        <View className="flex-row flex-wrap gap-3 mt-2">
          {legendItems.map((it, i) => (
            <View key={i} className="flex-row items-center gap-1.5">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: it.color }} />
              <Text className="text-xs text-gray-500">{it.name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Giá trị cột đang chọn */}
      {selRow && (
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 mt-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
          <Text className="text-xs font-bold text-gray-600">{selRow.label}</Text>
          {[...bars, ...lines].map((s) => {
            const v = selRow[s.key];
            const fmt = (s.format || (bars.includes(s) ? barAxis?.tooltipFormatter : (lineAxis || barAxis)?.tooltipFormatter)) || DEFAULT_FMT;
            return (
              <Text key={s.key} className="text-xs" style={{ color: s.color }}>
                {s.name}: <Text className="font-mono font-semibold">{v === null || v === undefined ? "—" : fmt(v)}</Text>
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default React.memo(BarLineChart);
