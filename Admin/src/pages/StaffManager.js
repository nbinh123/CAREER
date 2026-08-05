// pages/StaffManager.js
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, RefreshCw } from "lucide-react";
import { getData, postData } from "../utils/callAPI";

/* ════════════════════════════════════════════════════════════
   CSS-IN-JS
════════════════════════════════════════════════════════════ */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }

.sm-root {
  min-height: 100vh;
  background: #f9fafb;
  font-family: 'Nunito', sans-serif;
  position: relative;
  overflow-x: hidden;
}

/* ── main layout ── */
.sm-wrap {
  position: relative; z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 60px;
}

/* ── header ── */
.sm-header {
  display: flex; align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 32px;
  animation: sm-fade-down 0.5s ease both;
}
.sm-header-left h1 {
  font-size: 28px; font-weight: 900;
  color: #064e3b; margin: 0 0 6px;
  letter-spacing: -0.5px;
}
.sm-header-sub-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.sm-header-left p {
  font-size: 13px; font-weight: 600;
  color: #6b7280; margin: 0;
}
.sm-live-badge {
  display: inline-flex; align-items: center; gap: 4px;
  background: #dcfce7; color: #166534;
  font-size: 11px; font-weight: 800;
  padding: 4px 11px; border-radius: 100px;
  white-space: nowrap;
}
.sm-header-actions { display: flex; gap: 10px; }

/* ── stats row ── */
.sm-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}
@media (max-width: 900px) { .sm-stats { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 500px) { .sm-stats { grid-template-columns: 1fr; } }

.sm-stat-card {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.03);
  animation: sm-fade-up 0.5s ease both;
  position: relative; overflow: hidden;
}
.sm-stat-card::before { content:''; position:absolute; top:0; left:0; width:4px; height:100%; }
.sm-stat-card.green::before { background:#059669; }
.sm-stat-card.teal::before  { background:#0d9488; }
.sm-stat-card.amber::before { background:#d97706; }
.sm-stat-card.rose::before  { background:#e11d48; }
.sm-stat-card:nth-child(1){ animation-delay:0.08s }
.sm-stat-card:nth-child(2){ animation-delay:0.14s }
.sm-stat-card:nth-child(3){ animation-delay:0.20s }
.sm-stat-card:nth-child(4){ animation-delay:0.26s }
.sm-stat-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px; }
.sm-stat-val   { font-size: 22px; font-weight: 900; color: #064e3b; margin: 0; line-height: 1; }
.sm-stat-sub   { font-size: 11px; font-weight: 500; color: #9ca3af; margin: 4px 0 0; }

/* ── toolbar ── */
.sm-toolbar {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 22px; flex-wrap: wrap;
  animation: sm-fade-up 0.5s 0.3s ease both;
}
.sm-search-wrap {
  position: relative; flex: 1; min-width: 200px;
}
.sm-search-icon {
  position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
  color: #9ca3af; display: flex; pointer-events: none;
}
.sm-search {
  width: 100%; padding: 10px 13px 10px 38px;
  font-family: 'Nunito', sans-serif;
  font-size: 14px; font-weight: 600; color: #064e3b;
  background: #fff;
  border: 2px solid #e5e7eb; border-radius: 12px; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.sm-search:focus { border-color: #34d399; box-shadow: 0 0 0 4px rgba(52,211,153,0.12); }
.sm-search::placeholder { color: #cbd5e1; }

/* role filter tabs */
.sm-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.sm-tab {
  padding: 8px 14px;
  font-family: 'Nunito', sans-serif;
  font-size: 12px; font-weight: 800;
  border-radius: 10px; border: 2px solid transparent;
  cursor: pointer; transition: all 0.18s;
  letter-spacing: 0.3px;
}
.sm-tab.active {
  background: #059669; color: #fff;
  box-shadow: 0 3px 10px rgba(5,150,105,0.3);
}
.sm-tab:not(.active) {
  background: #fff; color: #065f46;
  border-color: #e5e7eb;
}
.sm-tab:not(.active):hover { background: #f3f4f6; border-color: #9ca3af; }

/* ── grid ── */
.sm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

/* ── staff card ── */
.sm-card {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.03);
  transition: box-shadow 0.2s, border-color 0.2s;
  animation: sm-fade-up 0.45s ease both;
  position: relative; overflow: hidden;
}
.sm-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,.07);
  border-color: #d1d5db;
}
.sm-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  border-radius: 20px 20px 0 0;
}
.sm-card[data-role="admin"]::before   { background: linear-gradient(90deg,#f59e0b,#d97706); }
.sm-card[data-role="manager"]::before { background: linear-gradient(90deg,#6366f1,#4f46e5); }
.sm-card[data-role="cashier"]::before { background: linear-gradient(90deg,#0ea5e9,#0284c7); }
.sm-card[data-role="chef"]::before    { background: linear-gradient(90deg,#f97316,#ea580c); }
.sm-card[data-role="staff"]::before   { background: linear-gradient(90deg,#34d399,#059669); }

/* card top row */
.sm-card-top {
  display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
}
.sm-avatar {
  width: 48px; height: 48px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 900; color: #fff;
  flex-shrink: 0; position: relative;
  box-shadow: 0 3px 10px rgba(0,0,0,0.12);
}
.sm-avatar img {
  width: 100%; height: 100%; object-fit: cover;
  border-radius: 14px;
}
.sm-avatar-status {
  position: absolute; bottom: -2px; right: -2px;
  width: 13px; height: 13px; border-radius: 50%;
  border: 2px solid #fff;
}
.sm-avatar-status.active   { background: #22c55e; }
.sm-avatar-status.inactive { background: #94a3b8; }

.sm-card-info { flex: 1; min-width: 0; }
.sm-card-name {
  font-size: 15px; font-weight: 900; color: #064e3b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin: 0 0 4px;
}
.sm-card-phone { font-size: 12px; font-weight: 600; color: #9ca3af; margin: 0; }

.sm-role-badge {
  font-size: 10px; font-weight: 800;
  padding: 3px 9px; border-radius: 100px;
  text-transform: uppercase; letter-spacing: 0.5px;
  white-space: nowrap;
}
.sm-role-badge.admin   { background:#fef3c7;color:#b45309; }
.sm-role-badge.manager { background:#ede9fe;color:#5b21b6; }
.sm-role-badge.cashier { background:#e0f2fe;color:#0369a1; }
.sm-role-badge.chef    { background:#ffedd5;color:#c2410c; }
.sm-role-badge.staff   { background:#f3f4f6;color:#15803d; }

/* card stats row */
.sm-card-stats {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 8px; margin-bottom: 14px;
}
.sm-mini-stat {
  background: #f9fafb; border-radius: 11px;
  padding: 9px 10px; text-align: center;
  border: 1px solid #e5e7eb;
}
.sm-mini-stat-label { font-size: 10px; font-weight: 700; color: #cbd5e1; margin: 0 0 3px; }
.sm-mini-stat-val   { font-size: 14px; font-weight: 900; color: #065f46; margin: 0; }
.sm-mini-stat-val.warn { color: #d97706; }
.sm-mini-stat-val.ok   { color: #16a34a; }

/* card actions */
.sm-card-actions { display: flex; gap: 8px; }
.sm-action-btn {
  flex: 1; padding: 9px 6px;
  font-family: 'Nunito', sans-serif;
  font-size: 11px; font-weight: 800;
  border-radius: 11px; border: 2px solid transparent;
  cursor: pointer; display: flex;
  align-items: center; justify-content: center; gap: 5px;
  transition: all 0.18s; letter-spacing: 0.2px;
}
.sm-action-btn.info {
  background: #f9fafb; color: #065f46; border-color: #e5e7eb;
}
.sm-action-btn.info:hover { background: #f3f4f6; border-color: #9ca3af; }
.sm-action-btn.schedule {
  background: #f0f9ff; color: #0369a1; border-color: #bae6fd;
}
.sm-action-btn.schedule:hover { background: #e0f2fe; border-color: #7dd3fc; }
.sm-action-btn.pay {
  background: #059669;
  color: #fff; border-color: transparent;
  box-shadow: 0 2px 6px rgba(5,150,105,0.25);
}
.sm-action-btn.pay:hover { background: #047857; }
.sm-action-btn.pay:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* ── empty state ── */
.sm-empty {
  grid-column: 1/-1; text-align: center;
  padding: 60px 20px;
  color: #cbd5e1;
}
.sm-empty-icon { font-size: 48px; margin-bottom: 12px; }
.sm-empty p { font-size: 14px; font-weight: 700; margin: 0; }

/* ── loading skeleton ── */
.sm-skeleton-card {
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 16px; padding: 20px;
  animation: sm-pulse 1.4s ease infinite;
}
@keyframes sm-pulse {
  0%,100%{ opacity:1 } 50%{ opacity:0.55 }
}
.sm-skel {
  background: #e5e7eb; border-radius: 8px; margin-bottom: 8px;
}
.sm-skel-circle { width:48px;height:48px;border-radius:14px; }
.sm-skel-line   { height:12px; }
.sm-skel-sm     { height:10px; width:60%; }

/* ── MODAL OVERLAY ── */
.sm-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(6,78,59,0.25);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: sm-fade 0.2s ease both;
}
@keyframes sm-fade { from{opacity:0} to{opacity:1} }

.sm-modal {
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 24px 64px rgba(6,78,59,0.18);
  width: 100%; max-height: 90vh;
  overflow-y: auto;
  animation: sm-modal-in 0.3s cubic-bezier(.22,.68,0,1.2) both;
  position: relative;
}
@keyframes sm-modal-in {
  from{opacity:0;transform:translateY(20px) scale(0.96)}
  to  {opacity:1;transform:translateY(0)    scale(1)}
}

/* modal header */
.sm-modal-header {
  padding: 24px 24px 0;
  display: flex; align-items: flex-start; justify-content: space-between;
  position: sticky; top: 0;
  background: #fff; z-index: 2;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 16px;
}
.sm-modal-title {
  font-size: 17px; font-weight: 900; color: #064e3b; margin: 0 0 3px;
}
.sm-modal-sub {
  font-size: 12px; font-weight: 600; color: #9ca3af; margin: 0;
}
.sm-modal-close {
  background: #f9fafb; border: none; cursor: pointer;
  width: 32px; height: 32px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #9ca3af; transition: all 0.18s; flex-shrink: 0;
}
.sm-modal-close:hover { background: #f3f4f6; color: #065f46; }

/* ── INFO MODAL ── */
.sm-info-modal { max-width: 480px; }
.sm-info-body { padding: 20px 24px 24px; }

.sm-info-avatar-row {
  display: flex; align-items: center; gap: 14px;
  background: #f9fafb; border-radius: 16px;
  padding: 16px; margin-bottom: 20px;
  border: 1px solid #e5e7eb;
}
.sm-info-avatar {
  width: 60px; height: 60px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 900; color: #fff;
  flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.sm-info-avatar img { width:100%;height:100%;object-fit:cover;border-radius:16px; }
.sm-info-name { font-size:18px;font-weight:900;color:#064e3b;margin:0 0 4px; }
.sm-info-meta { display:flex;gap:6px;align-items:center;flex-wrap:wrap; }

.sm-info-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  margin-bottom: 16px;
}
.sm-info-item {
  background: #f9fafb; border-radius: 12px;
  padding: 11px 13px; border: 1px solid #e5e7eb;
}
.sm-info-item.full { grid-column: 1/-1; }
.sm-info-item-label {
  font-size: 10px; font-weight: 800; color: #9ca3af;
  text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;
  display: flex; align-items: center; gap: 4px;
}
.sm-info-item-val {
  font-size: 13px; font-weight: 800; color: #064e3b; margin: 0;
}
.sm-info-item-val.muted { color: #cbd5e1; font-weight: 600; }

.sm-salary-box {
  background: linear-gradient(135deg,#064e3b,#065f46);
  border-radius: 16px; padding: 16px;
  display: grid; grid-template-columns: repeat(3,1fr); gap: 12px;
  margin-bottom: 4px;
}
.sm-salary-item-label { font-size:10px;font-weight:700;color:#9ca3af;margin:0 0 4px; }
.sm-salary-item-val   { font-size:16px;font-weight:900;color:#fff;margin:0; }
.sm-salary-item-val.highlight { color:#34d399; }

/* ── SCHEDULE MODAL ── */
.sm-sched-modal { max-width: 680px; }
.sm-sched-body  { padding: 16px 24px 24px; }

.sm-week-nav {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.sm-week-label {
  font-size: 14px; font-weight: 800; color: #064e3b;
}
.sm-nav-btn {
  background: #f9fafb; border: 2px solid #e5e7eb;
  border-radius: 10px; width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #065f46; transition: all 0.18s;
  font-size: 18px; font-weight: 800; line-height: 1;
}
.sm-nav-btn:hover { background: #f3f4f6; border-color: #9ca3af; }

.sm-week-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 6px; }
.sm-day-col { min-height: 180px; }
.sm-day-header {
  text-align: center; padding: 6px 2px; margin-bottom: 6px;
  border-radius: 10px;
}
.sm-day-header.today { background: #059669; }
.sm-day-header.today .sm-day-name,
.sm-day-header.today .sm-day-num  { color: #fff; }
.sm-day-name { font-size:10px;font-weight:800;color:#9ca3af;display:block;margin-bottom:1px; }
.sm-day-num  { font-size:15px;font-weight:900;color:#064e3b;display:block; }

.sm-shift {
  border-radius: 9px; padding: 6px 7px; margin-bottom: 5px;
  font-size: 10px; font-weight: 800;
  border-left: 3px solid transparent;
}
.sm-shift.morning { background:#f3f4f6;border-color:#22c55e;color:#15803d; }
.sm-shift.evening { background:#ffe4e6;border-color:#f43f5e;color:#be123c; }
.sm-shift.full    { background:#dbeafe;border-color:#3b82f6;color:#1d4ed8; }
.sm-shift-time { display:block;margin-top:1px;font-weight:600;opacity:0.8; }

.sm-no-shift {
  height: 36px; border-radius: 9px;
  background: #f9fafb; border: 1px dashed #e5e7eb;
  display: flex; align-items: center; justify-content: center;
}
.sm-no-shift span { font-size:10px;color:#d1fae5;font-weight:700; }

.sm-sched-summary {
  display: grid; grid-template-columns: repeat(3,1fr); gap: 10px;
  margin-top: 16px; padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}
.sm-sched-sum-item {
  background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;
  padding:10px 12px;text-align:center;
}
.sm-sched-sum-label { font-size:10px;font-weight:800;color:#9ca3af;margin:0 0 3px; }
.sm-sched-sum-val   { font-size:16px;font-weight:900;color:#064e3b;margin:0; }

/* ── PAY MODAL ── */
.sm-pay-modal { max-width: 420px; }
.sm-pay-body  { padding: 20px 24px 24px; }

.sm-pay-summary {
  background: linear-gradient(135deg,#064e3b,#065f46);
  border-radius: 18px; padding: 20px;
  margin-bottom: 18px;
  text-align: center;
}
.sm-pay-amount-label { font-size:12px;font-weight:700;color:#9ca3af;margin:0 0 6px; }
.sm-pay-amount-val   { font-size:36px;font-weight:900;color:#fff;margin:0;letter-spacing:-1px; }
.sm-pay-amount-sub   { font-size:12px;font-weight:600;color:#cbd5e1;margin:4px 0 0; }

.sm-pay-breakdown {
  background: #f9fafb; border-radius: 14px; padding: 14px;
  border: 1px solid #e5e7eb; margin-bottom: 16px;
}
.sm-pay-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 0; font-size: 13px; font-weight: 700;
}
.sm-pay-row:not(:last-child) { border-bottom: 1px solid #e5e7eb; }
.sm-pay-row-label { color: #9ca3af; }
.sm-pay-row-val   { color: #064e3b; font-weight: 900; }
.sm-pay-row-val.big { color: #059669; font-size: 15px; }

.sm-pay-warn {
  display: flex; align-items: flex-start; gap: 8px;
  background: #fef9c3; border: 1px solid #fde68a;
  border-radius: 12px; padding: 11px 13px;
  font-size: 12px; font-weight: 600; color: #92400e;
  margin-bottom: 16px;
}

.sm-pay-actions { display: flex; gap: 10px; }
.sm-cancel-btn {
  flex: 1; padding: 12px;
  font-family: 'Nunito',sans-serif; font-size: 14px; font-weight: 800;
  background: #f9fafb; color: #065f46;
  border: 2px solid #e5e7eb; border-radius: 13px; cursor: pointer;
  transition: all 0.18s;
}
.sm-cancel-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
.sm-confirm-pay-btn {
  flex: 2; padding: 12px;
  font-family: 'Nunito',sans-serif; font-size: 14px; font-weight: 900;
  background: #059669;
  color: #fff; border: none; border-radius: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 7px;
  box-shadow: 0 2px 8px rgba(5,150,105,0.25);
  transition: background 0.18s;
}
.sm-confirm-pay-btn:hover:not(:disabled) { background: #047857; }
.sm-confirm-pay-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

/* ── shared btn (colors match the Order page header buttons) ── */
.sm-add-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 18px;
  font-family: 'Nunito',sans-serif; font-size: 13px; font-weight: 900;
  background: #22c55e;
  color: #fff; border: none; border-radius: 12px; cursor: pointer;
  box-shadow: 0 2px 8px rgba(34,197,94,0.3);
  transition: background 0.18s; white-space: nowrap;
}
.sm-add-btn:hover { background: #16a34a; }

.sm-refresh-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px;
  font-family: 'Nunito',sans-serif; font-size: 13px; font-weight: 800;
  background: #fff; color: #4b5563;
  border: 2px solid #e5e7eb; border-radius: 12px; cursor: pointer;
  transition: all 0.18s;
}
.sm-refresh-btn:hover { background: #f3f4f6; border-color: #d1d5db; }
.sm-refresh-btn.spinning svg { animation: sm-rotate 0.8s linear infinite; }
@keyframes sm-rotate { to{ transform: rotate(360deg) } }

/* ── toast ── */
.sm-toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  background: #064e3b; color: #9ca3af;
  padding: 11px 22px; border-radius: 100px;
  font-size: 13px; font-weight: 800;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  pointer-events: none; white-space: nowrap; z-index: 200;
  animation: sm-toast-in 0.35s cubic-bezier(.22,.68,0,1.2) both;
}
.sm-toast.out { animation: sm-toast-out 0.3s ease forwards; }
@keyframes sm-toast-in  { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
@keyframes sm-toast-out { from{opacity:1;transform:translateX(-50%) translateY(0)} to{opacity:0;transform:translateX(-50%) translateY(12px)} }

/* ── animations ── */
@keyframes sm-fade-down {
  from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)}
}
@keyframes sm-fade-up {
  from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)}
}

/* scrollbar */
.sm-modal::-webkit-scrollbar { width: 5px; }
.sm-modal::-webkit-scrollbar-track { background: transparent; }
.sm-modal::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }

/* spin */
.sm-spin {
  width:16px;height:16px;
  border:2.5px solid rgba(255,255,255,0.35);
  border-top-color:#fff;border-radius:50%;
  animation:sm-rotate 0.7s linear infinite;
  display:inline-block;
}
`;

/* ════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
════════════════════════════════════════════════════════════ */
const ROLE_LABELS = {
  admin:   "Admin",
  manager: "Quản lý",
  cashier: "Thu ngân",
  chef:    "Đầu bếp",
  staff:   "Nhân viên",
};

const ROLE_TABS = ["all", "admin", "manager", "cashier", "chef", "staff"];

const AVATAR_COLORS = [
  ["#059669","#34d399"], ["#7c3aed","#a78bfa"], ["#ea580c","#fb923c"],
  ["#0284c7","#38bdf8"], ["#be123c","#fb7185"], ["#0f766e","#2dd4bf"],
];

function avatarColor(id) {
  const idx = id ? id.charCodeAt(id.length - 1) % AVATAR_COLORS.length : 0;
  return AVATAR_COLORS[idx];
}

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtHours(mins) {
  if (!mins && mins !== 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m}p` : `${h}h`;
}

function fmtMoney(n) {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function fmtDate(d) {
  if (!d) return "Chưa đăng nhập";
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════════════════ */

/* ── Avatar ── */
function Avatar({ staff, size = 48, radius = 14, fontSize = 18 }) {
  const [c1, c2] = avatarColor(staff._id);
  const style = {
    width: size, height: size, borderRadius: radius, fontSize,
    background: `linear-gradient(135deg,${c1},${c2})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontWeight: 900, fontFamily: "'Nunito',sans-serif",
    flexShrink: 0, position: "relative",
    boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
  };
  return (
    <div style={style}>
      {staff.avatar
        ? <img src={staff.avatar} alt={staff.fullName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: radius }} />
        : initials(staff.fullName)}
      <span
        className={`sm-avatar-status ${staff.isActive ? "active" : "inactive"}`}
      />
    </div>
  );
}

/* ── Role badge ── */
function RoleBadge({ role }) {
  return <span className={`sm-role-badge ${role}`}>{ROLE_LABELS[role] || role}</span>;
}

/* ════════════════════════════════════════════════════════════
   INFO MODAL
════════════════════════════════════════════════════════════ */
function InfoModal({ staff, onClose }) {
  return (
    <div className="sm-overlay" onClick={onClose}>
      <div className="sm-modal sm-info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sm-modal-header">
          <div>
            <p className="sm-modal-title">Thông tin nhân viên</p>
            <p className="sm-modal-sub">Chi tiết hồ sơ</p>
          </div>
          <button className="sm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="sm-info-body">
          {/* avatar row */}
          <div className="sm-info-avatar-row">
            <Avatar staff={staff} size={60} radius={16} fontSize={22} />
            <div>
              <p className="sm-info-name">{staff.fullName}</p>
              <div className="sm-info-meta">
                <RoleBadge role={staff.role} />
                {staff.isActive
                  ? <span style={{ fontSize:11,fontWeight:700,color:"#16a34a" }}>● Đang hoạt động</span>
                  : <span style={{ fontSize:11,fontWeight:700,color:"#94a3b8" }}>● Ngừng hoạt động</span>
                }
              </div>
            </div>
          </div>

          {/* info grid */}
          <div className="sm-info-grid">
            <div className="sm-info-item">
              <p className="sm-info-item-label">Số điện thoại</p>
              <p className="sm-info-item-val">{staff.phone}</p>
            </div>
            <div className="sm-info-item">
              <p className="sm-info-item-label">Tên đăng nhập</p>
              <p className={`sm-info-item-val${!staff.username ? " muted" : ""}`}>
                {staff.username || "Chưa đặt"}
              </p>
            </div>
            <div className="sm-info-item full">
              <p className="sm-info-item-label">Số CCCD</p>
              <p className="sm-info-item-val">{staff.citizenId}</p>
            </div>
            <div className="sm-info-item">
              <p className="sm-info-item-label">Đăng nhập cuối</p>
              <p className="sm-info-item-val" style={{ fontSize:12 }}>{fmtDate(staff.lastLogin)}</p>
            </div>
            <div className="sm-info-item">
              <p className="sm-info-item-label">Đổi mật khẩu</p>
              <p className="sm-info-item-val">
                {staff.mustChangePassword
                  ? <span style={{ color:"#d97706" }}>⚠ Chưa đổi</span>
                  : <span style={{ color:"#16a34a" }}>✓ Đã đổi</span>}
              </p>
            </div>
          </div>

          {/* salary box */}
          <div className="sm-salary-box">
            <div>
              <p className="sm-salary-item-label">Lương/giờ</p>
              <p className="sm-salary-item-val">{fmtMoney(staff.hourlySalary)}</p>
            </div>
            <div>
              <p className="sm-salary-item-label">Giờ chưa trả</p>
              <p className="sm-salary-item-val highlight">{fmtHours(staff.unpaidWorkTime)}</p>
            </div>
            <div>
              <p className="sm-salary-item-label">Tổng giờ đã làm</p>
              <p className="sm-salary-item-val">{fmtHours(staff.totalWorkedTime)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SCHEDULE MODAL
════════════════════════════════════════════════════════════ */
const DAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function classifyShift(start, end) {
  const h = parseInt(start?.split(":")?.[0] ?? 0, 10);
  if (h < 12) return "morning";
  if (h >= 17) return "evening";
  return "full";
}

function ScheduleModal({ staff, onClose }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduleData, setScheduleData] = useState([]);
  const [loading, setLoading] = useState(false);

  const weekDates = getWeekDates(weekOffset);
  const today = new Date();

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      try {
        const from = weekDates[0].toISOString().split("T")[0];
        const to   = weekDates[6].toISOString().split("T")[0];
        const res  = await getData({ url: `/schedules/user/${staff._id}?from=${from}&to=${to}` });
        setScheduleData(res.success ? (res.data?.shifts ?? []) : []);
      } catch {
        setScheduleData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff._id, weekOffset]);

  /* map shifts to day index (0=Mon…6=Sun) */
  function shiftsForDate(date) {
    const key = date.toISOString().split("T")[0];
    return scheduleData.filter((s) => s.date?.startsWith(key));
  }

  const totalShifts = scheduleData.length;
  const totalHours  = scheduleData.reduce((acc, s) => {
    const [sh, sm] = (s.startTime || "00:00").split(":").map(Number);
    const [eh, em] = (s.endTime   || "00:00").split(":").map(Number);
    return acc + (eh * 60 + em - sh * 60 - sm) / 60;
  }, 0);

  const weekLabel = `${weekDates[0].getDate()}/${weekDates[0].getMonth()+1} — ${weekDates[6].getDate()}/${weekDates[6].getMonth()+1}/${weekDates[6].getFullYear()}`;

  return (
    <div className="sm-overlay" onClick={onClose}>
      <div className="sm-modal sm-sched-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sm-modal-header">
          <div>
            <p className="sm-modal-title">Lịch làm việc — {staff.fullName}</p>
            <p className="sm-modal-sub">{weekLabel}</p>
          </div>
          <button className="sm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="sm-sched-body">
          {/* week nav */}
          <div className="sm-week-nav">
            <button className="sm-nav-btn" onClick={() => setWeekOffset((p) => p - 1)}>‹</button>
            <span className="sm-week-label">{weekLabel}</span>
            <button className="sm-nav-btn" onClick={() => setWeekOffset((p) => p + 1)}>›</button>
          </div>

          {loading ? (
            <div style={{ textAlign:"center",padding:"32px",color:"#9ca3af",fontWeight:700 }}>
              <div className="sm-spin" style={{ margin:"0 auto 8px" }}/>
              <p style={{ margin:0,fontSize:13 }}>Đang tải lịch…</p>
            </div>
          ) : (
            <>
              {/* 7-day grid */}
              <div className="sm-week-grid">
                {weekDates.map((date, idx) => {
                  const isToday = date.toDateString() === today.toDateString();
                  const shifts  = shiftsForDate(date);
                  const dayIdx  = (date.getDay() + 6) % 7; // Mon=0
                  return (
                    <div key={idx} className="sm-day-col">
                      <div className={`sm-day-header${isToday ? " today" : ""}`}>
                        <span className="sm-day-name">{DAYS_SHORT[dayIdx]}</span>
                        <span className="sm-day-num">{date.getDate()}</span>
                      </div>
                      {shifts.length > 0 ? shifts.map((s, si) => {
                        const cls = classifyShift(s.startTime, s.endTime);
                        return (
                          <div key={si} className={`sm-shift ${cls}`}>
                            {s.label || (cls === "morning" ? "Sáng" : cls === "evening" ? "Tối" : "Cả ngày")}
                            <span className="sm-shift-time">{s.startTime}–{s.endTime}</span>
                          </div>
                        );
                      }) : (
                        <div className="sm-no-shift"><span>—</span></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* legend */}
              <div style={{ display:"flex",gap:10,marginTop:12,flexWrap:"wrap" }}>
                {[["morning","Sáng"],["full","Cả ngày"],["evening","Tối"]].map(([cls,lbl])=>(
                  <span key={cls} className={`sm-shift ${cls}`} style={{ padding:"3px 9px",margin:0 }}>{lbl}</span>
                ))}
              </div>

              {/* summary */}
              <div className="sm-sched-summary">
                <div className="sm-sched-sum-item">
                  <p className="sm-sched-sum-label">Ca trong tuần</p>
                  <p className="sm-sched-sum-val">{totalShifts}</p>
                </div>
                <div className="sm-sched-sum-item">
                  <p className="sm-sched-sum-label">Giờ trong tuần</p>
                  <p className="sm-sched-sum-val">{totalHours.toFixed(1)}h</p>
                </div>
                <div className="sm-sched-sum-item">
                  <p className="sm-sched-sum-label">Giờ chưa trả lương</p>
                  <p className="sm-sched-sum-val" style={{ color:"#d97706" }}>{fmtHours(staff.unpaidWorkTime)}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PAY SALARY MODAL
════════════════════════════════════════════════════════════ */
function PayModal({ staff, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const amount = staff.unpaidSalaryAmount || (staff.unpaidWorkTime / 60) * staff.hourlySalary;

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await postData({ url: `/users/${staff._id}/pay-salary`, data: {} });
      if (res.success) {
        onSuccess(staff._id);
        onClose();
      } else {
        alert(res.message || "Trả lương thất bại");
      }
    } catch {
      alert("Lỗi server");
    } finally {
      setLoading(false);
    }
  }

  const hasUnpaid = staff.unpaidWorkTime > 0;

  return (
    <div className="sm-overlay" onClick={onClose}>
      <div className="sm-modal sm-pay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sm-modal-header">
          <div>
            <p className="sm-modal-title">Trả lương</p>
            <p className="sm-modal-sub">{staff.fullName}</p>
          </div>
          <button className="sm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="sm-pay-body">
          {/* amount */}
          <div className="sm-pay-summary">
            <p className="sm-pay-amount-label">SỐ TIỀN THANH TOÁN</p>
            <p className="sm-pay-amount-val">{fmtMoney(amount)}</p>
            <p className="sm-pay-amount-sub">{fmtHours(staff.unpaidWorkTime)} × {fmtMoney(staff.hourlySalary)}/giờ</p>
          </div>

          {/* breakdown */}
          <div className="sm-pay-breakdown">
            <div className="sm-pay-row">
              <span className="sm-pay-row-label">Giờ làm chưa trả</span>
              <span className="sm-pay-row-val">{fmtHours(staff.unpaidWorkTime)}</span>
            </div>
            <div className="sm-pay-row">
              <span className="sm-pay-row-label">Lương theo giờ</span>
              <span className="sm-pay-row-val">{fmtMoney(staff.hourlySalary)}</span>
            </div>
            <div className="sm-pay-row">
              <span className="sm-pay-row-label">Tổng giờ đã làm</span>
              <span className="sm-pay-row-val">{fmtHours(staff.totalWorkedTime)}</span>
            </div>
            <div className="sm-pay-row">
              <span className="sm-pay-row-label">Thành tiền</span>
              <span className="sm-pay-row-val big">{fmtMoney(amount)}</span>
            </div>
          </div>

          {/* warning if 0 */}
          {!hasUnpaid && (
            <div className="sm-pay-warn">
              <span>⚠️</span>
              <span>Nhân viên này không có giờ làm chưa được trả lương.</span>
            </div>
          )}

          {/* actions */}
          <div className="sm-pay-actions">
            <button className="sm-cancel-btn" onClick={onClose}>Hủy</button>
            <button
              className="sm-confirm-pay-btn"
              onClick={handleConfirm}
              disabled={loading || !hasUnpaid}
            >
              {loading
                ? <><div className="sm-spin"/><span>Đang xử lý…</span></>
                : "Xác nhận trả"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STAFF CARD
════════════════════════════════════════════════════════════ */
function StaffCard({ staff, idx, onInfo, onSchedule, onPay }) {
  const unpaidHours = staff.unpaidWorkTime ? (staff.unpaidWorkTime / 60) : 0;
  const unpaidAmt   = staff.unpaidSalaryAmount || unpaidHours * staff.hourlySalary;

  return (
    <div
      className="sm-card"
      data-role={staff.role}
      style={{ animationDelay: `${0.05 + idx * 0.04}s` }}
    >
      {/* top */}
      <div className="sm-card-top">
        <Avatar staff={staff} />
        <div className="sm-card-info">
          <p className="sm-card-name">{staff.fullName}</p>
          <p className="sm-card-phone">{staff.phone}</p>
        </div>
        <RoleBadge role={staff.role} />
      </div>

      {/* stats */}
      <div className="sm-card-stats">
        <div className="sm-mini-stat">
          <p className="sm-mini-stat-label">Giờ/TL</p>
          <p className={`sm-mini-stat-val ${unpaidHours > 0 ? "warn" : "ok"}`}>
            {unpaidHours > 0 ? `${unpaidHours.toFixed(1)}h` : "✓"}
          </p>
        </div>
        <div className="sm-mini-stat">
          <p className="sm-mini-stat-label">Nợ lương</p>
          <p className={`sm-mini-stat-val ${unpaidAmt > 0 ? "warn" : "ok"}`}>
            {unpaidAmt > 0
              ? new Intl.NumberFormat("vi-VN", { notation:"compact", maximumFractionDigits:0 }).format(unpaidAmt) + "đ"
              : "✓"}
          </p>
        </div>
        <div className="sm-mini-stat">
          <p className="sm-mini-stat-label">Tổng giờ</p>
          <p className="sm-mini-stat-val ok">{fmtHours(staff.totalWorkedTime)}</p>
        </div>
      </div>

      {/* actions */}
      <div className="sm-card-actions">
        <button className="sm-action-btn info"     onClick={() => onInfo(staff)}>Hồ sơ</button>
        <button className="sm-action-btn schedule" onClick={() => onSchedule(staff)}>Lịch</button>
        <button
          className="sm-action-btn pay"
          onClick={() => onPay(staff)}
          disabled={!staff.unpaidWorkTime}
        >
          Trả lương
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function StaffManager() {
  const [staffList, setStaffList]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  /* modals */
  const [infoStaff, setInfoStaff]       = useState(null);
  const [schedStaff, setSchedStaff]     = useState(null);
  const [payStaff, setPayStaff]         = useState(null);

  /* toast */
  const [toast, setToast]   = useState(null);
  const toastTimer          = useRef(null);

  /* inject CSS */
  useEffect(() => {
    const tag = document.createElement("style");
    tag.id = "staff-manager-style";
    if (!document.getElementById("staff-manager-style")) {
      tag.textContent = STYLE;
      document.head.appendChild(tag);
    }
    return () => tag.remove();
  }, []);

  /* fetch staff */
  const fetchStaff = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const res = await getData({ url: "/users" }); // adjust endpoint
      if (res.success) setStaffList(res.data?.users ?? res.data ?? []);
    } catch {
      showToast("❌ Không thể tải danh sách nhân viên");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  /* toast helper */
  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast({ msg, out: false });
    toastTimer.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, out: true } : null));
      setTimeout(() => setToast(null), 350);
    }, 3000);
  }

  /* after pay success → clear unpaid fields locally */
  function handlePaySuccess(staffId) {
    setStaffList((prev) =>
      prev.map((s) =>
        s._id === staffId
          ? { ...s, unpaidWorkTime: 0, unpaidSalaryAmount: 0 }
          : s
      )
    );
    showToast("✅ Trả lương thành công!");
  }

  /* ── filtered list ── */
  const filtered = staffList.filter((s) => {
    const matchRole = roleFilter === "all" || s.role === roleFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      s.fullName?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.username?.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  /* ── summary stats ── */
  const totalActive   = staffList.filter((s) => s.isActive).length;
  const totalUnpaidH  = staffList.reduce((a, s) => a + (s.unpaidWorkTime || 0), 0);
  const totalUnpaidAmt= staffList.reduce((a, s) => a + (s.unpaidSalaryAmount || (s.unpaidWorkTime / 60) * s.hourlySalary || 0), 0);

  /* ── skeleton ── */
  function SkeletonCard() {
    return (
      <div className="sm-skeleton-card">
        <div style={{ display:"flex",gap:10,marginBottom:12 }}>
          <div className="sm-skel sm-skel-circle"/>
          <div style={{ flex:1 }}>
            <div className="sm-skel sm-skel-line" style={{ width:"60%" }}/>
            <div className="sm-skel sm-skel-sm"/>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12 }}>
          {[1,2,3].map((i)=><div key={i} className="sm-skel" style={{ height:56 }}/>)}
        </div>
        <div className="sm-skel" style={{ height:38 }}/>
      </div>
    );
  }

  return (
    <div className="sm-root">
      <div className="sm-wrap">

        {/* ── header ── */}
        <div className="sm-header">
          <div className="sm-header-left">
            <h1>Quản lý nhân viên</h1>
            <div className="sm-header-sub-row">
              <p>{staffList.length} nhân viên trong hệ thống</p>
              <span className="sm-live-badge">🟢 {totalActive} đang hoạt động</span>
            </div>
          </div>
          <div className="sm-header-actions">
            <button className="sm-add-btn" onClick={() => window.location.href = "/register"}>
              <Plus size={15}/> Thêm nhân viên
            </button>
            <button
              className={`sm-refresh-btn${refreshing ? " spinning" : ""}`}
              onClick={() => fetchStaff(true)}
            >
              <RefreshCw size={14}/>
              {refreshing ? "Đang tải…" : "Làm mới"}
            </button>
          </div>
        </div>

        {/* ── stats ── */}
        <div className="sm-stats">
          {[
            { cls:"green",  label:"Tổng nhân viên",   val:staffList.length,           sub:`${totalActive} đang hoạt động` },
            { cls:"teal",   label:"Đang hoạt động",    val:totalActive,               sub:`${staffList.length - totalActive} tạm ngưng` },
            { cls:"amber",  label:"Giờ chưa trả lương", val:fmtHours(totalUnpaidH),    sub:"Tổng toàn bộ NV" },
            { cls:"rose",   label:"Nợ lương",          val:new Intl.NumberFormat("vi-VN",{notation:"compact",maximumFractionDigits:1}).format(totalUnpaidAmt)+"đ", sub:"Cần thanh toán" },
          ].map((s,i) => (
            <div key={i} className={`sm-stat-card ${s.cls}`}>
              <p className="sm-stat-label">{s.label}</p>
              <p className="sm-stat-val">{s.val}</p>
              <p className="sm-stat-sub">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── toolbar ── */}
        <div className="sm-toolbar">
          <div className="sm-search-wrap">
            <span className="sm-search-icon"><Search size={15}/></span>
            <input
              className="sm-search"
              placeholder="Tìm tên, SĐT, tài khoản…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sm-tabs">
            {ROLE_TABS.map((r) => (
              <button
                key={r}
                className={`sm-tab${roleFilter === r ? " active" : ""}`}
                onClick={() => setRoleFilter(r)}
              >
                {r === "all" ? "Tất cả" : ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* ── grid ── */}
        <div className="sm-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i}/>)
            : filtered.length === 0
              ? (
                <div className="sm-empty">
                  <div className="sm-empty-icon">🔍</div>
                  <p>Không tìm thấy nhân viên nào</p>
                </div>
              )
              : filtered.map((s, i) => (
                <StaffCard
                  key={s._id}
                  staff={s}
                  idx={i}
                  onInfo={setInfoStaff}
                  onSchedule={setSchedStaff}
                  onPay={setPayStaff}
                />
              ))
          }
        </div>
      </div>

      {/* ── modals ── */}
      {infoStaff  && <InfoModal     staff={infoStaff}  onClose={() => setInfoStaff(null)} />}
      {schedStaff && <ScheduleModal staff={schedStaff} onClose={() => setSchedStaff(null)} />}
      {payStaff   && <PayModal      staff={payStaff}   onClose={() => setPayStaff(null)}  onSuccess={handlePaySuccess} />}

      {/* ── toast ── */}
      {toast && (
        <div className={`sm-toast${toast.out ? " out" : ""}`}>{toast.msg}</div>
      )}
    </div>
  );
}