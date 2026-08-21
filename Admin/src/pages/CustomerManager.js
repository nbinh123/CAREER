import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, RefreshCw, Lock, LockOpen, KeyRound, History,
  X, Copy, Check, ChevronLeft, ChevronRight, ShieldAlert,
} from "lucide-react";
import { getData, patchData, postData } from "../utils/callAPI";

const LIMIT = 10;

/* ════════════════════════════════════════════════════════════
   CSS-IN-JS
════════════════════════════════════════════════════════════ */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

.cm-root { min-height: 100vh; background: #f9fafb; font-family: 'Nunito', sans-serif; position: relative; overflow-x: hidden; }
.cm-wrap { position: relative; z-index: 1; padding: 0 0 40px; }

/* ── header (giống StaffManager) ── */
.cm-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 32px; flex-wrap: wrap; gap: 12px; animation: cm-fade-down 0.5s ease both; }
.cm-header-left h1 {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 24px; font-weight: 900; color: #14532d; margin: 0; line-height: 2rem;
}
.cm-header-sub-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.cm-header-left p {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px; font-weight: 400; color: #6b7280; margin: 2px 0 0;
}
.cm-live-badge { display: inline-flex; align-items: center; gap: 4px; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 4px 11px; border-radius: 100px; white-space: nowrap; }

/* ── stats ── */
.cm-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 260px)); gap: 14px; margin-bottom: 28px; }
@media (max-width: 500px) { .cm-stats { grid-template-columns: 1fr; } }
.cm-stat-card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 14px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.03); animation: cm-fade-up 0.5s ease both; position: relative; overflow: hidden; }
.cm-stat-card::before { content:''; position:absolute; top:0; left:0; width:4px; height:100%; }
.cm-stat-card.green::before { background:#059669; }
.cm-stat-card.teal::before  { background:#0d9488; }
.cm-stat-card.rose::before  { background:#e11d48; }
.cm-stat-card.amber::before { background:#d97706; }
.cm-stat-card:nth-child(1){ animation-delay:0.08s } .cm-stat-card:nth-child(2){ animation-delay:0.14s }
.cm-stat-card:nth-child(3){ animation-delay:0.20s } .cm-stat-card:nth-child(4){ animation-delay:0.26s }
.cm-stat-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px; }
.cm-stat-val   { font-size: 22px; font-weight: 900; color: #064e3b; margin: 0; line-height: 1; }
.cm-stat-sub   { font-size: 11px; font-weight: 500; color: #9ca3af; margin: 4px 0 0; }

/* ── toolbar ── */
.cm-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; animation: cm-fade-up 0.5s 0.3s ease both; }
.cm-search-wrap { position: relative; flex: 1; min-width: 220px; }
.cm-search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: #9ca3af; display: flex; pointer-events: none; }
.cm-search { width: 100%; padding: 10px 13px 10px 38px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 600; color: #064e3b; background: #fff; border: 2px solid #e5e7eb; border-radius: 12px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
.cm-search:focus { border-color: #34d399; box-shadow: 0 0 0 4px rgba(52,211,153,0.12); }
.cm-search::placeholder { color: #cbd5e1; }
.cm-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.cm-tab { padding: 8px 14px; font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800; border-radius: 10px; border: 2px solid transparent; cursor: pointer; transition: all 0.18s; letter-spacing: 0.3px; }
.cm-tab.active { background: #059669; color: #fff; box-shadow: 0 3px 10px rgba(5,150,105,0.3); }
.cm-tab:not(.active) { background: #fff; color: #065f46; border-color: #e5e7eb; }
.cm-tab:not(.active):hover { background: #f3f4f6; border-color: #9ca3af; }
.cm-refresh-btn { display: flex; align-items: center; gap: 6px; padding: 10px 14px; font-family: 'Nunito',sans-serif; font-size: 13px; font-weight: 800; background: #fff; color: #4b5563; border: 2px solid #e5e7eb; border-radius: 12px; cursor: pointer; transition: all 0.18s; white-space: nowrap; }
.cm-refresh-btn:hover { background: #f3f4f6; border-color: #d1d5db; }
.cm-refresh-btn.spinning svg { animation: cm-rotate 0.8s linear infinite; }

/* ── table ── */
.cm-table-wrap { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.03); animation: cm-fade-up 0.5s 0.36s ease both; }
.cm-table { width: 100%; border-collapse: collapse; }
.cm-table thead th {
  text-align: left; font-size: 11px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;
  padding: 13px 16px; background: #f9fafb; border-bottom: 1.5px solid #e5e7eb; white-space: nowrap;
}
.cm-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
.cm-table tbody tr:last-child { border-bottom: none; }
.cm-table tbody tr:hover { background: #f9fafb; }
.cm-table td { padding: 12px 16px; vertical-align: middle; }

.cm-cust-cell { display: flex; align-items: center; gap: 11px; }
.cm-avatar { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 900; color: #fff; flex-shrink: 0; box-shadow: 0 3px 10px rgba(0,0,0,0.12); }
.cm-cust-name { font-size: 13.5px; font-weight: 900; color: #064e3b; margin: 0 0 2px; white-space: nowrap; }
.cm-cust-phone { font-size: 12px; font-weight: 600; color: #9ca3af; margin: 0; }

.cm-cell-sub { font-size: 12px; font-weight: 600; color: #6b7280; }
.cm-cell-main { font-size: 13px; font-weight: 800; color: #064e3b; }
.cm-order-count { display:inline-flex; align-items:center; justify-content:center; min-width:26px; padding: 3px 8px; background:#f0fdf4; color:#166534; border-radius: 100px; font-size:12px; font-weight:800; }

.cm-status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 100px; white-space: nowrap; }
.cm-status-badge.active   { background: #dcfce7; color: #166534; }
.cm-status-badge.locked   { background: #fee2e2; color: #b91c1c; }
.cm-status-badge.templock { background: #fef3c7; color: #b45309; }
.cm-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.cm-must-change { display:block; margin-top:4px; font-size:10px; font-weight:700; color:#d97706; }

.cm-row-actions { display: flex; gap: 6px; justify-content: flex-end; }
.cm-icon-btn {
  width: 32px; height: 32px; border-radius: 10px; border: 2px solid #e5e7eb; background: #f9fafb;
  color: #065f46; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.18s; flex-shrink: 0;
}
.cm-icon-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
.cm-icon-btn.danger { color: #b91c1c; }
.cm-icon-btn.danger:hover { background: #fef2f2; border-color: #fca5a5; }
.cm-icon-btn.ok { color: #16a34a; }
.cm-icon-btn.ok:hover { background: #f0fdf4; border-color: #86efac; }

/* ── empty / skeleton ── */
.cm-empty { text-align: center; padding: 60px 20px; color: #cbd5e1; }
.cm-empty-icon { font-size: 40px; margin-bottom: 10px; }
.cm-empty p { font-size: 14px; font-weight: 700; margin: 0; }
.cm-skel { background: #e5e7eb; border-radius: 8px; }
.cm-skel-row td { padding: 14px 16px; }
@keyframes cm-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
.cm-skel-row { animation: cm-pulse 1.4s ease infinite; }

/* ── pagination ── */
.cm-pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-top: 1.5px solid #e5e7eb; flex-wrap: wrap; gap: 10px; }
.cm-page-info { font-size: 12px; font-weight: 700; color: #9ca3af; }
.cm-page-nav { display: flex; align-items: center; gap: 8px; }
.cm-nav-btn { background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #065f46; transition: all 0.18s; }
.cm-nav-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
.cm-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cm-page-label { font-size: 13px; font-weight: 800; color: #064e3b; min-width: 90px; text-align: center; }

/* ── modal shared ── */
.cm-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(6,78,59,0.25); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: cm-fade 0.2s ease both; }
.cm-modal { background: #fff; border-radius: 24px; box-shadow: 0 24px 64px rgba(6,78,59,0.18); width: 100%; max-height: 90vh; overflow-y: auto; animation: cm-modal-in 0.3s cubic-bezier(.22,.68,0,1.2) both; position: relative; }
.cm-modal-header { padding: 22px 24px 16px; display: flex; align-items: flex-start; justify-content: space-between; position: sticky; top: 0; background: #fff; z-index: 2; border-bottom: 1px solid #e5e7eb; }
.cm-modal-title { font-size: 16px; font-weight: 900; color: #064e3b; margin: 0 0 3px; }
.cm-modal-sub { font-size: 12px; font-weight: 600; color: #9ca3af; margin: 0; }
.cm-modal-close { background: #f9fafb; border: none; cursor: pointer; width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #9ca3af; transition: all 0.18s; flex-shrink: 0; }
.cm-modal-close:hover { background: #f3f4f6; color: #065f46; }

/* ── confirm modal ── */
.cm-confirm-modal { max-width: 400px; }
.cm-confirm-body { padding: 22px 24px 24px; text-align: center; }
.cm-confirm-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
.cm-confirm-icon.rose  { background: #fee2e2; color: #b91c1c; }
.cm-confirm-icon.green { background: #dcfce7; color: #166534; }
.cm-confirm-icon.amber { background: #fef3c7; color: #b45309; }
.cm-confirm-text { font-size: 13.5px; font-weight: 600; color: #6b7280; line-height: 1.5; margin: 0 0 20px; }
.cm-confirm-text b { color: #064e3b; font-weight: 900; }
.cm-confirm-actions { display: flex; gap: 10px; }
.cm-cancel-btn { flex: 1; padding: 12px; font-family: 'Nunito',sans-serif; font-size: 14px; font-weight: 800; background: #f9fafb; color: #065f46; border: 2px solid #e5e7eb; border-radius: 13px; cursor: pointer; transition: all 0.18s; }
.cm-cancel-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
.cm-confirm-btn { flex: 2; padding: 12px; font-family: 'Nunito',sans-serif; font-size: 14px; font-weight: 900; color: #fff; border: none; border-radius: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; transition: background 0.18s; }
.cm-confirm-btn.rose  { background: #e11d48; box-shadow: 0 2px 8px rgba(225,29,72,0.25); }
.cm-confirm-btn.rose:hover:not(:disabled)  { background: #be123c; }
.cm-confirm-btn.green { background: #059669; box-shadow: 0 2px 8px rgba(5,150,105,0.25); }
.cm-confirm-btn.green:hover:not(:disabled) { background: #047857; }
.cm-confirm-btn.amber { background: #d97706; box-shadow: 0 2px 8px rgba(217,119,6,0.25); }
.cm-confirm-btn.amber:hover:not(:disabled) { background: #b45309; }
.cm-confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── reset-password result ── */
.cm-reset-result { padding: 22px 24px 24px; }
.cm-reset-ok-icon { width: 56px; height: 56px; border-radius: 16px; background: #dcfce7; color: #166534; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
.cm-reset-label { text-align: center; font-size: 12px; font-weight: 700; color: #9ca3af; margin: 0 0 6px; }
.cm-pass-box { display: flex; align-items: center; gap: 8px; background: #f9fafb; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 14px; margin-bottom: 14px; }
.cm-pass-val { flex: 1; font-family: 'Nunito',sans-serif; font-size: 26px; font-weight: 900; letter-spacing: 6px; color: #064e3b; text-align: center; }
.cm-copy-btn { width: 38px; height: 38px; border-radius: 11px; border: 2px solid #e5e7eb; background: #fff; color: #065f46; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 0.18s; }
.cm-copy-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
.cm-copy-btn.done { color: #16a34a; border-color: #86efac; background: #f0fdf4; }
.cm-reset-hint { font-size: 12px; font-weight: 600; color: #9ca3af; text-align: center; line-height: 1.5; margin: 0 0 18px; }
.cm-reset-done-btn { width: 100%; padding: 12px; font-family: 'Nunito',sans-serif; font-size: 14px; font-weight: 900; background: #059669; color: #fff; border: none; border-radius: 13px; cursor: pointer; box-shadow: 0 2px 8px rgba(5,150,105,0.25); }
.cm-reset-done-btn:hover { background: #047857; }

/* ── orders modal ── */
.cm-orders-modal { max-width: 560px; }
.cm-orders-body { padding: 16px 24px 24px; }
.cm-order-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 13px; margin-bottom: 8px; }
.cm-order-code { font-size: 13px; font-weight: 900; color: #064e3b; margin: 0 0 2px; }
.cm-order-date { font-size: 11px; font-weight: 600; color: #9ca3af; margin: 0; }
.cm-order-amt { font-size: 14px; font-weight: 900; color: #059669; white-space: nowrap; padding-top: 1px; }
.cm-order-status { font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 100px; text-transform: uppercase; white-space: nowrap; }
.cm-order-status.completed  { background: #dcfce7; color: #166534; }
.cm-order-status.cancelled  { background: #fee2e2; color: #b91c1c; }
.cm-order-status.pending    { background: #fef3c7; color: #b45309; }
.cm-order-status.processing { background: #dbeafe; color: #1d4ed8; }
.cm-order-status.default    { background: #f3f4f6; color: #4b5563; }
.cm-order-meta-row { display: flex; align-items: center; gap: 8px; margin: 0 0 2px; }
.cm-order-items { font-size: 11px; font-weight: 600; color: #6b7280; margin: 3px 0 0; line-height: 1.4; }
.cm-order-cancel-reason { font-size: 11px; font-weight: 600; color: #b91c1c; margin: 3px 0 0; font-style: italic; }
.cm-orders-loading { text-align: center; padding: 40px 0; color: #9ca3af; }

/* ── toast ── */
.cm-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: #064e3b; color: #d1fae5; padding: 11px 22px; border-radius: 100px; font-size: 13px; font-weight: 800; box-shadow: 0 8px 24px rgba(0,0,0,0.18); pointer-events: none; white-space: nowrap; z-index: 200; animation: cm-toast-in 0.35s cubic-bezier(.22,.68,0,1.2) both; }
.cm-toast.out { animation: cm-toast-out 0.3s ease forwards; }
.cm-toast.error { background: #7f1d1d; color: #fecaca; }

/* ── animations ── */
@keyframes cm-rotate { to{ transform: rotate(360deg) } }
@keyframes cm-fade-down { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
@keyframes cm-fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes cm-fade { from{opacity:0} to{opacity:1} }
@keyframes cm-modal-in { from{opacity:0;transform:translateY(20px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes cm-toast-in  { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
@keyframes cm-toast-out { from{opacity:1;transform:translateX(-50%) translateY(0)} to{opacity:0;transform:translateX(-50%) translateY(12px)} }

.cm-modal::-webkit-scrollbar { width: 5px; }
.cm-modal::-webkit-scrollbar-track { background: transparent; }
.cm-modal::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
.cm-spin { width:16px;height:16px; border:2.5px solid rgba(255,255,255,0.35); border-top-color:#fff; border-radius:50%; animation:cm-rotate 0.7s linear infinite; display:inline-block; }
`;

/* ════════════════════════════════════════════════════════════
   API HELPERS (dùng chung utils/callAPI.js — có sẵn interceptor gắn token)
════════════════════════════════════════════════════════════ */
function normalizeResponse(data) {
  if (data && typeof data.success === "boolean") return data;
  return { success: true, data };
}

async function apiGet(url, params) {
  const res = await getData({ url, params });
  return res.success
    ? normalizeResponse(res.data)
    : { success: false, message: res.message || "Lỗi kết nối server" };
}
async function apiPatch(url, data) {
  const res = await patchData({ url, data });
  return res.success
    ? normalizeResponse(res.data)
    : { success: false, message: res.message || "Lỗi kết nối server" };
}
async function apiPost(url, data) {
  const res = await postData({ url, data });
  return res.success
    ? normalizeResponse(res.data)
    : { success: false, message: res.message || "Lỗi kết nối server" };
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const AVATAR_COLORS = [
  ["#059669", "#34d399"], ["#7c3aed", "#a78bfa"], ["#ea580c", "#fb923c"],
  ["#0284c7", "#38bdf8"], ["#be123c", "#fb7185"], ["#0f766e", "#2dd4bf"],
];
function avatarColor(seed = "") {
  const idx = seed ? seed.charCodeAt(seed.length - 1) % AVATAR_COLORS.length : 0;
  return AVATAR_COLORS[idx];
}
function initials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}
function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "Chưa đăng nhập";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "Chưa đăng nhập";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtMoney(n) {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}
const ORDER_STATUS_META = {
  COMPLETED: { label: "Hoàn thành", cls: "completed" },
  CANCELLED: { label: "Đã huỷ", cls: "cancelled" },
  PENDING: { label: "Chờ xử lý", cls: "pending" },
  PROCESSING: { label: "Đang xử lý", cls: "processing" },
};
function orderStatusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status || "—", cls: "default" };
}
const PAYMENT_LABELS = {
  CASH: "Tiền mặt",
  CARD: "Thẻ",
  BANK_TRANSFER: "Chuyển khoản",
  MOMO: "Momo",
  VNPAY: "VNPay",
  ZALOPAY: "ZaloPay",
};
function paymentLabel(pm) {
  return PAYMENT_LABELS[pm] || pm || "—";
}
function orderItemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const shown = items.slice(0, 2).map((it) => `${it.foodName || "Món"} ×${it.quantity ?? 1}`);
  const rest = items.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest} món khác` : shown.join(", ");
}
function statusOf(c) {
  if (!c) return "active";
  if (c.isLocked) return "locked";
  const until = c.lockedUntil ? new Date(c.lockedUntil) : null;
  if (until && !isNaN(until.getTime()) && until > new Date()) return "templock";
  return "active";
}
const STATUS_TABS = [
  { key: "all", label: "Tất cả" },
  { key: "active", label: "Đang hoạt động" },
  { key: "locked", label: "Đã khoá" },
];

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════════════════ */
function Avatar({ name, seed }) {
  const [c1, c2] = avatarColor(seed);
  return (
    <div className="cm-avatar" style={{ background: `linear-gradient(135deg,${c1},${c2})` }}>
      {initials(name)}
    </div>
  );
}

function StatusBadge({ customer }) {
  const st = statusOf(customer);
  const label = st === "active" ? "Đang hoạt động" : st === "locked" ? "Đã khoá" : "Tạm khoá (sai MK)";
  return (
    <div>
      <span className={`cm-status-badge ${st}`}>
        <span className="cm-status-dot" /> {label}
      </span>
      {customer.mustChangePassword && <span className="cm-must-change">⚠ Cần đổi mật khẩu</span>}
    </div>
  );
}

/* ── Generic confirm modal (Khoá / Mở khoá / Reset mật khẩu — bước 1) ── */
function ConfirmModal({ tone, icon, title, sub, children, confirmLabel, loading, onConfirm, onClose }) {
  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal cm-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cm-modal-header">
          <div>
            <p className="cm-modal-title">{title}</p>
            {sub && <p className="cm-modal-sub">{sub}</p>}
          </div>
          <button className="cm-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="cm-confirm-body">
          <div className={`cm-confirm-icon ${tone}`}>{icon}</div>
          <p className="cm-confirm-text">{children}</p>
          <div className="cm-confirm-actions">
            <button className="cm-cancel-btn" onClick={onClose} disabled={loading}>Huỷ</button>
            <button className={`cm-confirm-btn ${tone}`} onClick={onConfirm} disabled={loading}>
              {loading ? <div className="cm-spin" /> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reset password result (bước 2, sau khi confirm) ── */
function ResetResultModal({ customer, tempPassword, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  function copy() {
    if (!navigator.clipboard) {
      setCopyError(true);
      return;
    }
    navigator.clipboard.writeText(tempPassword || "")
      .then(() => {
        setCopied(true);
        setCopyError(false);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopyError(true));
  }
  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal cm-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cm-modal-header">
          <div>
            <p className="cm-modal-title">Đã reset mật khẩu</p>
            <p className="cm-modal-sub">{customer.fullName}</p>
          </div>
          <button className="cm-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="cm-reset-result">
          <div className="cm-reset-ok-icon"><Check size={26} /></div>
          <p className="cm-reset-label">MẬT KHẨU TẠM MỚI</p>
          <div className="cm-pass-box">
            <span className="cm-pass-val">{tempPassword || "——————"}</span>
            {tempPassword && (
              <button className={`cm-copy-btn${copied ? " done" : ""}`} onClick={copy} title="Sao chép">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            )}
          </div>
          {copyError && (
            <p className="cm-reset-hint" style={{ color: "#b91c1c" }}>
              Không thể sao chép tự động, vui lòng bôi đen và copy thủ công.
            </p>
          )}
          <p className="cm-reset-hint">
            {tempPassword
              ? <>Đọc mã này cho khách qua điện thoại/chat hỗ trợ. Khách sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập kế tiếp.</>
              : <>Reset thành công nhưng server không trả về mật khẩu tạm — kiểm tra lại field phản hồi của API <code>reset-password</code>.</>}
          </p>
          <button className="cm-reset-done-btn" onClick={onClose}>Đã đọc, đóng lại</button>
        </div>
      </div>
    </div>
  );
}

/* ── Orders modal ── */
function OrdersModal({ customer, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const res = await apiGet(`/customers/${customer._id}/orders`);
      if (!alive) return;
      if (res.success) {
        // BE có thể trả phẳng { success, orders } hoặc bọc { success, data: { orders } }
        const payload = res.data ?? res;
        const rawOrders = payload.orders ?? (Array.isArray(payload) ? payload : []);
        setOrders(Array.isArray(rawOrders) ? rawOrders : []);
        setFailed(false);
      } else {
        setOrders([]);
        setFailed(true);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [customer._id]);

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal cm-orders-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cm-modal-header">
          <div>
            <p className="cm-modal-title">Lịch sử đơn hàng</p>
            <p className="cm-modal-sub">{customer.fullName} · {customer.phone}</p>
          </div>
          <button className="cm-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="cm-orders-body">
          {loading ? (
            <div className="cm-orders-loading"><div className="cm-spin" style={{ margin: "0 auto 8px" }} /><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Đang tải đơn hàng…</p></div>
          ) : failed ? (
            <div className="cm-empty">
              <div className="cm-empty-icon">🛠️</div>
              <p>Chưa lấy được dữ liệu đơn hàng.</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="cm-empty">
              <div className="cm-empty-icon">🧾</div>
              <p>Khách hàng chưa có đơn hàng nào.</p>
            </div>
          ) : (
            orders.filter(Boolean).map((o, i) => (
              <div key={o._id || i} className="cm-order-row">
                <div>
                  <p className="cm-order-code">#{o.orderCode || (typeof o._id === "string" ? o._id.slice(-6) : o._id) || i + 1}</p>
                  <p className="cm-order-date">{fmtDateTime(o.createdAt)}</p>
                </div>
                <span className="cm-order-amt">{fmtMoney(o.totalAmount ?? o.total)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton row ── */
function SkeletonRow() {
  return (
    <tr className="cm-skel-row">
      <td><div className="cm-skel" style={{ height: 40, width: 40, borderRadius: 12, display: "inline-block", marginRight: 10, verticalAlign: "middle" }} /><div className="cm-skel" style={{ height: 12, width: 120, display: "inline-block", verticalAlign: "middle" }} /></td>
      <td><div className="cm-skel" style={{ height: 12, width: 70 }} /></td>
      <td><div className="cm-skel" style={{ height: 20, width: 90, borderRadius: 100 }} /></td>
      <td><div className="cm-skel" style={{ height: 12, width: 100 }} /></td>
      <td><div className="cm-skel" style={{ height: 12, width: 30 }} /></td>
      <td><div className="cm-skel" style={{ height: 32, width: 96, marginLeft: "auto" }} /></td>
    </tr>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function CustomerManager() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [confirmAction, setConfirmAction] = useState(null); // { type: 'lock'|'unlock'|'reset', customer }
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [resetResult, setResetResult] = useState(null); // { customer, tempPassword }
  const [ordersCustomer, setOrdersCustomer] = useState(null);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const searchDebounce = useRef(null);
  const fetchIdRef = useRef(0);

  /* inject CSS */
  useEffect(() => {
    if (!document.getElementById("customer-manager-style")) {
      const tag = document.createElement("style");
      tag.id = "customer-manager-style";
      tag.textContent = STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  /* debounce search */
  useEffect(() => {
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(searchDebounce.current);
  }, [searchInput]);

  const fetchCustomers = useCallback(async (silent = false) => {
    const fetchId = ++fetchIdRef.current;
    silent ? setRefreshing(true) : setLoading(true);
    const res = await apiGet("/customers", {
      page,
      limit: LIMIT,
      search: search || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    });
    if (fetchIdRef.current !== fetchId) return; // request cũ hơn đã bị request mới ghi đè, bỏ qua
    if (res.success) {
      // BE trả phẳng { success, total, page, limit, customers } — không bọc trong "data",
      // nên fallback về chính res khi res.data không tồn tại.
      const payload = res.data ?? res;
      const rawItems = payload.customers ?? payload.items ?? (Array.isArray(payload) ? payload : []);
      const items = Array.isArray(rawItems) ? rawItems.filter(Boolean) : [];
      setList(items);
      setTotal(payload.total ?? items.length);
      setTotalPages(payload.totalPages ?? Math.max(1, Math.ceil((payload.total ?? items.length) / LIMIT)));
    } else {
      showToast(res.message || "Không thể tải danh sách khách hàng", true);
      setList([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [page, search, statusFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  function showToast(msg, isError = false) {
    clearTimeout(toastTimer.current);
    setToast({ msg, out: false, error: isError });
    toastTimer.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, out: true } : null));
      setTimeout(() => setToast(null), 350);
    }, 3000);
  }

  /* ── lock / unlock / reset execution ── */
  async function runConfirmAction() {
    if (!confirmAction) return;
    const { type, customer } = confirmAction;
    setConfirmLoading(true);
    if (type === "lock" || type === "unlock") {
      const res = await apiPatch(`/customers/${customer._id}/${type}`);
      if (res.success) {
        setList((prev) => prev.map((c) => (c._id === customer._id ? { ...c, isLocked: type === "lock" } : c)));
        showToast(type === "lock" ? "✅ Đã khoá tài khoản" : "✅ Đã mở khoá tài khoản");
        setConfirmAction(null);
      } else {
        showToast(res.message || "Thao tác thất bại", true);
      }
    } else if (type === "reset") {
      const res = await apiPost(`/customers/${customer._id}/reset-password`);
      if (res.success) {
        // Tương tự: BE có thể trả phẳng { success, tempPassword } thay vì bọc trong "data"
        const payload = res.data ?? res;
        const tempPassword = payload.tempPassword ?? payload.newPassword ?? payload.password ?? null;
        setList((prev) => prev.map((c) => (c._id === customer._id ? { ...c, mustChangePassword: true } : c)));
        setConfirmAction(null);
        setResetResult({ customer, tempPassword });
      } else {
        showToast(res.message || "Reset mật khẩu thất bại", true);
      }
    }
    setConfirmLoading(false);
  }

  /* ── stats ── */
  const mustChangeCount = list.filter((c) => c.mustChangePassword).length;

  return (
    <div className="cm-root">
      <div className="cm-wrap">

        {/* ── header ── */}
        <div className="cm-header">
          <div className="cm-header-left">
            <h1>Quản lý khách hàng</h1>
            <div className="cm-header-sub-row">
              <p>{total} khách hàng trong hệ thống</p>
            </div>
          </div>
          <div className="cm-header-actions">
            <button className={`cm-refresh-btn${refreshing ? " spinning" : ""}`} onClick={() => fetchCustomers(true)}>
              <RefreshCw size={14} /> {refreshing ? "Đang tải…" : "Làm mới"}
            </button>
          </div>
        </div>

        {/* ── stats ── */}
        <div className="cm-stats">
          {[
            { cls: "green", label: "Tổng khách hàng", val: total, sub: "Toàn hệ thống" },
            { cls: "amber", label: "Cần đổi mật khẩu", val: mustChangeCount, sub: "Sau khi admin reset (trang này)" },
          ].map((s, i) => (
            <div key={i} className={`cm-stat-card ${s.cls}`}>
              <p className="cm-stat-label">{s.label}</p>
              <p className="cm-stat-val">{s.val}</p>
              <p className="cm-stat-sub">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── toolbar ── */}
        <div className="cm-toolbar">
          <div className="cm-search-wrap">
            <span className="cm-search-icon"><Search size={15} /></span>
            <input
              className="cm-search"
              placeholder="Tìm theo tên hoặc số điện thoại…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="cm-tabs">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                className={`cm-tab${statusFilter === t.key ? " active" : ""}`}
                onClick={() => { setStatusFilter(t.key); setPage(1); }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── table ── */}
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
                <th>Đăng nhập gần nhất</th>
                <th>Số đơn</th>
                <th style={{ textAlign: "right" }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="cm-empty">
                      <div className="cm-empty-icon">🔍</div>
                      <p>Không tìm thấy khách hàng nào</p>
                    </div>
                  </td>
                </tr>
              ) : (
                list.map((c, i) => (
                  <tr key={c._id || c.phone || i}>
                    <td>
                      <div className="cm-cust-cell">
                        <Avatar name={c.fullName} seed={c._id} />
                        <div>
                          <p className="cm-cust-name">{c.fullName || "Chưa đặt tên"}</p>
                          <p className="cm-cust-phone">{c.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className="cm-cell-sub">{fmtDate(c.createdAt)}</span></td>
                    <td><StatusBadge customer={c} /></td>
                    <td><span className="cm-cell-sub">{fmtDateTime(c.lastLoginAt)}</span></td>
                    <td>
                      {c.orderCount === undefined || c.orderCount === null
                        ? <span className="cm-cell-sub">—</span>
                        : <span className="cm-order-count">{c.orderCount}</span>}
                    </td>
                    <td>
                      <div className="cm-row-actions">
                        <button className="cm-icon-btn" title="Xem lịch sử đơn" onClick={() => setOrdersCustomer(c)}>
                          <History size={15} />
                        </button>
                        {statusOf(c) === "locked" ? (
                          <button className="cm-icon-btn ok" title="Mở khoá" onClick={() => setConfirmAction({ type: "unlock", customer: c })}>
                            <LockOpen size={15} />
                          </button>
                        ) : (
                          <button className="cm-icon-btn danger" title="Khoá tài khoản" onClick={() => setConfirmAction({ type: "lock", customer: c })}>
                            <Lock size={15} />
                          </button>
                        )}
                        <button className="cm-icon-btn" title="Reset mật khẩu" onClick={() => setConfirmAction({ type: "reset", customer: c })}>
                          <KeyRound size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* ── pagination ── */}
          {!loading && list.length > 0 && (
            <div className="cm-pagination">
              <span className="cm-page-info">{total} khách hàng · {LIMIT}/trang</span>
              <div className="cm-page-nav">
                <button className="cm-nav-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <span className="cm-page-label">Trang {page} / {totalPages}</span>
                <button className="cm-nav-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── modals ── */}
      {confirmAction?.type === "lock" && (
        <ConfirmModal
          tone="rose" icon={<Lock size={24} />}
          title="Khoá tài khoản khách hàng" sub={confirmAction.customer.fullName}
          confirmLabel="Khoá tài khoản" loading={confirmLoading}
          onConfirm={runConfirmAction} onClose={() => setConfirmAction(null)}
        >
          Khách hàng <b>{confirmAction.customer.fullName}</b> ({confirmAction.customer.phone}) sẽ không thể đăng nhập cho tới khi được mở khoá lại. Bạn có chắc chắn?
        </ConfirmModal>
      )}
      {confirmAction?.type === "unlock" && (
        <ConfirmModal
          tone="green" icon={<LockOpen size={24} />}
          title="Mở khoá tài khoản" sub={confirmAction.customer.fullName}
          confirmLabel="Mở khoá" loading={confirmLoading}
          onConfirm={runConfirmAction} onClose={() => setConfirmAction(null)}
        >
          Khách hàng <b>{confirmAction.customer.fullName}</b> ({confirmAction.customer.phone}) sẽ có thể đăng nhập lại bình thường. Xác nhận mở khoá?
        </ConfirmModal>
      )}
      {confirmAction?.type === "reset" && (
        <ConfirmModal
          tone="amber" icon={<ShieldAlert size={24} />}
          title="Reset mật khẩu" sub={confirmAction.customer.fullName}
          confirmLabel="Reset mật khẩu" loading={confirmLoading}
          onConfirm={runConfirmAction} onClose={() => setConfirmAction(null)}
        >
          Hệ thống sẽ tạo mật khẩu tạm 6 số mới cho <b>{confirmAction.customer.fullName}</b> và buộc đổi mật khẩu ở lần đăng nhập kế tiếp. Mật khẩu cũ sẽ không còn dùng được.
        </ConfirmModal>
      )}
      {resetResult && (
        <ResetResultModal
          customer={resetResult.customer}
          tempPassword={resetResult.tempPassword}
          onClose={() => setResetResult(null)}
        />
      )}
      {ordersCustomer && (
        <OrdersModal customer={ordersCustomer} onClose={() => setOrdersCustomer(null)} />
      )}

      {/* ── toast ── */}
      {toast && <div className={`cm-toast${toast.out ? " out" : ""}${toast.error ? " error" : ""}`}>{toast.msg}</div>}
    </div>
  );
}