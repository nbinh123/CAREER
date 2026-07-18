// pages/ShiftPage.js
// Trang quản lý ca làm việc — kết nối với StaffManager.js
// Nhân viên xem / bắt đầu / kết thúc ca của chính mình.

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Clock, LogOut, Play, CheckCircle2, AlertTriangle,
    Timer, Wallet, CalendarDays, User, TrendingUp,
    ChevronRight, X, Briefcase, Zap, Coffee,
} from "lucide-react";
import useAuthZustand from "../zustand/useAuthZustand";

/* ════════════════════════════════════════════════════════════
   CSS-IN-JS  (tông màu xanh lá — khớp với StaffManager)
════════════════════════════════════════════════════════════ */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;}

/* ── root & background ── */
.sp-root{
  min-height:100vh;
  background:#f9fafb;
  font-family:'Nunito',sans-serif;
  position:relative;
  overflow-x:hidden;
}
.sp-dots{
  position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:radial-gradient(circle,#d1d5db44 1px,transparent 1px);
  background-size:28px 28px;
}
.sp-blob{
  position:fixed;border-radius:50%;filter:blur(90px);opacity:.3;
  pointer-events:none;z-index:0;animation:sp-float 12s ease-in-out infinite;
}
.sp-blob-1{width:500px;height:500px;background:#bbf7d0;top:-150px;left:-150px;animation-delay:0s;}
.sp-blob-2{width:380px;height:380px;background:#d1fae5;bottom:-80px;right:-80px;animation-delay:-5s;}
.sp-blob-3{width:260px;height:260px;background:#a7f3d0;top:45%;left:55%;animation-delay:-9s;}
@keyframes sp-float{0%,100%{transform:translateY(0) scale(1);}50%{transform:translateY(-28px) scale(1.04);}}

/* ── wrap ── */
.sp-wrap{
  position:relative;z-index:1;
  max-width:560px;margin:0 auto;
  padding:32px 20px 64px;
}

/* ── header ── */
.sp-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:28px;
  animation:sp-fade-down .45s ease both;
}
.sp-header-title{
  font-size:22px;font-weight:900;color:#064e3b;
  letter-spacing:-.4px;margin:0 0 3px;
}
.sp-header-sub{font-size:12px;font-weight:700;color:#6ee7b7;margin:0;}
.sp-back-btn{
  display:flex;align-items:center;gap:6px;
  padding:8px 14px;border-radius:12px;
  background:rgba(255,255,255,.8);border:2px solid #e5e7eb;
  font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;
  color:#065f46;cursor:pointer;transition:all .18s;
}
.sp-back-btn:hover{background:#f3f4f6;border-color:#6ee7b7;}

/* ── employee card ── */
.sp-emp-card{
  background:rgba(255,255,255,.84);
  backdrop-filter:blur(16px);
  border:1.5px solid rgba(187,247,208,.7);
  border-radius:20px;padding:18px 20px;
  display:flex;align-items:center;gap:14px;
  margin-bottom:18px;
  box-shadow:0 2px 16px rgba(16,185,129,.08);
  animation:sp-fade-up .45s ease both;
}
.sp-emp-avatar{
  width:52px;height:52px;border-radius:15px;
  display:flex;align-items:center;justify-content:center;
  font-size:20px;font-weight:900;color:#fff;flex-shrink:0;
  box-shadow:0 3px 12px rgba(0,0,0,.12);
}
.sp-emp-name{font-size:16px;font-weight:900;color:#064e3b;margin:0 0 4px;}
.sp-emp-meta{display:flex;align-items:center;gap:8px;}
.sp-emp-role{
  font-size:10px;font-weight:800;padding:3px 9px;border-radius:100px;
  text-transform:uppercase;letter-spacing:.5px;
}
.sp-emp-role.admin  {background:#fef3c7;color:#b45309;}
.sp-emp-role.manager{background:#ede9fe;color:#5b21b6;}
.sp-emp-role.cashier{background:#e0f2fe;color:#0369a1;}
.sp-emp-role.chef   {background:#ffedd5;color:#c2410c;}
.sp-emp-role.staff  {background:#f3f4f6;color:#15803d;}
.sp-status-dot{
  width:8px;height:8px;border-radius:50%;
  background:#22c55e;
  box-shadow:0 0 0 3px rgba(34,197,94,.2);
  animation:sp-pulse-dot 2s ease infinite;
}
.sp-status-dot.inactive{background:#94a3b8;box-shadow:none;animation:none;}
@keyframes sp-pulse-dot{0%,100%{opacity:1;}50%{opacity:.5;}}

/* ── no-shift screen ── */
.sp-no-shift{
  text-align:center;padding:48px 0 32px;
  animation:sp-fade-up .45s .1s ease both;
}
.sp-no-shift-icon{
  width:88px;height:88px;border-radius:26px;
  background:linear-gradient(135deg,#34d399,#059669);
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 20px;
  box-shadow:0 8px 28px rgba(5,150,105,.32);
}
.sp-no-shift h2{font-size:20px;font-weight:900;color:#064e3b;margin:0 0 8px;}
.sp-no-shift p{font-size:13px;font-weight:600;color:#6ee7b7;margin:0 0 28px;}
.sp-start-btn{
  display:inline-flex;align-items:center;gap:8px;
  padding:14px 32px;border-radius:16px;
  background:linear-gradient(135deg,#34d399,#059669);
  border:none;color:#fff;cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:15px;font-weight:900;
  box-shadow:0 6px 20px rgba(5,150,105,.38);
  transition:all .2s;
}
.sp-start-btn:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(5,150,105,.45);}
.sp-start-btn:active{transform:translateY(0);}

/* ── active-shift screen ── */
.sp-active{animation:sp-fade-up .45s ease both;}

/* ── ring timer ── */
.sp-ring-wrap{
  display:flex;flex-direction:column;align-items:center;
  margin-bottom:22px;
}
.sp-ring-container{position:relative;width:210px;height:210px;}
.sp-ring-svg{position:absolute;top:0;left:0;transform:rotate(-90deg);}
.sp-ring-center{
  position:absolute;inset:0;
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
}
.sp-ring-time{
  font-size:34px;font-weight:900;color:#064e3b;
  letter-spacing:-1px;line-height:1;
  font-family:'Space Grotesk',monospace;
}
.sp-ring-label{
  font-size:11px;font-weight:800;color:#6ee7b7;
  text-transform:uppercase;letter-spacing:.6px;margin-top:4px;
}
.sp-ring-pulse{
  position:absolute;inset:-6px;border-radius:50%;
  border:2px solid rgba(52,211,153,.35);
  animation:sp-ring-pulse 2.5s ease-in-out infinite;
}
@keyframes sp-ring-pulse{
  0%,100%{transform:scale(1);opacity:.7;}
  50%{transform:scale(1.03);opacity:.25;}
}

/* ── stats row ── */
.sp-stats{
  display:grid;grid-template-columns:repeat(3,1fr);gap:10px;
  margin-bottom:18px;
}
.sp-stat{
  background:rgba(255,255,255,.84);backdrop-filter:blur(16px);
  border:1.5px solid rgba(187,247,208,.6);border-radius:16px;
  padding:14px 12px;text-align:center;
  box-shadow:0 2px 10px rgba(16,185,129,.06);
  transition:transform .18s,box-shadow .18s;
}
.sp-stat:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(5,150,105,.12);}
.sp-stat-icon{
  width:32px;height:32px;border-radius:9px;
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 8px;
}
.sp-stat-label{font-size:10px;font-weight:800;color:#6ee7b7;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px;}
.sp-stat-val{font-size:16px;font-weight:900;color:#064e3b;margin:0;line-height:1;}
.sp-stat-val.earn{color:#059669;font-size:14px;}

/* ── shift info card ── */
.sp-info-card{
  background:rgba(255,255,255,.84);backdrop-filter:blur(16px);
  border:1.5px solid rgba(187,247,208,.6);border-radius:18px;
  padding:16px 20px;margin-bottom:18px;
  box-shadow:0 2px 12px rgba(16,185,129,.07);
}
.sp-info-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:7px 0;font-size:13px;
}
.sp-info-row:not(:last-child){border-bottom:1px solid #f3f4f6;}
.sp-info-key{
  font-weight:800;color:#6ee7b7;
  display:flex;align-items:center;gap:6px;
}
.sp-info-val{font-weight:800;color:#064e3b;}
.sp-info-val.live{
  color:#059669;
  display:flex;align-items:center;gap:4px;
}
.sp-live-dot{
  width:7px;height:7px;border-radius:50%;background:#22c55e;
  animation:sp-pulse-dot 1.5s ease infinite;
}

/* ── end shift button ── */
.sp-end-btn{
  width:100%;padding:15px;border-radius:16px;
  background:linear-gradient(135deg,#f43f5e,#e11d48);
  border:none;color:#fff;cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:15px;font-weight:900;
  display:flex;align-items:center;justify-content:center;gap:8px;
  box-shadow:0 6px 20px rgba(244,63,94,.32);
  transition:all .2s;margin-bottom:12px;
  letter-spacing:.2px;
}
.sp-end-btn:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(244,63,94,.4);}
.sp-end-btn:active{transform:translateY(0);}

/* ── confirm overlay ── */
.sp-overlay{
  position:fixed;inset:0;z-index:100;
  background:rgba(6,78,59,.28);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;
  padding:20px;
  animation:sp-fade .2s ease both;
}
@keyframes sp-fade{from{opacity:0;}to{opacity:1;}}
.sp-modal{
  background:#fff;border-radius:24px;
  box-shadow:0 24px 64px rgba(6,78,59,.18);
  width:100%;max-width:400px;
  animation:sp-modal-in .3s cubic-bezier(.22,.68,0,1.2) both;
  overflow:hidden;
}
@keyframes sp-modal-in{
  from{opacity:0;transform:translateY(20px) scale(.96);}
  to  {opacity:1;transform:translateY(0)    scale(1);}
}
.sp-modal-hdr{
  padding:20px 22px 0;
  display:flex;align-items:flex-start;justify-content:space-between;
}
.sp-modal-title{font-size:17px;font-weight:900;color:#064e3b;margin:0 0 3px;}
.sp-modal-sub{font-size:12px;font-weight:600;color:#6ee7b7;margin:0;}
.sp-modal-close{
  background:#f9fafb;border:none;cursor:pointer;
  width:30px;height:30px;border-radius:9px;
  display:flex;align-items:center;justify-content:center;
  color:#6ee7b7;transition:all .18s;flex-shrink:0;
}
.sp-modal-close:hover{background:#f3f4f6;color:#065f46;}
.sp-modal-body{padding:18px 22px 22px;}

/* confirm summary box */
.sp-confirm-summary{
  background:linear-gradient(135deg,#064e3b,#065f46);
  border-radius:16px;padding:18px;text-align:center;
  margin-bottom:16px;
}
.sp-confirm-time{
  font-size:36px;font-weight:900;color:#fff;
  letter-spacing:-1px;margin:0;
  font-family:'Space Grotesk',monospace;
}
.sp-confirm-sub{font-size:12px;font-weight:700;color:#6ee7b7;margin:4px 0 0;}
.sp-confirm-earn{font-size:18px;font-weight:900;color:#34d399;margin:10px 0 0;}

/* confirm breakdown */
.sp-confirm-breakdown{
  background:#f9fafb;border:1px solid #e5e7eb;
  border-radius:13px;padding:13px;margin-bottom:14px;
}
.sp-confirm-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:5px 0;font-size:13px;
}
.sp-confirm-row:not(:last-child){border-bottom:1px solid #f3f4f6;}
.sp-confirm-row-key{font-weight:800;color:#6ee7b7;}
.sp-confirm-row-val{font-weight:900;color:#064e3b;}

/* warn box */
.sp-warn-box{
  display:flex;align-items:flex-start;gap:8px;
  background:#fef9c3;border:1px solid #fde68a;border-radius:12px;
  padding:10px 13px;font-size:12px;font-weight:600;color:#92400e;
  margin-bottom:14px;
}

/* confirm actions */
.sp-confirm-actions{display:flex;gap:10px;}
.sp-cancel-btn{
  flex:1;padding:12px;border-radius:13px;
  background:#f9fafb;color:#065f46;border:2px solid #e5e7eb;
  font-family:'Nunito',sans-serif;font-size:14px;font-weight:800;
  cursor:pointer;transition:all .18s;
}
.sp-cancel-btn:hover{background:#f3f4f6;border-color:#6ee7b7;}
.sp-confirm-end-btn{
  flex:2;padding:12px;border-radius:13px;
  background:linear-gradient(135deg,#f43f5e,#e11d48);
  color:#fff;border:none;
  font-family:'Nunito',sans-serif;font-size:14px;font-weight:900;
  cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:7px;
  box-shadow:0 4px 14px rgba(244,63,94,.32);
  transition:all .18s;
}
.sp-confirm-end-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 18px rgba(244,63,94,.4);}
.sp-confirm-end-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}

/* ── success flash ── */
.sp-success{
  text-align:center;padding:48px 20px;
  animation:sp-fade-up .4s ease both;
}
.sp-success-icon{
  width:80px;height:80px;border-radius:24px;
  background:linear-gradient(135deg,#34d399,#059669);
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 18px;
  box-shadow:0 8px 28px rgba(5,150,105,.35);
}
.sp-success h2{font-size:20px;font-weight:900;color:#064e3b;margin:0 0 6px;}
.sp-success p {font-size:13px;font-weight:600;color:#6ee7b7;margin:0;}

/* ── toast ── */
.sp-toast{
  position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
  background:#064e3b;color:#6ee7b7;
  padding:11px 22px;border-radius:100px;
  font-size:13px;font-weight:800;
  box-shadow:0 8px 24px rgba(0,0,0,.18);
  pointer-events:none;white-space:nowrap;z-index:200;
  animation:sp-toast-in .35s cubic-bezier(.22,.68,0,1.2) both;
}
.sp-toast.out{animation:sp-toast-out .3s ease forwards;}
@keyframes sp-toast-in {from{opacity:0;transform:translateX(-50%) translateY(12px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
@keyframes sp-toast-out{from{opacity:1;transform:translateX(-50%) translateY(0);}to{opacity:0;transform:translateX(-50%) translateY(12px);}}

/* ── spin ── */
.sp-spin{
  width:16px;height:16px;
  border:2.5px solid rgba(255,255,255,.35);
  border-top-color:#fff;border-radius:50%;
  animation:sp-rotate .7s linear infinite;display:inline-block;
}
@keyframes sp-rotate{to{transform:rotate(360deg);}}

/* ── keyframes ── */
@keyframes sp-fade-down{from{opacity:0;transform:translateY(-16px);}to{opacity:1;transform:translateY(0);}}
@keyframes sp-fade-up  {from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
`;

/* ════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
════════════════════════════════════════════════════════════ */
const ROLE_LABELS = {
    admin: "Admin",
    manager: "Quản lý",
    cashier: "Thu ngân",
    chef: "Đầu bếp",
    staff: "Nhân viên",
};

const AVATAR_COLORS = [
    ["#059669", "#34d399"], ["#7c3aed", "#a78bfa"], ["#ea580c", "#fb923c"],
    ["#0284c7", "#38bdf8"], ["#be123c", "#fb7185"], ["#0f766e", "#2dd4bf"],
];

function avatarBg(id = "") {
    const idx = id.charCodeAt(id.length - 1) % AVATAR_COLORS.length;
    const [c1, c2] = AVATAR_COLORS[idx];
    return `linear-gradient(135deg,${c1},${c2})`;
}

function initials(name = "") {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** ms → "HH:MM:SS" */
function fmtElapsed(ms) {
    if (ms <= 0) return "00:00:00";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** ms → dạng "2h 15p" */
function fmtDuration(ms) {
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} phút`;
    return m > 0 ? `${h}h ${m}p` : `${h}h`;
}

/** minutes → "2h 15p" (dùng cho unpaidWorkTime đơn vị phút) */
function fmtMinutes(mins) {
    if (!mins && mins !== 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} phút`;
    return m > 0 ? `${h}h ${m}p` : `${h}h`;
}

function fmtMoney(n) {
    if (!n && n !== 0) return "—";
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function fmtTime(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Ước tính tiền kiếm được (ms elapsed, lương/giờ) */
function estimateEarnings(elapsedMs, hourlySalary = 0) {
    const hours = elapsedMs / 3_600_000;
    return Math.floor(hours * hourlySalary);
}

/* ════════════════════════════════════════════════════════════
   PROGRESS RING — SVG timer với vòng tròn tiến trình
   maxMs: mặc định 8 tiếng = 1 ca chuẩn
════════════════════════════════════════════════════════════ */
const RING_R = 88;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function ProgressRing({ elapsed, maxMs = 8 * 3_600_000 }) {
    const progress = Math.min(elapsed / maxMs, 1);
    const offset = RING_CIRCUMFERENCE * (1 - progress);

    return (
        <div className="sp-ring-container">
            <svg className="sp-ring-svg" width="210" height="210" viewBox="0 0 210 210" aria-hidden="true">
                <defs>
                    <linearGradient id="sp-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                </defs>

                {/* track */}
                <circle
                    cx="105" cy="105" r={RING_R}
                    fill="none" stroke="#e5e7eb" strokeWidth="10"
                />

                {/* progress */}
                <circle
                    cx="105" cy="105" r={RING_R}
                    fill="none"
                    stroke="url(#sp-ring-grad)" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                />
            </svg>

            {/* pulse ring */}
            <div className="sp-ring-pulse" />

            {/* center content */}
            <div className="sp-ring-center">
                <span className="sp-ring-time">{fmtElapsed(elapsed)}</span>
                <span className="sp-ring-label">Ca hiện tại</span>
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════
   END SHIFT CONFIRM MODAL
════════════════════════════════════════════════════════════ */
function EndShiftModal({ elapsed, hourlySalary, onConfirm, onCancel, loading }) {
    const minutesWorked = Math.floor(elapsed / 60_000);
    const earnings = estimateEarnings(elapsed, hourlySalary);
    const hasTime = minutesWorked > 0;

    return (
        <div className="sp-overlay" onClick={onCancel}>
            <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
                {/* header */}
                <div className="sp-modal-hdr">
                    <div>
                        <p className="sp-modal-title">Kết thúc ca làm việc?</p>
                        <p className="sp-modal-sub">Xem lại thông tin ca trước khi xác nhận</p>
                    </div>
                    <button className="sp-modal-close" onClick={onCancel}><X size={15} /></button>
                </div>

                <div className="sp-modal-body">
                    {/* big summary */}
                    <div className="sp-confirm-summary">
                        <p className="sp-confirm-time">{fmtElapsed(elapsed)}</p>
                        <p className="sp-confirm-sub">Thời gian làm việc hôm nay</p>
                        {hourlySalary > 0 && (
                            <p className="sp-confirm-earn">+ {fmtMoney(earnings)}</p>
                        )}
                    </div>

                    {/* breakdown */}
                    <div className="sp-confirm-breakdown">
                        <div className="sp-confirm-row">
                            <span className="sp-confirm-row-key"><Timer size={12} /> Số phút làm</span>
                            <span className="sp-confirm-row-val">{minutesWorked} phút</span>
                        </div>
                        <div className="sp-confirm-row">
                            <span className="sp-confirm-row-key"><TrendingUp size={12} /> Quy đổi giờ</span>
                            <span className="sp-confirm-row-val">{fmtDuration(elapsed)}</span>
                        </div>
                        {hourlySalary > 0 && (
                            <div className="sp-confirm-row">
                                <span className="sp-confirm-row-key"><Wallet size={12} /> Lương ước tính</span>
                                <span className="sp-confirm-row-val" style={{ color: "#059669" }}>{fmtMoney(earnings)}</span>
                            </div>
                        )}
                    </div>

                    {/* warning if very short */}
                    {minutesWorked < 5 && (
                        <div className="sp-warn-box">
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>
                                {minutesWorked === 0
                                    ? "Bạn chưa làm việc. Kết thúc sẽ không ghi nhận giờ làm."
                                    : "Ca làm việc rất ngắn. Hãy chắc chắn bạn muốn kết thúc."}
                            </span>
                        </div>
                    )}

                    {/* actions */}
                    <div className="sp-confirm-actions">
                        <button className="sp-cancel-btn" onClick={onCancel} disabled={loading}>
                            Quay lại
                        </button>
                        <button
                            className="sp-confirm-end-btn"
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading
                                ? <><div className="sp-spin" /><span>Đang xử lý…</span></>
                                : <><LogOut size={15} /><span>Xác nhận kết thúc</span></>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT: ShiftPage
════════════════════════════════════════════════════════════ */
export default function ShiftPage() {
    /* ── Zustand ── */
    const {
        currentUser,
        shiftStartTime,
        startShift,
        endShift,
    } = useAuthZustand();

    /* ── local state ── */
    const [elapsed, setElapsed] = useState(0);          // ms kể từ shiftStartTime
    const [confirming, setConfirming] = useState(false);      // hiện confirm modal
    const [endLoading, setEndLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);      // flash thành công
    const [toast, setToast] = useState(null);

    const timerRef = useRef(null);
    const toastRef = useRef(null);

    /* ── Inject CSS ── */
    useEffect(() => {
        const id = "shift-page-style";
        if (!document.getElementById(id)) {
            const tag = document.createElement("style");
            tag.id = id;
            tag.textContent = STYLE;
            document.head.appendChild(tag);
        }
        return () => document.getElementById(id)?.remove();
    }, []);

    /* ── Real-time timer — cập nhật mỗi giây ── */
    useEffect(() => {
        if (!shiftStartTime) {
            setElapsed(0);
            clearInterval(timerRef.current);
            return;
        }

        // Set ngay lập tức để tránh hiện "00:00:00" lần đầu
        setElapsed(Date.now() - shiftStartTime);

        timerRef.current = setInterval(() => {
            setElapsed(Date.now() - shiftStartTime);
        }, 1000);

        return () => clearInterval(timerRef.current);
    }, [shiftStartTime]);

    /* ── Toast helper ── */
    const showToast = useCallback((msg) => {
        clearTimeout(toastRef.current);
        setToast({ msg, out: false });
        toastRef.current = setTimeout(() => {
            setToast((t) => t ? { ...t, out: true } : null);
            setTimeout(() => setToast(null), 350);
        }, 3000);
    }, []);

    /* ── Bắt đầu ca ── */
    const handleStartShift = () => {
        startShift();
        showToast("✅ Bắt đầu ca làm việc!");
    };

    /* ── Kết thúc ca (sau khi confirm) ── */
    const handleEndShift = async () => {
        setEndLoading(true);
        try {
            const result = await endShift();

            if (!result.success) {
                showToast(`❌ ${result.message || "Lỗi khi kết thúc ca làm"}`);
                setConfirming(false);
                return;
            }

            // Flash success 1.5s rồi Zustand logout tự xử lý điều hướng
            setConfirming(false);
            setShowSuccess(true);
            // (logout đã được gọi trong endShift → isAuthenticated = false → app redirect)
        } finally {
            setEndLoading(false);
        }
    };

    /* ── guard: chưa login ── */
    if (!currentUser) {
        return (
            <div className="sp-root">
                <div className="sp-dots" />
                <div className="sp-wrap" style={{ textAlign: "center", paddingTop: 60 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#6ee7b7" }}>
                        Vui lòng đăng nhập để xem ca làm việc.
                    </p>
                </div>
            </div>
        );
    }

    const hourlySalary = currentUser.hourlySalary || 0;
    const earnings = estimateEarnings(elapsed, hourlySalary);
    const minutesWorked = Math.floor(elapsed / 60_000);

    return (
        <div className="sp-root">
            <div className="sp-dots" />
            <div className="sp-blob sp-blob-1" />
            <div className="sp-blob sp-blob-2" />
            <div className="sp-blob sp-blob-3" />

            <div className="sp-wrap">

                {/* ── Header ── */}
                <div className="sp-header">
                    <div>
                        <h1 className="sp-header-title">
                            {shiftStartTime ? "⏱ Ca đang chạy" : "🕐 Ca làm việc"}
                        </h1>
                        <p className="sp-header-sub">
                            {shiftStartTime
                                ? `Bắt đầu lúc ${fmtTime(shiftStartTime)}`
                                : "Bắt đầu ca để ghi nhận giờ làm"}
                        </p>
                    </div>
                    {/* Nút quay về StaffManager (admin/manager) */}
                    {(currentUser.role === "admin" || currentUser.role === "manager") && (
                        <button
                            className="sp-back-btn"
                            onClick={() => window.history.back()}
                        >
                            <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
                            Quản lý NV
                        </button>
                    )}
                </div>

                {/* ── Employee card ── */}
                <div className="sp-emp-card">
                    <div
                        className="sp-emp-avatar"
                        style={{ background: avatarBg(currentUser._id) }}
                    >
                        {currentUser.avatar
                            ? <img src={currentUser.avatar} alt={currentUser.fullName}
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 15 }} />
                            : initials(currentUser.fullName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="sp-emp-name">{currentUser.fullName}</p>
                        <div className="sp-emp-meta">
                            <span className={`sp-emp-role ${currentUser.role}`}>
                                {ROLE_LABELS[currentUser.role] || currentUser.role}
                            </span>
                            {shiftStartTime && <div className="sp-status-dot" />}
                        </div>
                    </div>
                    {hourlySalary > 0 && (
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: "#6ee7b7", marginBottom: 2 }}>LƯƠNG/GIỜ</div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#064e3b" }}>{fmtMoney(hourlySalary)}</div>
                        </div>
                    )}
                </div>

                {/* ════════════════ CHƯA CÓ CA ════════════════ */}
                {!shiftStartTime && !showSuccess && (
                    <div className="sp-no-shift">
                        <div className="sp-no-shift-icon">
                            <Briefcase size={36} color="#fff" />
                        </div>
                        <h2>Chưa có ca đang chạy</h2>
                        <p>Nhấn bắt đầu để ghi nhận thời gian làm việc của bạn</p>
                        <button className="sp-start-btn" onClick={handleStartShift}>
                            <Play size={16} fill="#fff" />
                            Bắt đầu ca làm việc
                        </button>

                        {/* Thống kê tổng ── lấy từ currentUser */}
                        {(currentUser.unpaidWorkTime > 0 || currentUser.totalWorkedTime > 0) && (
                            <div className="sp-stats" style={{ marginTop: 24 }}>
                                <div className="sp-stat">
                                    <div className="sp-stat-icon" style={{ background: "#fef9c3", color: "#d97706" }}>
                                        <Clock size={15} />
                                    </div>
                                    <p className="sp-stat-label">Chưa trả</p>
                                    <p className="sp-stat-val">{fmtMinutes(currentUser.unpaidWorkTime)}</p>
                                </div>
                                <div className="sp-stat">
                                    <div className="sp-stat-icon" style={{ background: "#ccfbf1", color: "#0d9488" }}>
                                        <TrendingUp size={15} />
                                    </div>
                                    <p className="sp-stat-label">Tổng đã làm</p>
                                    <p className="sp-stat-val">{fmtMinutes(currentUser.totalWorkedTime)}</p>
                                </div>
                                <div className="sp-stat">
                                    <div className="sp-stat-icon" style={{ background: "#ffe4e6", color: "#e11d48" }}>
                                        <Wallet size={15} />
                                    </div>
                                    <p className="sp-stat-label">Nợ lương</p>
                                    <p className="sp-stat-val earn">
                                        {fmtMoney(currentUser.unpaidSalaryAmount || 0)}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════════ ĐANG CÓ CA ════════════════ */}
                {shiftStartTime && !showSuccess && (
                    <div className="sp-active">
                        {/* Circular timer */}
                        <div className="sp-ring-wrap">
                            <ProgressRing elapsed={elapsed} />
                        </div>

                        {/* Stats row */}
                        <div className="sp-stats">
                            <div className="sp-stat">
                                <div className="sp-stat-icon" style={{ background: "#f3f4f6", color: "#16a34a" }}>
                                    <Timer size={15} />
                                </div>
                                <p className="sp-stat-label">Thời gian</p>
                                <p className="sp-stat-val">{fmtDuration(elapsed)}</p>
                            </div>
                            <div className="sp-stat">
                                <div className="sp-stat-icon" style={{ background: "#ccfbf1", color: "#0d9488" }}>
                                    <CalendarDays size={15} />
                                </div>
                                <p className="sp-stat-label">Bắt đầu</p>
                                <p className="sp-stat-val" style={{ fontSize: 13 }}>
                                    {fmtTime(shiftStartTime)}
                                </p>
                            </div>
                            <div className="sp-stat">
                                <div className="sp-stat-icon" style={{ background: "#fef9c3", color: "#d97706" }}>
                                    <Wallet size={15} />
                                </div>
                                <p className="sp-stat-label">Ước tính</p>
                                <p className="sp-stat-val earn">
                                    {hourlySalary > 0
                                        ? new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 0 }).format(earnings) + "đ"
                                        : "—"}
                                </p>
                            </div>
                        </div>

                        {/* Info card */}
                        <div className="sp-info-card">
                            <div className="sp-info-row">
                                <span className="sp-info-key"><CalendarDays size={12} />Bắt đầu ca</span>
                                <span className="sp-info-val">{fmtTime(shiftStartTime)}</span>
                            </div>
                            <div className="sp-info-row">
                                <span className="sp-info-key"><Timer size={12} />Số phút đã làm</span>
                                <span className="sp-info-val live">
                                    <span className="sp-live-dot" />
                                    {minutesWorked} phút
                                </span>
                            </div>
                            {hourlySalary > 0 && (
                                <div className="sp-info-row">
                                    <span className="sp-info-key"><Wallet size={12} />Lương ca này</span>
                                    <span className="sp-info-val live">
                                        <span className="sp-live-dot" />
                                        {fmtMoney(earnings)}
                                    </span>
                                </div>
                            )}
                            <div className="sp-info-row">
                                <span className="sp-info-key"><TrendingUp size={12} />Tổng giờ (cũ)</span>
                                <span className="sp-info-val">
                                    {fmtMinutes(currentUser.unpaidWorkTime)}
                                </span>
                            </div>
                        </div>

                        {/* End shift button */}
                        <button className="sp-end-btn" onClick={() => setConfirming(true)}>
                            <LogOut size={16} />
                            Kết thúc ca làm việc
                        </button>

                        <p style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#a7f3d0", margin: 0 }}>
                            Giờ làm sẽ được cộng vào hệ thống sau khi kết thúc
                        </p>
                    </div>
                )}

                {/* ════════════════ SUCCESS FLASH ════════════════ */}
                {showSuccess && (
                    <div className="sp-success">
                        <div className="sp-success-icon">
                            <CheckCircle2 size={38} color="#fff" />
                        </div>
                        <h2>Ca làm hoàn tất!</h2>
                        <p>Giờ làm đã được ghi nhận. Đang đăng xuất…</p>
                    </div>
                )}

            </div>{/* .sp-wrap */}

            {/* ── Confirm Modal ── */}
            {confirming && (
                <EndShiftModal
                    elapsed={elapsed}
                    hourlySalary={hourlySalary}
                    loading={endLoading}
                    onConfirm={handleEndShift}
                    onCancel={() => !endLoading && setConfirming(false)}
                />
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`sp-toast${toast.out ? " out" : ""}`}>{toast.msg}</div>
            )}
        </div>
    );
}