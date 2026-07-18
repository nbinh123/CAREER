import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import useIngredientZustand from "../zustand/useIngredientZustand";
import useAuthZustand from "../zustand/useAuthZustand";
import { API_URL } from '../config/api';

// ─── Thay bằng Zustand store thực tế của bạn ─────────────────────────────────
// import { useIngredientZustand } from '../stores/ingredientStore';
const API_BASE = `${API_URL}/api`;

const http = axios.create({ baseURL: API_BASE, withCredentials: true });
http.interceptors.request.use((c) => {
    // const t = localStorage.getItem('token');
    const token =
        useAuthZustand.getState().accessToken;
    // if (t) c.headers.Authorization = `Bearer ${t}`;
    if (token) c.headers.Authorization = `Bearer ${token}`
    return c;
});

const txService = {
    list: (p) => http.get('/ingredient-transactions', { params: p }),
    importStock: (fd) => http.post('/ingredient-transactions/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    exportStock: (d) => http.post('/ingredient-transactions/export', d),
};

// ─── Constants ────────────────────────────────────────────────────────────────
const EXPORT_REASONS = [
    { value: 'Sử dụng để chế biến món ăn', icon: '🍳' },
    { value: 'Hư hỏng / hết hạn sử dụng', icon: '🗑️' },
    { value: 'Trả lại nhà cung cấp', icon: '↩️' },
    { value: 'Kiểm kê điều chỉnh tồn kho', icon: '📋' },
    { value: 'Tặng / cho nhân viên', icon: '🎁' },
    { value: 'Thất thoát / mất mát', icon: '⚠️' },
    { value: 'Khác', icon: '✏️' },
];

const fmt = {
    money: (n) => n ? Number(n).toLocaleString('vi-VN') + 'đ' : '—',
    date: (d) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    num: (n) => Number(n).toLocaleString('vi-VN'),
};

// ─── CSS injected once ────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --bg:       #EEF0F5;
    --card:     #FFFFFF;
    --border:   #E4E8EF;
    --text-1:   #0D1117;
    --text-2:   #4B5563;
    --text-3:   #9CA3AF;
    --green:    #059669;
    --green-bg: #ECFDF5;
    --green-bd: #A7F3D0;
    --amber:    #D97706;
    --amber-bg: #FFFBEB;
    --amber-bd: #FDE68A;
    --blue:     #2563EB;
    --blue-bg:  #EFF6FF;
    --blue-bd:  #BFDBFE;
    --red:      #DC2626;
    --red-bg:   #FEF2F2;
    --red-bd:   #FECACA;
    --font:     'Plus Jakarta Sans', sans-serif;
    --mono:     'JetBrains Mono', monospace;
    --radius:   12px;
    --shadow:   0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --shadow-md: 0 4px 6px rgba(0,0,0,.06), 0 10px 30px rgba(0,0,0,.08);
    --shadow-lg: 0 20px 25px rgba(0,0,0,.10), 0 40px 80px rgba(0,0,0,.12);
}

body { font-family: var(--font); background: var(--bg); color: var(--text-1); }

@keyframes fadeUp   { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
@keyframes spin     { to   { transform:rotate(360deg) } }
@keyframes slideUp  { from { opacity:0; transform:translateY(32px) } to { opacity:1; transform:translateY(0) } }
@keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.5} }

.sp-page { font-family:var(--font); min-height:100vh; background:var(--bg); padding:28px 24px; animation:fadeUp .4s ease both; }
.sp-page * { font-family:var(--font); }

/* ── Header ── */
.sp-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
.sp-title  { font-size:22px; font-weight:800; color:var(--text-1); letter-spacing:-.5px; }
.sp-sub    { font-size:13px; color:var(--text-3); margin-top:3px; font-weight:500; }
.sp-actions { display:flex; gap:10px; flex-wrap:wrap; }

/* ── Buttons ── */
.btn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:9px; border:none; font-size:14px; font-weight:700; cursor:pointer; transition:all .18s; font-family:var(--font); white-space:nowrap; }
.btn:disabled { opacity:.55; cursor:not-allowed; }
.btn-import { background:linear-gradient(135deg,#059669,#047857); color:#fff; box-shadow:0 4px 14px rgba(5,150,105,.35); }
.btn-import:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(5,150,105,.45); }
.btn-export { background:linear-gradient(135deg,#D97706,#B45309); color:#fff; box-shadow:0 4px 14px rgba(217,119,6,.35); }
.btn-export:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(217,119,6,.45); }
.btn-ghost  { background:var(--card); color:var(--text-2); border:1.5px solid var(--border); box-shadow:var(--shadow); }
.btn-ghost:hover:not(:disabled) { background:#F9FAFB; border-color:#D1D5DB; }
.btn-primary { background:linear-gradient(135deg,#2563EB,#1D4ED8); color:#fff; box-shadow:0 4px 14px rgba(37,99,235,.35); }
.btn-primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(37,99,235,.45); }
.btn-danger  { background:linear-gradient(135deg,#DC2626,#B91C1C); color:#fff; box-shadow:0 4px 14px rgba(220,38,38,.3); }
.btn-danger:hover:not(:disabled)  { transform:translateY(-1px); box-shadow:0 6px 18px rgba(220,38,38,.4); }
.btn-sm { padding:6px 12px; font-size:12px; border-radius:7px; }

/* ── Stats ── */
.sp-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin-bottom:20px; }
.stat-card { background:var(--card); border-radius:var(--radius); border:1.5px solid var(--border); padding:18px 20px; box-shadow:var(--shadow); animation:fadeUp .4s ease both; position:relative; overflow:hidden; }
.stat-card::before { content:''; position:absolute; top:0; left:0; width:4px; height:100%; border-radius:4px 0 0 4px; }
.stat-card.green::before { background:var(--green); }
.stat-card.amber::before { background:var(--amber); }
.stat-card.blue::before  { background:var(--blue); }
.stat-card.red::before   { background:var(--red); }
.stat-icon  { font-size:22px; margin-bottom:10px; display:block; }
.stat-label { font-size:12px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:.6px; margin-bottom:6px; }
.stat-value { font-size:24px; font-weight:800; letter-spacing:-1px; font-variant-numeric:tabular-nums; }
.stat-value.green { color:var(--green); }
.stat-value.amber { color:var(--amber); }
.stat-value.blue  { color:var(--blue); }
.stat-value.red   { color:var(--red); }
.stat-sub { font-size:11px; color:var(--text-3); margin-top:4px; font-weight:500; }

/* ── Filter card ── */
.sp-filter { background:var(--card); border-radius:var(--radius); border:1.5px solid var(--border); padding:18px 20px; box-shadow:var(--shadow); margin-bottom:20px; }
.filter-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.filter-title { font-size:14px; font-weight:700; color:var(--text-1); }
.filter-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
.filter-item { display:flex; flex-direction:column; gap:5px; }
.filter-label { font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.5px; }
.filter-input { padding:9px 12px; border-radius:8px; border:1.5px solid var(--border); font-size:13.5px; font-family:var(--font); background:#FAFBFC; color:var(--text-1); outline:none; transition:border .15s,box-shadow .15s; }
.filter-input:focus { border-color:#93C5FD; box-shadow:0 0 0 3px rgba(37,99,235,.1); background:#fff; }
.filter-input::placeholder { color:var(--text-3); }

/* ── Table card ── */
.sp-table-card { background:var(--card); border-radius:var(--radius); border:1.5px solid var(--border); box-shadow:var(--shadow); overflow:hidden; }
.table-header { display:flex; justify-content:space-between; align-items:center; padding:18px 20px 14px; border-bottom:1.5px solid var(--border); }
.table-title  { font-size:14px; font-weight:700; color:var(--text-1); }
.table-count  { font-size:12px; color:var(--text-3); font-weight:500; margin-left:8px; }

.sp-table { width:100%; border-collapse:collapse; }
.sp-table th { padding:11px 16px; font-size:11px; font-weight:700; color:var(--text-3); text-transform:uppercase; letter-spacing:.5px; background:#FAFBFC; border-bottom:1.5px solid var(--border); text-align:left; white-space:nowrap; }
.sp-table th.right { text-align:right; }
.sp-table td { padding:13px 16px; border-bottom:1px solid #F3F4F6; vertical-align:middle; font-size:13.5px; }
.sp-table tr:last-child td { border-bottom:none; }
.sp-table tbody tr { transition:background .12s; }
.sp-table tbody tr:hover { background:#F8FAFC; }
.sp-table td.right { text-align:right; font-family:var(--mono); }

.badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; }
.badge-import { background:var(--green-bg); color:var(--green); border:1px solid var(--green-bd); }
.badge-export { background:var(--amber-bg); color:var(--amber); border:1px solid var(--amber-bd); }

.qty-import { color:var(--green); font-weight:700; font-family:var(--mono); }
.qty-export { color:var(--amber); font-weight:700; font-family:var(--mono); }
.ing-name   { font-weight:700; color:var(--text-1); }
.ing-unit   { font-size:11px; color:var(--text-3); font-weight:500; margin-top:1px; }
.user-name  { font-size:13px; color:var(--text-2); }
.note-text  { font-size:12px; color:var(--text-3); max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.date-text  { font-size:12px; color:var(--text-3); font-family:var(--mono); white-space:nowrap; }
.amount-text { font-family:var(--mono); font-size:13px; color:var(--text-2); font-weight:600; }

/* ── Empty & Loading ── */
.sp-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:64px 24px; color:var(--text-3); gap:10px; }
.sp-empty-icon { font-size:40px; }
.sp-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:64px 24px; gap:14px; }
.spinner { width:32px; height:32px; border:3px solid var(--border); border-top-color:var(--blue); border-radius:50%; animation:spin .75s linear infinite; }

/* ── Pagination ── */
.sp-pager { display:flex; align-items:center; justify-content:center; gap:6px; padding:16px; border-top:1.5px solid var(--border); }
.pg-btn { padding:6px 13px; border-radius:7px; border:1.5px solid var(--border); background:var(--card); color:var(--text-2); font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; font-family:var(--font); }
.pg-btn:hover:not(:disabled) { background:#F1F5F9; border-color:#D1D5DB; }
.pg-btn.active { background:var(--blue); border-color:var(--blue); color:#fff; }
.pg-btn:disabled { opacity:.4; cursor:not-allowed; }
.pg-dots { color:var(--text-3); padding:0 4px; font-size:13px; }

/* ── Modal overlay ── */
.modal-overlay { position:fixed; inset:0; background:rgba(10,14,20,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; animation:fadeIn .2s ease; }
.modal-box { background:var(--card); border-radius:18px; width:100%; max-width:520px; max-height:90vh; display:flex; flex-direction:column; box-shadow:var(--shadow-lg); animation:slideUp .25s ease both; }
.modal-box.tall { max-width:560px; }
.modal-head { padding:20px 24px 16px; border-bottom:1.5px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
.modal-title { font-size:17px; font-weight:800; color:var(--text-1); letter-spacing:-.3px; }
.modal-close { background:none; border:none; font-size:18px; cursor:pointer; color:var(--text-3); width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:6px; transition:background .15s; }
.modal-close:hover { background:#F1F5F9; color:var(--text-1); }
.modal-body { padding:20px 24px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }
.modal-foot { padding:14px 24px; border-top:1.5px solid var(--border); display:flex; justify-content:flex-end; gap:10px; }

/* ── Form ── */
.form-group { display:flex; flex-direction:column; gap:5px; }
.form-label { font-size:12px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.5px; }
.form-label .required { color:var(--red); margin-left:2px; }
.form-input { padding:10px 13px; border-radius:8px; border:1.5px solid var(--border); font-size:14px; font-family:var(--font); background:#FAFBFC; color:var(--text-1); outline:none; transition:border .15s,box-shadow .15s; width:100%; }
.form-input:focus { border-color:#93C5FD; box-shadow:0 0 0 3px rgba(37,99,235,.1); background:#fff; }
.form-input::placeholder { color:var(--text-3); }
.form-select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:32px; }
.form-textarea { resize:vertical; min-height:76px; }

.info-banner { background:#F8FAFC; border:1.5px solid var(--border); border-radius:9px; padding:11px 14px; display:flex; gap:16px; flex-wrap:wrap; }
.info-item { font-size:12.5px; color:var(--text-2); }
.info-item strong { color:var(--text-1); font-weight:700; }

.amount-calc { background:var(--green-bg); border:1.5px solid var(--green-bd); border-radius:9px; padding:11px 14px; font-size:14px; color:var(--green); font-weight:700; font-family:var(--mono); }

.upload-zone { border:2px dashed #CBD5E1; border-radius:10px; padding:20px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height:86px; background:#FAFBFC; transition:border .15s,background .15s; }
.upload-zone:hover { border-color:var(--blue); background:var(--blue-bg); }
.upload-zone-text { font-size:13px; color:var(--text-3); font-weight:500; }
.upload-preview { max-height:120px; border-radius:8px; object-fit:cover; box-shadow:var(--shadow); }

/* ── Reason radio ── */
.reason-list { display:flex; flex-direction:column; gap:6px; }
.reason-item { display:flex; align-items:center; gap:10px; padding:10px 13px; border-radius:9px; border:1.5px solid var(--border); cursor:pointer; transition:all .15s; }
.reason-item.active { border-color:var(--amber); background:var(--amber-bg); }
.reason-item:hover:not(.active) { background:#FAFBFC; border-color:#D1D5DB; }
.reason-radio { width:16px; height:16px; border-radius:50%; border:2px solid #D1D5DB; flex-shrink:0; transition:all .15s; display:flex; align-items:center; justify-content:center; }
.reason-item.active .reason-radio { border-color:var(--amber); background:var(--amber); }
.reason-item.active .reason-radio::after { content:''; width:6px; height:6px; border-radius:50%; background:#fff; }
.reason-text { font-size:13.5px; color:var(--text-2); font-weight:500; }
.reason-item.active .reason-text { color:var(--amber); font-weight:700; }

/* ── Alert boxes ── */
.alert { border-radius:9px; padding:11px 14px; font-size:13px; font-weight:500; }
.alert-error   { background:var(--red-bg);   color:var(--red);   border:1.5px solid var(--red-bd); }
.alert-warn    { background:var(--amber-bg);  color:var(--amber); border:1.5px solid var(--amber-bd); }
.alert-success { background:var(--green-bg);  color:var(--green); border:1.5px solid var(--green-bd); }

/* ── Image lightbox ── */
.lightbox { position:fixed; inset:0; background:rgba(0,0,0,.85); display:flex; align-items:center; justify-content:center; z-index:2000; cursor:pointer; animation:fadeIn .2s ease; }
.lightbox img { max-width:90vw; max-height:88vh; border-radius:12px; box-shadow:0 30px 80px rgba(0,0,0,.5); }

/* ── Responsive ── */
@media (max-width:768px) {
    .sp-page { padding:16px 14px; }
    .sp-title { font-size:18px; }
    .stat-value { font-size:20px; }
    .sp-table th:nth-child(n+6), .sp-table td:nth-child(n+6) { display:none; }
    .modal-box { max-height:95vh; }
}
@media (max-width:480px) {
    .sp-stats { grid-template-columns:1fr 1fr; }
    .filter-grid { grid-template-columns:1fr; }
    .sp-table th:nth-child(n+5), .sp-table td:nth-child(n+5) { display:none; }
}
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color, delay = 0 }) {
    return (
        <div className={`stat-card ${color}`} style={{ animationDelay: `${delay}ms` }}>
            <span className="stat-icon">{icon}</span>
            <div className="stat-label">{label}</div>
            <div className={`stat-value ${color}`}>{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    );
}

function Pagination({ page, totalPages, onChange }) {
    if (totalPages <= 1) return null;
    const pages = [];
    const delta = 2;
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) pages.push(i);
    if (pages[0] > 2) pages.unshift('...');
    if (pages[0] > 1) pages.unshift(1);
    if (pages[pages.length - 1] < totalPages - 1) pages.push('...');
    if (pages[pages.length - 1] < totalPages) pages.push(totalPages);

    return (
        <div className="sp-pager">
            <button className="pg-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>← Trước</button>
            {pages.map((p, i) =>
                p === '...'
                    ? <span key={`d${i}`} className="pg-dots">…</span>
                    : <button key={p} className={`pg-btn${p === page ? ' active' : ''}`} onClick={() => onChange(p)}>{p}</button>
            )}
            <button className="pg-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)}>Sau →</button>
        </div>
    );
}

function TransactionTable({ rows, loading, onViewImage }) {
    if (loading) {
        return (
            <div className="sp-loading">
                <div className="spinner" />
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Đang tải dữ liệu...</span>
            </div>
        );
    }
    if (!rows?.length) {
        return (
            <div className="sp-empty">
                <span className="sp-empty-icon">📋</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Không có giao dịch nào</span>
                <span style={{ fontSize: 13 }}>Thử thay đổi bộ lọc hoặc tạo giao dịch mới</span>
            </div>
        );
    }
    return (
        <div style={{ overflowX: 'auto' }}>
            <table className="sp-table">
                <thead>
                    <tr>
                        <th>Thời gian</th>
                        <th>Nguyên liệu</th>
                        <th>Loại</th>
                        <th className="right">Số lượng</th>
                        <th className="right">Thành tiền</th>
                        <th>Người thực hiện</th>
                        <th>Hóa đơn</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((tx) => {
                        const ing = tx.ingredientId;
                        const user = tx.createdBy;
                        const imp = tx.type === 'IMPORT';
                        return (
                            <tr key={tx._id}>
                                <td><span className="date-text">{fmt.date(tx.createdAt)}</span></td>
                                <td>
                                    <div className="ing-name">{ing?.ingredientName || '—'}</div>
                                    {ing?.smallUnit && <div className="ing-unit">{ing.smallUnit} / {ing.largeUnit}</div>}
                                </td>
                                <td>
                                    <span className={`badge ${imp ? 'badge-import' : 'badge-export'}`}>
                                        {imp ? '↑ Nhập' : '↓ Xuất'}
                                    </span>
                                </td>
                                <td className="right">
                                    <span className={imp ? 'qty-import' : 'qty-export'}>
                                        {imp ? '+' : '−'}{fmt.num(tx.quantity)}{' '}
                                        <span style={{ fontSize: 11, fontWeight: 400 }}>{ing?.smallUnit}</span>
                                    </span>
                                </td>
                                <td className="right">
                                    <span className="amount-text">{fmt.money(tx.amount)}</span>
                                </td>
                                <td>
                                    <span className="user-name">{user?.name || user?.email || '—'}</span>
                                </td>
                                <td>
                                    {tx.invoiceImage
                                        ? <button className="btn btn-ghost btn-sm" onClick={() => onViewImage(tx.invoiceImage)}>🖼️ Xem</button>
                                        : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                                </td>
                                <td><span className="note-text" title={tx.note}>{tx.note || '—'}</span></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function ImportModal({ open, onClose, onSuccess, ingredients }) {
    const [form, setForm] = useState({ ingredientId: '', quantity: '', note: '' });
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef();

    const ing = ingredients.find((i) => i._id === form.ingredientId);

    console.log(form.ingredientId);
    // amount = (quantity / smallUnitPerLargeUnit) * pricePerLargeUnit
    // Nếu schema có smallUnitPerLargeUnit thì dùng: (qty / ing.smallUnitPerLargeUnit) * ing.pricePerLargeUnit
    // Tạm tính theo pricePerLargeUnit trực tiếp — điều chỉnh công thức theo schema thực tế
    const amount = (() => {
        if (!ing || !form.quantity) return 0;
        const qty = parseFloat(form.quantity);
        if (isNaN(qty) || qty <= 0) return 0;
        return Math.round(qty / (ing.quantity) * ing.pricePerLargeUnit);
    })();

    useEffect(() => {
        if (!open) { setForm({ ingredientId: '', quantity: '', note: '' }); setFile(null); setPreview(null); setError(''); }
    }, [open]);

    const onFile = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setFile(f);
        setPreview(URL.createObjectURL(f));
    };

    const submit = async () => {
        setError('');
        if (!form.ingredientId) return setError('Vui lòng chọn nguyên liệu');
        const qty = parseFloat(form.quantity);
        if (!qty || qty <= 0) return setError('Số lượng phải lớn hơn 0');
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('ingredientId', form.ingredientId);
            fd.append('quantity', qty);
            fd.append('amount', amount);
            fd.append('note', form.note);
            if (file) fd.append('invoiceImage', file);
            await txService.importStock(fd);
            onSuccess?.();
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || 'Đã có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;
    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-head">
                    <span className="modal-title">📥 Nhập kho</span>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    {error && <div className="alert alert-error">⚠️ {error}</div>}

                    <div className="form-group">
                        <label className="form-label">Nguyên liệu <span className="required">*</span></label>
                        <select
                            className="form-input form-select"
                            value={form.ingredientId}
                            onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}
                        >
                            <option value="">— Chọn nguyên liệu —</option>
                            {ingredients.map((i) => (
                                <option key={i._id} value={i._id}>{i.ingredientName} ({i.smallUnit})</option>
                            ))}
                        </select>
                    </div>

                    {ing && (
                        <div className="info-banner">
                            <div className="info-item">Tồn kho: <strong>{fmt.num(ing.quantity)} {ing.smallUnit}</strong></div>
                            <div className="info-item">Đơn vị lớn: <strong>{ing.largeUnit}</strong></div>
                            <div className="info-item">Giá/{ing.largeUnit}: <strong>{fmt.money(ing.pricePerLargeUnit)}</strong></div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">
                            Số lượng ({ing?.smallUnit || 'đơn vị'}) <span className="required">*</span>
                        </label>
                        <input
                            className="form-input"
                            type="number" min="0" step="0.01"
                            placeholder="Nhập số lượng..."
                            value={form.quantity}
                            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        />
                    </div>

                    {amount > 0 && (
                        <div className="amount-calc">
                            💰 Thành tiền ≈ {fmt.money(amount)}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Ảnh hóa đơn</label>
                        <div className="upload-zone" onClick={() => fileRef.current.click()}>
                            {preview
                                ? <img src={preview} alt="preview" className="upload-preview" />
                                : <>
                                    <span style={{ fontSize: 22 }}>📎</span>
                                    <span className="upload-zone-text">Click để tải ảnh hóa đơn</span>
                                </>}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Ghi chú</label>
                        <textarea
                            className="form-input form-textarea"
                            placeholder="Ghi chú thêm (không bắt buộc)..."
                            value={form.note}
                            onChange={(e) => setForm({ ...form, note: e.target.value })}
                        />
                    </div>
                </div>
                <div className="modal-foot">
                    <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Hủy</button>
                    <button className="btn btn-primary" onClick={submit} disabled={loading}>
                        {loading ? '⏳ Đang lưu...' : '✅ Xác nhận nhập kho'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ExportModal({ open, onClose, onSuccess, ingredients }) {
    const [form, setForm] = useState({ ingredientId: '', quantity: '', reason: '', customNote: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmed, setConfirmed] = useState(false);

    const ing = ingredients.find((i) => i._id === form.ingredientId);
    const isOther = form.reason === 'Khác';
    const finalNote = isOther ? form.customNote : form.reason;

    useEffect(() => {
        if (!open) { setForm({ ingredientId: '', quantity: '', reason: '', customNote: '' }); setError(''); setConfirmed(false); }
    }, [open]);

    const validate = () => {
        if (!form.ingredientId) return 'Vui lòng chọn nguyên liệu';
        const qty = parseFloat(form.quantity);
        if (!qty || qty <= 0) return 'Số lượng phải lớn hơn 0';
        if (ing && qty > ing.quantity) return `Tồn kho không đủ — hiện có ${fmt.num(ing.quantity)} ${ing.smallUnit}`;
        if (!form.reason) return 'Vui lòng chọn lý do xuất kho';
        if (isOther && !form.customNote.trim()) return 'Vui lòng nhập lý do cụ thể';
        return null;
    };

    const submit = async () => {
        const err = validate();
        if (err) { setError(err); setConfirmed(false); return; }
        setError('');
        if (!confirmed) { setConfirmed(true); return; }
        setLoading(true);
        try {
            await txService.exportStock({ ingredientId: form.ingredientId, quantity: parseFloat(form.quantity), note: finalNote });
            onSuccess?.();
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || 'Đã có lỗi xảy ra');
            setConfirmed(false);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;
    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-box tall">
                <div className="modal-head">
                    <span className="modal-title">📤 Xuất kho</span>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    {error && <div className="alert alert-error">⚠️ {error}</div>}
                    {confirmed && !error && (
                        <div className="alert alert-warn">
                            ⚠️ Xác nhận xuất <strong>{form.quantity} {ing?.smallUnit}</strong> của <strong>{ing?.ingredientName}</strong>?
                            Nhấn "<strong>Xác nhận xuất kho</strong>" lần nữa để hoàn tất.
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Nguyên liệu <span className="required">*</span></label>
                        <select
                            className="form-input form-select"
                            value={form.ingredientId}
                            onChange={(e) => { setForm({ ...form, ingredientId: e.target.value }); setConfirmed(false); }}
                        >
                            <option value="">— Chọn nguyên liệu —</option>
                            {ingredients.map((i) => (
                                <option key={i._id} value={i._id}>{i.ingredientName} ({i.smallUnit})</option>
                            ))}
                        </select>
                    </div>

                    {ing && (
                        <div className="info-banner">
                            <div className="info-item">
                                Tồn kho:{' '}
                                <strong style={{ color: ing.quantity <= 0 ? 'var(--red)' : 'var(--green)' }}>
                                    {fmt.num(ing.quantity)} {ing.smallUnit}
                                </strong>
                            </div>
                            <div className="info-item">Đơn vị lớn: <strong>{ing.largeUnit}</strong></div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">
                            Số lượng ({ing?.smallUnit || 'đơn vị'}) <span className="required">*</span>
                        </label>
                        <input
                            className="form-input"
                            type="number" min="0" step="0.01"
                            placeholder="Nhập số lượng xuất..."
                            value={form.quantity}
                            onChange={(e) => { setForm({ ...form, quantity: e.target.value }); setConfirmed(false); }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Lý do xuất kho <span className="required">*</span></label>
                        <div className="reason-list">
                            {EXPORT_REASONS.map(({ value, icon }) => (
                                <div
                                    key={value}
                                    className={`reason-item${form.reason === value ? ' active' : ''}`}
                                    onClick={() => { setForm({ ...form, reason: value, customNote: '' }); setConfirmed(false); }}
                                >
                                    <div className="reason-radio" />
                                    <span style={{ fontSize: 16 }}>{icon}</span>
                                    <span className="reason-text">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {isOther && (
                        <div className="form-group">
                            <label className="form-label">Lý do cụ thể <span className="required">*</span></label>
                            <textarea
                                className="form-input form-textarea"
                                placeholder="Nhập lý do xuất kho..."
                                value={form.customNote}
                                onChange={(e) => setForm({ ...form, customNote: e.target.value })}
                            />
                        </div>
                    )}
                </div>
                <div className="modal-foot">
                    <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Hủy</button>
                    <button className="btn btn-danger" onClick={submit} disabled={loading}>
                        {loading ? '⏳ Đang xử lý...' : confirmed ? '⚠️ Xác nhận xuất kho' : '📤 Xuất kho'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StoragePage() {
    const { ingredients } = useIngredientZustand();

    const [rows, setRows] = useState([]);
    const [stats, setStats] = useState({ importCount: 0, importTotal: 0, exportCount: 0, exportTotal: 0 });
    const [pager, setPager] = useState({ page: 1, totalPages: 1, total: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lightbox, setLightbox] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [showExport, setShowExport] = useState(false);

    const [filters, setFilters] = useState({ search: '', type: '', fromDate: '', toDate: '' });
    const [debSearch, setDebSearch] = useState('');

    // Inject CSS once
    useEffect(() => {
        if (document.getElementById('sp-styles')) return;
        const el = document.createElement('style');
        el.id = 'sp-styles';
        el.textContent = GLOBAL_CSS;
        document.head.appendChild(el);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebSearch(filters.search), 380);
        return () => clearTimeout(t);
    }, [filters.search]);

    const load = useCallback(async (page = 1) => {
        setLoading(true);
        setError('');
        try {
            const p = { page, limit: 10 };
            if (debSearch) p.search = debSearch;
            if (filters.type) p.type = filters.type;
            if (filters.fromDate) p.fromDate = filters.fromDate;
            if (filters.toDate) p.toDate = filters.toDate;
            const res = await txService.list(p);
            const { transactions, pagination, stats: st } = res.data.data;
            setRows(transactions);
            setPager(pagination);
            setStats(st);
        } catch (e) {
            setError(e.response?.data?.message || 'Không thể tải dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [debSearch, filters.type, filters.fromDate, filters.toDate]);

    useEffect(() => { load(1); }, [load]);

    const set = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
    const reset = () => setFilters({ search: '', type: '', fromDate: '', toDate: '' });

    return (
        <div className="sp-page">
            {/* Lightbox */}
            {lightbox && (
                <div className="lightbox" onClick={() => setLightbox(null)}>
                    <img src={lightbox} alt="Hóa đơn" />
                </div>
            )}

            {/* Modals */}
            <ImportModal
                open={showImport} ingredients={ingredients}
                onClose={() => setShowImport(false)}
                onSuccess={() => load(1)}
            />
            <ExportModal
                open={showExport} ingredients={ingredients}
                onClose={() => setShowExport(false)}
                onSuccess={() => load(1)}
            />

            {/* Header */}
            <div className="sp-header">
                <div>
                    <div className="sp-title">Quản lý Kho Nguyên Liệu</div>
                    <div className="sp-sub">Theo dõi lịch sử nhập xuất kho và tồn kho thực tế</div>
                </div>
                <div className="sp-actions">
                    <button className="btn btn-import" onClick={() => setShowImport(true)}>↑ Nhập kho</button>
                    <button className="btn btn-export" onClick={() => setShowExport(true)}>↓ Xuất kho</button>
                </div>
            </div>

            {/* Stats */}
            <div className="sp-stats">
                <StatCard delay={0} color="green" icon="↑" label="Số lần nhập kho" value={fmt.num(stats.importCount)} sub="Tổng tất cả thời gian" />
                <StatCard delay={60} color="amber" icon="↓" label="Số lần xuất kho" value={fmt.num(stats.exportCount)} sub="Tổng tất cả thời gian" />
                <StatCard delay={120} color="blue" icon="💰" label="Tổng giá trị nhập" value={fmt.money(stats.importTotal)} sub="Chi phí nhập hàng" />
                <StatCard delay={180} color="red" icon="📊" label="Tổng giá trị xuất" value={fmt.money(stats.exportTotal)} sub="Giá trị hàng xuất" />
            </div>

            {/* Filter */}
            <div className="sp-filter">
                <div className="filter-head">
                    <span className="filter-title">🔍 Bộ lọc</span>
                    <button className="btn btn-ghost btn-sm" onClick={reset}>↺ Đặt lại</button>
                </div>
                <div className="filter-grid">
                    <div className="filter-item">
                        <label className="filter-label">Tìm nguyên liệu</label>
                        <input
                            className="filter-input"
                            placeholder="Gõ tên nguyên liệu..."
                            value={filters.search}
                            onChange={(e) => set('search', e.target.value)}
                        />
                    </div>
                    <div className="filter-item">
                        <label className="filter-label">Loại giao dịch</label>
                        <select className="filter-input form-select" value={filters.type} onChange={(e) => set('type', e.target.value)}>
                            <option value="">Tất cả</option>
                            <option value="IMPORT">↑ Nhập kho</option>
                            <option value="EXPORT">↓ Xuất kho</option>
                        </select>
                    </div>
                    <div className="filter-item">
                        <label className="filter-label">Từ ngày</label>
                        <input type="date" className="filter-input" value={filters.fromDate} onChange={(e) => set('fromDate', e.target.value)} />
                    </div>
                    <div className="filter-item">
                        <label className="filter-label">Đến ngày</label>
                        <input type="date" className="filter-input" value={filters.toDate} onChange={(e) => set('toDate', e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

            {/* Table */}
            <div className="sp-table-card">
                <div className="table-header">
                    <div>
                        <span className="table-title">Lịch sử giao dịch</span>
                        {!loading && <span className="table-count">({fmt.num(pager.total)} giao dịch)</span>}
                    </div>
                    {loading && <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />}
                </div>
                <TransactionTable rows={rows} loading={loading} onViewImage={setLightbox} />
                <Pagination page={pager.page} totalPages={pager.totalPages} onChange={(p) => load(p)} />
            </div>
        </div>
    );
}