// pages/RegisterPage.js
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    Phone, User, CreditCard,
    ArrowRight, AlertCircle, UserCog, CheckCircle2,
} from "lucide-react";
import useAuthZustand from "../zustand/useAuthZustand";
import axios from "axios";
import { API_URL } from "../config/api";

/* ─── CSS-in-JS ──────────────────────────────────────────── */
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  .rp-root {
    min-height: 100vh;
    background: #f0fdf4;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Nunito', sans-serif;
    position: relative;
    overflow: hidden;
    padding: 32px 0;
  }

  /* blobs */
  .rp-blob {
    position: absolute; border-radius: 50%;
    filter: blur(80px); opacity: 0.45;
    pointer-events: none;
    animation: rp-float 8s ease-in-out infinite;
  }
  .rp-blob-1 { width:420px;height:420px;background:#bbf7d0;top:-120px;left:-100px;animation-delay:0s; }
  .rp-blob-2 { width:320px;height:320px;background:#a7f3d0;bottom:-80px;right:-80px;animation-delay:-3s; }
  .rp-blob-3 { width:200px;height:200px;background:#d1fae5;top:40%;left:55%;animation-delay:-6s; }
  @keyframes rp-float {
    0%,100% { transform:translateY(0) scale(1); }
    50%      { transform:translateY(-28px) scale(1.04); }
  }

  /* dots */
  .rp-dots {
    position:absolute;inset:0;pointer-events:none;
    background-image:radial-gradient(circle,#86efac55 1px,transparent 1px);
    background-size:28px 28px;
  }

  /* card */
  .rp-card {
    position:relative; z-index:10;
    width:100%; max-width:460px;
    margin:0 24px;
    background:rgba(255,255,255,0.82);
    backdrop-filter:blur(18px);
    -webkit-backdrop-filter:blur(18px);
    border:1.5px solid rgba(187,247,208,0.6);
    border-radius:28px;
    padding:40px 36px 36px;
    box-shadow:
      0 4px 6px -1px rgba(16,185,129,0.06),
      0 24px 48px -8px rgba(16,185,129,0.14),
      inset 0 1px 0 rgba(255,255,255,0.9);
    animation: rp-slide-up 0.55s cubic-bezier(.22,.68,0,1.2) both;
  }
  @keyframes rp-slide-up {
    from { opacity:0; transform:translateY(32px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)    scale(1);    }
  }

  /* logo */
  .rp-logo {
    display:flex; flex-direction:column; align-items:center;
    margin-bottom:28px;
    animation: rp-fade 0.6s 0.15s both;
  }
  .rp-logo-icon {
    width:64px; height:64px;
    background:linear-gradient(135deg,#34d399,#059669);
    border-radius:20px;
    display:flex; align-items:center; justify-content:center;
    font-size:28px;
    box-shadow:0 8px 24px rgba(5,150,105,0.3),inset 0 1px 0 rgba(255,255,255,0.25);
    margin-bottom:14px;
    animation: rp-pop 0.5s 0.25s cubic-bezier(.22,.68,0,1.4) both;
  }
  .rp-logo-title { font-size:22px;font-weight:900;color:#064e3b;letter-spacing:-0.5px;margin:0 0 4px; }
  .rp-logo-sub   { font-size:13px;font-weight:500;color:#6ee7b7; }
  @keyframes rp-pop {
    from { opacity:0; transform:scale(0.6) rotate(-8deg); }
    to   { opacity:1; transform:scale(1)   rotate(0);    }
  }
  @keyframes rp-fade {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0);   }
  }

  /* two-column row */
  .rp-row {
    display:grid; grid-template-columns:1fr 1fr; gap:12px;
    animation: rp-fade 0.5s both;
  }

  /* field */
  .rp-field { margin-bottom:14px; animation: rp-fade 0.5s both; }
  .rp-field:nth-child(1){animation-delay:0.28s}
  .rp-field:nth-child(2){animation-delay:0.34s}
  .rp-field:nth-child(3){animation-delay:0.40s}
  .rp-field:nth-child(4){animation-delay:0.46s}
  .rp-field:nth-child(5){animation-delay:0.52s}

  .rp-label {
    display:block; font-size:11px; font-weight:800;
    color:#065f46; letter-spacing:0.6px;
    text-transform:uppercase; margin-bottom:6px;
  }
  .rp-label .rp-required { color:#f87171; margin-left:2px; }

  .rp-input-wrap { position:relative; display:flex; align-items:center; }
  .rp-input-icon {
    position:absolute; left:13px; color:#6ee7b7;
    pointer-events:none; display:flex; transition:color 0.2s;
  }
  .rp-input {
    width:100%; box-sizing:border-box;
    padding:11px 13px 11px 40px;
    font-family:'Nunito',sans-serif;
    font-size:14px; font-weight:600;
    color:#064e3b; background:#f0fdf4;
    border:2px solid #bbf7d0;
    border-radius:13px; outline:none;
    transition:border-color 0.22s,box-shadow 0.22s,background 0.22s;
    appearance:none;
  }
  .rp-input::placeholder { color:#a7f3d0; font-weight:500; }
  .rp-input:focus {
    border-color:#34d399; background:#fff;
    box-shadow:0 0 0 4px rgba(52,211,153,0.15);
  }
  .rp-input.rp-error {
    border-color:#fca5a5; background:#fff5f5;
    box-shadow:0 0 0 4px rgba(252,165,165,0.15);
  }
  /* no-icon variant */
  .rp-input.rp-no-icon { padding-left:13px; }

  /* select */
  .rp-select {
    width:100%; box-sizing:border-box;
    padding:11px 13px 11px 40px;
    font-family:'Nunito',sans-serif;
    font-size:14px; font-weight:600;
    color:#064e3b; background:#f0fdf4;
    border:2px solid #bbf7d0; border-radius:13px;
    outline:none; cursor:pointer;
    transition:border-color 0.22s,box-shadow 0.22s;
    appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2334d399' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat:no-repeat;
    background-position:right 13px center;
    padding-right:36px;
  }
  .rp-select:focus {
    border-color:#34d399; background-color:#fff;
    box-shadow:0 0 0 4px rgba(52,211,153,0.15);
  }

  /* eye */
  .rp-eye {
    position:absolute; right:11px;
    background:none; border:none; cursor:pointer;
    color:#a7f3d0; padding:4px;
    display:flex; align-items:center;
    transition:color 0.2s; border-radius:8px;
  }
  .rp-eye:hover { color:#34d399; }

  /* error */
  .rp-err-msg {
    display:flex; align-items:center; gap:4px;
    font-size:11px; font-weight:700;
    color:#ef4444; margin-top:5px;
    animation: rp-shake 0.35s ease;
  }
  @keyframes rp-shake {
    0%,100%{transform:translateX(0)}
    25%{transform:translateX(-4px)}
    75%{transform:translateX(4px)}
  }

  /* default-pwd hint */
  .rp-hint {
    display:flex; align-items:flex-start; gap:7px;
    background:#ecfdf5; border:1.5px solid #a7f3d0;
    border-radius:12px; padding:10px 13px;
    margin-bottom:16px;
    font-size:12px; font-weight:600; color:#065f46;
    animation: rp-fade 0.5s 0.55s both;
  }
  .rp-hint svg { flex-shrink:0; margin-top:1px; color:#34d399; }

  /* divider */
  .rp-divider {
    display:flex; align-items:center; gap:10px;
    margin:4px 0 16px;
    animation: rp-fade 0.5s 0.5s both;
  }
  .rp-divider::before,.rp-divider::after {
    content:''; flex:1; height:1px; background:#d1fae5;
  }
  .rp-divider span {
    font-size:11px; font-weight:700;
    color:#a7f3d0; white-space:nowrap; letter-spacing:0.4px;
  }

  /* btn */
  .rp-btn {
    width:100%; margin-top:6px;
    padding:14px;
    font-family:'Nunito',sans-serif;
    font-size:15px; font-weight:900;
    color:#fff;
    background:linear-gradient(135deg,#34d399 0%,#059669 100%);
    border:none; border-radius:14px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:8px;
    box-shadow:0 4px 14px rgba(5,150,105,0.35);
    transition:transform 0.18s,box-shadow 0.18s,opacity 0.18s;
    animation: rp-fade 0.5s 0.62s both;
    position:relative; overflow:hidden;
  }
  .rp-btn::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(135deg,rgba(255,255,255,0.18),transparent);
    border-radius:inherit;
  }
  .rp-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 22px rgba(5,150,105,0.42); }
  .rp-btn:active:not(:disabled) { transform:translateY(0); box-shadow:0 2px 8px rgba(5,150,105,0.25); }
  .rp-btn:disabled { opacity:0.7; cursor:not-allowed; }

  /* spinner */
  .rp-spin {
    width:18px; height:18px;
    border:2.5px solid rgba(255,255,255,0.35);
    border-top-color:#fff; border-radius:50%;
    animation: rp-rotate 0.7s linear infinite;
  }
  @keyframes rp-rotate { to{transform:rotate(360deg)} }

  /* footer */
  .rp-footer {
    margin-top:20px; text-align:center;
    font-size:12px; font-weight:600; color:#a7f3d0;
    animation: rp-fade 0.5s 0.7s both;
  }
  .rp-footer a { color:#34d399; text-decoration:none; font-weight:800; }
  .rp-footer a:hover { text-decoration:underline; }

  /* toast */
  .rp-toast {
    position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
    background:#064e3b; color:#6ee7b7;
    padding:11px 22px; border-radius:100px;
    font-size:13px; font-weight:800;
    box-shadow:0 8px 24px rgba(0,0,0,0.18);
    pointer-events:none; white-space:nowrap; z-index:99;
    animation: rp-toast-in 0.35s cubic-bezier(.22,.68,0,1.2) both;
  }
  .rp-toast.rp-toast-out { animation: rp-toast-out 0.3s ease forwards; }
  @keyframes rp-toast-in  { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  @keyframes rp-toast-out { from{opacity:1;transform:translateX(-50%) translateY(0)} to{opacity:0;transform:translateX(-50%) translateY(12px)} }
`;

const endpoint = `${API_URL}/api/users/register`
/* ─── constants ─────────────────────────────────────────── */
const ROLES = [
    { value: "staff", label: "👷 Nhân viên" },
    { value: "cashier", label: "💰 Thu ngân" },
    { value: "chef", label: "👨‍🍳 Đầu bếp" },
    { value: "manager", label: "📋 Quản lý" },
    { value: "admin", label: "🛡️ Admin" },
];

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function RegisterPage() {
    const accessToken =
        useAuthZustand((state) => state.accessToken);
    const navigate = useNavigate();

    /* ── form state ── */
    const [form, setForm] = useState({
        fullName: "",
        username: "",
        phone: "",
        citizenId: "",
        role: "staff",
    });

    /* ── error state (mirrors form keys) ── */
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);

    /* inject CSS once */
    useEffect(() => {
        const tag = document.createElement("style");
        tag.id = "register-page-style";
        if (!document.getElementById("register-page-style")) {
            tag.textContent = STYLE;
            document.head.appendChild(tag);
        }
        return () => tag.remove();
    }, []);

    /* ── toast helper ── */
    function showToast(msg) {
        clearTimeout(toastTimer.current);
        setToast({ msg, out: false });
        toastTimer.current = setTimeout(() => {
            setToast((t) => (t ? { ...t, out: true } : null));
            setTimeout(() => setToast(null), 350);
        }, 3000);
    }

    /* ── validators ── */
    const validators = {
        fullName: (v) => !v.trim() ? "Vui lòng nhập họ tên" : "",
        phone: (v) => {
            if (!v) return "Vui lòng nhập số điện thoại";
            if (!/^\d+$/.test(v)) return "Chỉ chứa chữ số";
            if (v.length !== 10) return `Cần đủ 10 chữ số (hiện ${v.length})`;
            return "";
        },
        citizenId: (v) => {
            if (!v) return "Vui lòng nhập số CCCD";
            if (!/^\d+$/.test(v)) return "Chỉ chứa chữ số";
            if (v.length !== 12) return `CCCD cần đúng 12 số (hiện ${v.length})`;
            return "";
        },
        username: (v) => {
            if (!v) return ""; // optional
            if (v.length < 3) return "Tối thiểu 3 ký tự";
            if (!/^[a-zA-Z0-9_]+$/.test(v)) return "Chỉ dùng chữ, số, dấu _";
            return "";
        },
        role: () => "",
    };

    function validateAll() {
        const newErrors = {};
        Object.keys(validators).forEach((key) => {
            const err = validators[key](form[key]);
            if (err) newErrors[key] = err;
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    /* ── change handlers ── */
    function handleChange(key, raw) {
        let val = raw;
        if (key === "phone") val = raw.replace(/\D/g, "").slice(0, 10);
        if (key === "citizenId") val = raw.replace(/\D/g, "").slice(0, 12);

        setForm((prev) => ({ ...prev, [key]: val }));

        // live-clear error once user types
        if (errors[key]) {
            const err = validators[key](val);
            setErrors((prev) => ({ ...prev, [key]: err }));
        }
    }

    /* ── submit ── */
    async function handleSubmit(e) {

        e.preventDefault();

        if (loading) return;

        if (!validateAll()) return;

        setLoading(true);

        try {

            const payload = {

                fullName: form.fullName.trim(),

                phone: form.phone,

                citizenId: form.citizenId,

                role: form.role,

            };

            if (form.username.trim()) {

                payload.username =
                    form.username.trim();

            }

            const response = await axios.post(

                `${endpoint}`,

                payload,

                {
                    headers: {

                        Authorization:
                            `Bearer ${accessToken}`,

                        "Content-Type":
                            "application/json",

                    },
                }

            );

            const result = response.data;

            if (!result.success) {

                showToast(
                    "❌ " +
                    (result.message || "Đăng ký thất bại")
                );

                return;

            }

            const defaultPwd =
                result.defaultPassword
                ?? form.citizenId.slice(-6);

            showToast(
                `✅ Tạo tài khoản thành công! Mật khẩu mặc định: ${defaultPwd}`
            );

            // reset form thay vì redirect login
            setForm({

                fullName: "",

                username: "",

                phone: "",

                citizenId: "",

                role: "staff",

            });

            setErrors({});

        } catch (err) {

            const msg =

                err?.response?.data?.message
                || err?.message
                || "Lỗi server";

            showToast("❌ " + msg);

        } finally {

            setLoading(false);

        }
    }

    /* ── field config (renders the list declaratively) ── */
    const fields = [
        {
            key: "fullName",
            label: "Họ và tên",
            required: true,
            icon: <User size={15} strokeWidth={2.5} />,
            type: "text",
            placeholder: "Nguyễn Văn A",
            autoFocus: true,
        },
        {
            key: "phone",
            label: "Số điện thoại",
            required: true,
            icon: <Phone size={15} strokeWidth={2.5} />,
            type: "tel",
            inputMode: "numeric",
            placeholder: "0xxxxxxxxx",
        },
        {
            key: "citizenId",
            label: "Số CCCD",
            required: true,
            icon: <CreditCard size={15} strokeWidth={2.5} />,
            type: "text",
            inputMode: "numeric",
            placeholder: "012345678901",
        },
        {
            key: "username",
            label: "Tên đăng nhập",
            required: false,
            icon: <User size={15} strokeWidth={2.5} />,
            type: "text",
            placeholder: "Không bắt buộc",
        },
    ];

    /* ── render ── */
    return (
        <div className="rp-root">
            {/* background decoration */}
            <div className="rp-dots" />
            <div className="rp-blob rp-blob-1" />
            <div className="rp-blob rp-blob-2" />
            <div className="rp-blob rp-blob-3" />

            <div className="rp-card">
                {/* logo */}
                <div className="rp-logo">
                    <div className="rp-logo-icon">🍜</div>
                    <h1 className="rp-logo-title">NhàHàng Pro</h1>
                    <p className="rp-logo-sub">Tạo tài khoản nhân viên mới</p>
                </div>

                {/* default-password hint */}
                <div className="rp-hint">
                    <CheckCircle2 size={14} />
                    <span>
                        Mật khẩu mặc định sẽ là <strong>6 số cuối CCCD</strong>.
                        Nhân viên cần đổi mật khẩu sau lần đăng nhập đầu tiên.
                    </span>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    {/* text fields */}
                    {fields.map((f) => (
                        <div className="rp-field" key={f.key}>
                            <label className="rp-label">
                                {f.label}
                                {f.required && <span className="rp-required">*</span>}
                            </label>
                            <div className="rp-input-wrap">
                                <span className="rp-input-icon">{f.icon}</span>
                                <input
                                    className={`rp-input${errors[f.key] ? " rp-error" : ""}`}
                                    type={f.type}
                                    inputMode={f.inputMode}
                                    placeholder={f.placeholder}
                                    value={form[f.key]}
                                    onChange={(e) => handleChange(f.key, e.target.value)}
                                    autoComplete="off"
                                    autoFocus={f.autoFocus || false}
                                />
                            </div>
                            {errors[f.key] && (
                                <p className="rp-err-msg" key={errors[f.key]}>
                                    <AlertCircle size={11} />
                                    {errors[f.key]}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* divider */}
                    <div className="rp-divider"><span>PHÂN QUYỀN</span></div>

                    {/* role select */}
                    <div className="rp-field">
                        <label className="rp-label">
                            Vai trò <span className="rp-required">*</span>
                        </label>
                        <div className="rp-input-wrap">
                            <span className="rp-input-icon">
                                <UserCog size={15} strokeWidth={2.5} />
                            </span>
                            <select
                                className="rp-select"
                                value={form.role}
                                onChange={(e) => handleChange("role", e.target.value)}
                            >
                                {ROLES.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* submit */}
                    <button className="rp-btn" type="submit" disabled={loading}>
                        {loading ? (
                            <><div className="rp-spin" /><span>Đang tạo tài khoản…</span></>
                        ) : (
                            <><span>Tạo tài khoản</span><ArrowRight size={16} strokeWidth={2.8} /></>
                        )}
                    </button>
                </form>

                {/* footer */}
                <p className="rp-footer">
                    Đã có tài khoản?{" "}
                    <a href="/login" onClick={(e) => { e.preventDefault(); navigate("/login"); }}>
                        Đăng nhập ngay
                    </a>
                </p>
            </div>

            {/* toast */}
            {toast && (
                <div className={`rp-toast${toast.out ? " rp-toast-out" : ""}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}