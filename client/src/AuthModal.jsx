import { useState } from "react";
import { login, register } from "./api";

export default function AuthModal({ onClose, onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handle = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await login(form.email, form.password);
      } else {
        result = await register(form.username, form.email, form.password);
      }
      if (result.error) { setError(result.error); }
      else { onAuth(result); onClose(); }
    } catch {
      setError("Ошибка соединения с сервером");
    }
    setLoading(false);
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"#0d1117",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:2000, fontFamily:"system-ui,sans-serif"
    }}>
      {/* Фоновые декоративные круги */}
      <div style={{position:"absolute", top:-100, left:-100, width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", pointerEvents:"none"}} />
      <div style={{position:"absolute", bottom:-100, right:-100, width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)", pointerEvents:"none"}} />

      <div style={{width:"100%", maxWidth:420, padding:"0 20px", position:"relative", zIndex:1}}>
        {/* Логотип */}
        <div style={{textAlign:"center", marginBottom:40}}>
          <div style={{
            width:60, height:60, background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            borderRadius:16, display:"inline-flex", alignItems:"center", justifyContent:"center",
            fontSize:28, marginBottom:16, boxShadow:"0 0 40px rgba(99,102,241,0.4)"
          }}>✦</div>
          <div style={{fontSize:28, fontWeight:700, color:"#f9fafb", letterSpacing:"-0.5px"}}>FlyerStudio</div>
          <div style={{fontSize:14, color:"#6b7280", marginTop:6}}>Веб-редактор листовок</div>
        </div>

        {/* Карточка */}
        <div style={{
          background:"#161b22", border:"1px solid #30363d",
          borderRadius:16, padding:32,
          boxShadow:"0 20px 60px rgba(0,0,0,0.5)"
        }}>
          {/* Табы */}
          <div style={{display:"flex", background:"#0d1117", borderRadius:8, padding:4, marginBottom:28}}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                flex:1, padding:"8px 0", border:"none", borderRadius:6, cursor:"pointer",
                fontSize:13, fontWeight:500, transition:"all 0.2s",
                background: mode===m ? "#3b82f6" : "transparent",
                color: mode===m ? "#fff" : "#6b7280",
              }}>
                {m === "login" ? "Войти" : "Регистрация"}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
              borderRadius:8, padding:"10px 14px", fontSize:13, marginBottom:20, color:"#f87171"
            }}>{error}</div>
          )}

          {mode === "register" && (
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12, color:"#9ca3af", display:"block", marginBottom:6}}>Имя пользователя</label>
              <input
                style={{width:"100%", background:"#0d1117", border:"1px solid #30363d", color:"#f9fafb", borderRadius:8, padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none"}}
                value={form.username} onChange={handle("username")} placeholder="username"
              />
            </div>
          )}

          <div style={{marginBottom:16}}>
            <label style={{fontSize:12, color:"#9ca3af", display:"block", marginBottom:6}}>Email</label>
            <input
              style={{width:"100%", background:"#0d1117", border:"1px solid #30363d", color:"#f9fafb", borderRadius:8, padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none"}}
              type="email" value={form.email} onChange={handle("email")} placeholder="email@example.com"
            />
          </div>

          <div style={{marginBottom:24}}>
            <label style={{fontSize:12, color:"#9ca3af", display:"block", marginBottom:6}}>Пароль</label>
            <div style={{position:"relative"}}>
              <input
                style={{width:"100%", background:"#0d1117", border:"1px solid #30363d", color:"#f9fafb", borderRadius:8, padding:"10px 40px 10px 12px", fontSize:13, boxSizing:"border-box", outline:"none"}}
                type={showPass ? "text" : "password"}
                value={form.password} onChange={handle("password")}
                placeholder="••••••••"
                onKeyDown={e => e.key === "Enter" && submit()}
              />
              <button onClick={() => setShowPass(v => !v)} tabIndex={-1} style={{
                position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:15, padding:0
              }}>
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button onClick={submit} disabled={loading} style={{
            width:"100%", background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            border:"none", color:"#fff", borderRadius:8, padding:"12px 0",
            cursor: loading ? "not-allowed" : "pointer", fontSize:14, fontWeight:600,
            opacity: loading ? 0.7 : 1, boxShadow:"0 4px 20px rgba(99,102,241,0.4)"
          }}>
            {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>

          <div onClick={onClose} style={{
            textAlign:"center", marginTop:20, color:"#4b5563",
            cursor:"pointer", fontSize:13,
          }}
            onMouseEnter={e => e.target.style.color="#9ca3af"}
            onMouseLeave={e => e.target.style.color="#4b5563"}
          >
            Продолжить без входа →
          </div>
        </div>

        <div style={{textAlign:"center", marginTop:24, fontSize:12, color:"#374151"}}>
          FlyerStudio
        </div>
      </div>
    </div>
  );
}