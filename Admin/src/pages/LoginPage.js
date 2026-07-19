// pages/LoginPage.js
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import useAuthZustand from "../zustand/useAuthZustand";

/* ─── tiny CSS-in-JS helper ──────────────────────────────── */
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

  .lp-root {
    min-height: 100vh;
    background: #f0fdf4;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Nunito', sans-serif;
    position: relative;
    overflow: hidden;
  }

  /* ── nền bong bóng ── */
  .lp-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.45;
    pointer-events: none;
    animation: lp-float 8s ease-in-out infinite;
  }
  .lp-blob-1 { width:420px;height:420px;background:#bbf7d0;top:-120px;left:-100px;animation-delay:0s; }
  .lp-blob-2 { width:320px;height:320px;background:#a7f3d0;bottom:-80px;right:-80px;animation-delay:-3s; }
  .lp-blob-3 { width:200px;height:200px;background:#d1fae5;top:40%;left:55%;animation-delay:-6s; }

  @keyframes lp-float {
    0%,100% { transform: translateY(0) scale(1); }
    50%      { transform: translateY(-28px) scale(1.04); }
  }

  /* ── grid dots pattern ── */
  .lp-dots {
    position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(circle, #86efac55 1px, transparent 1px);
    background-size: 28px 28px;
  }

  /* ── card ── */
  .lp-card {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 420px;
    margin: 0 24px;
    background: rgba(255,255,255,0.82);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1.5px solid rgba(187,247,208,0.6);
    border-radius: 28px;
    padding: 40px 36px 36px;
    box-shadow:
      0 4px 6px -1px rgba(16,185,129,0.06),
      0 24px 48px -8px rgba(16,185,129,0.14),
      inset 0 1px 0 rgba(255,255,255,0.9);
    animation: lp-slide-up 0.55s cubic-bezier(.22,.68,0,1.2) both;
  }

  @keyframes lp-slide-up {
    from { opacity:0; transform:translateY(32px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)    scale(1);    }
  }

  /* ── logo ── */
  .lp-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 32px;
    animation: lp-fade 0.6s 0.15s both;
  }
  .lp-logo-icon {
    width: 64px; height: 64px;
    background: linear-gradient(135deg,#34d399,#059669);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px;
    box-shadow: 0 8px 24px rgba(5,150,105,0.3), inset 0 1px 0 rgba(255,255,255,0.25);
    margin-bottom: 14px;
    animation: lp-pop 0.5s 0.25s cubic-bezier(.22,.68,0,1.4) both;
  }
  .lp-logo-title {
    font-size: 22px; font-weight: 900;
    color: #064e3b;
    letter-spacing: -0.5px;
    margin: 0 0 4px;
  }
  .lp-logo-sub {
    font-size: 13px; font-weight: 500;
    color: #6ee7b7;
  }

  @keyframes lp-pop {
    from { opacity:0; transform:scale(0.6) rotate(-8deg); }
    to   { opacity:1; transform:scale(1)   rotate(0);    }
  }
  @keyframes lp-fade {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0);   }
  }

  /* ── field group ── */
  .lp-field {
    margin-bottom: 16px;
    animation: lp-fade 0.5s both;
  }
  .lp-field:nth-child(1) { animation-delay: 0.3s; }
  .lp-field:nth-child(2) { animation-delay: 0.4s; }

  .lp-label {
    display: block;
    font-size: 12px; font-weight: 800;
    color: #065f46;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 7px;
  }

  .lp-input-wrap {
    position: relative;
    display: flex; align-items: center;
  }
  .lp-input-icon {
    position: absolute; left: 14px;
    color: #6ee7b7;
    pointer-events: none;
    transition: color 0.2s;
    display: flex;
  }
  .lp-input {
    width: 100%; box-sizing: border-box;
    padding: 12px 14px 12px 42px;
    font-family: 'Nunito', sans-serif;
    font-size: 15px; font-weight: 600;
    color: #064e3b;
    background: #f0fdf4;
    border: 2px solid #bbf7d0;
    border-radius: 14px;
    outline: none;
    transition: border-color 0.22s, box-shadow 0.22s, background 0.22s;
    appearance: none;
  }
  .lp-input::placeholder { color:#a7f3d0; font-weight:500; }
  .lp-input:focus {
    border-color: #34d399;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(52,211,153,0.15);
  }
  .lp-input.lp-error {
    border-color: #fca5a5;
    background: #fff5f5;
    box-shadow: 0 0 0 4px rgba(252,165,165,0.15);
  }

  /* eye toggle */
  .lp-eye {
    position: absolute; right: 12px;
    background: none; border: none; cursor: pointer;
    color: #a7f3d0; padding: 4px;
    display: flex; align-items: center;
    transition: color 0.2s;
    border-radius: 8px;
  }
  .lp-eye:hover { color: #34d399; }

  /* error msg */
  .lp-err-msg {
    display: flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 700;
    color: #ef4444;
    margin-top: 6px;
    animation: lp-shake 0.35s ease;
  }
  @keyframes lp-shake {
    0%,100% { transform:translateX(0);  }
    25%      { transform:translateX(-5px); }
    75%      { transform:translateX(5px);  }
  }

  /* ── submit ── */
  .lp-btn {
    width: 100%; margin-top: 8px;
    padding: 14px;
    font-family: 'Nunito', sans-serif;
    font-size: 15px; font-weight: 900;
    color: #fff;
    background: linear-gradient(135deg, #34d399 0%, #059669 100%);
    border: none; border-radius: 14px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 4px 14px rgba(5,150,105,0.35);
    transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
    animation: lp-fade 0.5s 0.5s both;
    position: relative; overflow: hidden;
  }
  .lp-btn::after {
    content:'';
    position:absolute; inset:0;
    background: linear-gradient(135deg,rgba(255,255,255,0.18),transparent);
    border-radius:inherit;
  }
  .lp-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(5,150,105,0.42);
  }
  .lp-btn:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(5,150,105,0.25);
  }
  .lp-btn:disabled { opacity:0.7; cursor:not-allowed; }

  /* loading spinner */
  .lp-spin {
    width:18px;height:18px;
    border:2.5px solid rgba(255,255,255,0.35);
    border-top-color:#fff;
    border-radius:50%;
    animation: lp-rotate 0.7s linear infinite;
  }
  @keyframes lp-rotate { to { transform:rotate(360deg); } }

  /* ── footer hint ── */
  .lp-footer {
    margin-top: 22px;
    text-align: center;
    font-size: 12px; font-weight: 600;
    color: #a7f3d0;
    animation: lp-fade 0.5s 0.6s both;
  }
  .lp-footer span { color:#34d399; }

  /* ── toast ── */
  .lp-toast {
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: #064e3b; color:#6ee7b7;
    padding: 11px 22px; border-radius: 100px;
    font-size: 13px; font-weight: 800;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    pointer-events: none; white-space: nowrap;
    animation: lp-toast-in 0.35s cubic-bezier(.22,.68,0,1.2) both;
    z-index: 99;
  }
  .lp-toast.lp-toast-out { animation: lp-toast-out 0.3s ease forwards; }
  @keyframes lp-toast-in  { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  @keyframes lp-toast-out { from{opacity:1;transform:translateX(-50%) translateY(0)} to{opacity:0;transform:translateX(-50%) translateY(12px)} }
`;

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function LoginPage() {

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const {
    login,
  } = useAuthZustand();
  const navigate = useNavigate();

  const [showPwd, setShowPwd] = useState(false);
  const [phoneErr, setPhoneErr] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);   // { msg, out }
  const toastTimer = useRef(null);

  /* inject CSS once */
  useEffect(() => {
    const tag = document.createElement("style");
    tag.id = "login-page-style";
    if (!document.getElementById("login-page-style")) {
      tag.textContent = STYLE;
      document.head.appendChild(tag);
    }
    return () => tag.remove();
  }, []);

  /* ── helpers ── */
  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast({ msg, out: false });
    toastTimer.current = setTimeout(() => {
      setToast((t) => t ? { ...t, out: true } : null);
      setTimeout(() => setToast(null), 350);
    }, 2800);
  }

  function validatePhone(val) {
    if (!val) return "Vui lòng nhập số điện thoại";
    if (!/^\d+$/.test(val)) return "Số điện thoại chỉ chứa chữ số";
    if (val.length !== 10) return `Cần đủ 10 chữ số (hiện ${val.length})`;
    return "";
  }

  function validatePwd(val) {
    if (!val) return "Vui lòng nhập mật khẩu";
    if (val.length < 6) return "Mật khẩu ít nhất 6 ký tự";
    return "";
  }

  /* ── submit ── */
  async function handleSubmit(e) {
    e.preventDefault();
    const pErr = validatePhone(phone);
    const wErr = validatePwd(password);
    setPhoneErr(pErr);
    setPwdErr(wErr);
    if (pErr || wErr) return;

    setLoading(true);
    try {
      const response = await login({ phone, password }); // gọi trực tiếp store, chỉ 1 lần

      if (response.success) {
        showToast("🎉 Đăng nhập thành công!");
        setTimeout(() => navigate("/"), 800);
      } else {
        showToast("❌ " + (response.message || "Sai số điện thoại hoặc mật khẩu"));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Sai số điện thoại hoặc mật khẩu";
      showToast("❌ " + msg);
    } finally {
      setLoading(false);
    }
  }

  /* ── phone: chỉ nhận chữ số, tối đa 10 ── */
  function onPhoneChange(e) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    if (phoneErr) setPhoneErr(validatePhone(val));
  }

  function onPwdChange(e) {
    setPassword(e.target.value);
    if (pwdErr) setPwdErr(validatePwd(e.target.value));
  }

  /* ── render ── */
  return (
    <div className="lp-root">
      {/* background decoration */}
      <div className="lp-dots" />
      <div className="lp-blob lp-blob-1" />
      <div className="lp-blob lp-blob-2" />
      <div className="lp-blob lp-blob-3" />

      {/* card */}
      <div className="lp-card">
        {/* logo */}
        <div className="lp-logo">
          <div className="lp-logo-icon">🍜</div>
          <h1 className="lp-logo-title">NhàHàng Pro</h1>
          <p className="lp-logo-sub">Đăng nhập để tiếp tục</p>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* phone */}
          <div className="lp-field">
            <label className="lp-label">Số điện thoại</label>
            <div className="lp-input-wrap">
              <span className="lp-input-icon">
                <Phone size={16} strokeWidth={2.5} />
              </span>
              <input
                className={`lp-input${phoneErr ? " lp-error" : ""}`}
                type="tel"
                inputMode="numeric"
                placeholder="0xxxxxxxxx"
                value={phone}
                onChange={onPhoneChange}
                autoComplete="tel"
                autoFocus
              />
            </div>
            {phoneErr && (
              <p className="lp-err-msg" key={phoneErr}>
                <AlertCircle size={12} />
                {phoneErr}
              </p>
            )}
          </div>

          {/* password */}
          <div className="lp-field">
            <label className="lp-label">Mật khẩu</label>
            <div className="lp-input-wrap">
              <span className="lp-input-icon">
                <Lock size={16} strokeWidth={2.5} />
              </span>
              <input
                className={`lp-input${pwdErr ? " lp-error" : ""}`}
                type={showPwd ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={onPwdChange}
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="lp-eye"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                aria-label={showPwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPwd
                  ? <EyeOff size={16} strokeWidth={2.2} />
                  : <Eye size={16} strokeWidth={2.2} />}
              </button>
            </div>
            {pwdErr && (
              <p className="lp-err-msg" key={pwdErr}>
                <AlertCircle size={12} />
                {pwdErr}
              </p>
            )}
          </div>

          {/* submit */}
          <button className="lp-btn" type="submit" disabled={loading}>
            {loading
              ? <><div className="lp-spin" /><span>Đang đăng nhập…</span></>
              : <><span>Đăng nhập</span><ArrowRight size={16} strokeWidth={2.8} /></>}
          </button>
        </form>

        {/* footer */}
        <p className="lp-footer">
          Quên mật khẩu? Liên hệ <span>quản trị viên</span> để đặt lại
        </p>
      </div>

      {/* toast */}
      {toast && (
        <div className={`lp-toast${toast.out ? " lp-toast-out" : ""}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}