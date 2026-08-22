// src/pages/charts/helpers/mathHelpers.js
// [GIU-NGUYEN] Toàn bộ hàm ở đây là JS thuần (EMA/MA/PID + hằng số màu),
// không đụng DOM/recharts — copy gần như nguyên vẹn từ bản web, y hệt cách
// đã làm với utils/fmtVND.js và utils/dateUtils.js. Chỉ bỏ hằng số `TIP`
// (style object cho <Tooltip contentStyle> của recharts — không còn ý nghĩa
// ở RN, các chart RN tự định nghĩa style tooltip/legend riêng của mình).
export function addEMA(data, key, period = 5) {
  if (!Array.isArray(data) || data.length === 0) return Array.isArray(data) ? data : [];
  const alpha = 2 / (period + 1);
  const emaRolling = [];
  data.forEach((d, i) => {
    emaRolling.push(i === 0 ? d[key] : alpha * d[key] + (1 - alpha) * emaRolling[i - 1]);
  });
  return data.map((d, i) => ({
    ...d,
    ema: i === 0 ? null : Math.round(emaRolling[i - 1]),
  }));
}

export function addMA(data, key, period = 7) {
  if (!Array.isArray(data)) return [];
  return data.map((d, i) => {
    if (i === 0) return { ...d, ma: null };
    const slice = data.slice(Math.max(0, i - period), i);
    return {
      ...d,
      ma: Math.round(slice.reduce((s, x) => s + x[key], 0) / slice.length),
    };
  });
}

export function pidCalc(history, expected, Kp, Ki, Kd) {
  const safeHistory = Array.isArray(history) ? history : [];
  const safeExpected = Number(expected) || 0;
  const n = safeHistory.length;
  if (n === 0)
    return { pred: safeExpected, pTerm: 0, iTerm: 0, dTerm: 0, e: 0, sumE: 0, dE: 0 };

  const errors = safeHistory.map((h) => safeExpected - (Number(h) || 0));
  const e = errors[n - 1];
  const sumE = errors.reduce((s, x) => s + x, 0);
  const dE = n >= 2 ? errors[n - 1] - errors[n - 2] : 0;

  const pTerm = (Number(Kp) || 0) * e;
  const iTerm = (Number(Ki) || 0) * sumE;
  const dTerm = (Number(Kd) || 0) * dE;

  const pred = Math.max(0, (Number(safeHistory[n - 1]) || 0) + pTerm + iTerm + dTerm);

  return { pred, pTerm, iTerm, dTerm, e, sumE, dE };
}

export const r1 = (v) => Math.round(v * 10) / 10;

export const fmtM = (v) => `${(v / 1_000_000).toFixed(1)}M`;

export const fmtK = (v) => `${Math.round(v / 1_000)}k`;

export const DAYS_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const PIE_COLORS = ["#22c55e", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa", "#d1d5db"];

export const COLORS5 = ["#22c55e", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7"];

export const heatColor = (v) =>
  v < 15 ? "#f0fdf4" : v < 35 ? "#bbf7d0" : v < 55 ? "#4ade80" : v < 75 ? "#22c55e" : "#15803d";

// [MOI] Format Y-axis dùng chung cho tiền (VND) — trước đây mỗi Chart0X bản
// web tự định nghĩa lại formatYAxis giống hệt nhau (Chart03/04/05/06/08).
// Gom về đây 1 lần cho các chart RN dùng chung, hành vi giữ nguyên 100%.
export const fmtAxisMoney = (value) => {
  if (value === 0) return "0";
  if (value >= 1_000_000) {
    const valInM = value / 1_000_000;
    return Number.isInteger(valInM) ? `${valInM}M` : `${valInM.toFixed(1)}M`;
  }
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return value.toString();
};

export const fmtAxisCount = (value) => {
  if (value === 0) return "0";
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return value.toString();
};
