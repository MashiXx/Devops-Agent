import { useState, useRef, useEffect, useCallback } from "react";
import api from "./api";

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:         "#07080f",
    bgAlt:      "#0b0d17",
    bgDeep:     "#090b14",
    bgCard:     "#0d1020",
    bgInput:    "#07080f",
    bgOverlay:  "#000000bb",
    bgModal:    "#0d1020",
    border:     "#1a1f35",
    borderLight:"#1e2a40",
    borderInput:"#1e3a5f",
    text:       "#e2e8f0",
    textMuted:  "#94a3b8",
    textDim:    "#64748b",
    textDimmer: "#475569",
    textFaint:  "#334155",
    textGhost:  "#1e2a40",
    textRule:   "#1a2535",
    accent:     "#22d3ee",
    accentDark: "#0c2233",
    accentBorder:"#0e7490",
    analysis:   "#0a1220",
    analysisBorder:"#162032",
    analysisText:"#7090b0",
    successBg:  "#061a10",
    successBorder:"#145228",
    codeBg:     "#050710",
    scrollTrack:"#0d0f1a",
    scrollThumb:"#1e2740",
    // env badge colors stay the same in both modes
  },
  light: {
    bg:         "#f8fafc",
    bgAlt:      "#f1f5f9",
    bgDeep:     "#e2e8f0",
    bgCard:     "#ffffff",
    bgInput:    "#ffffff",
    bgOverlay:  "#00000066",
    bgModal:    "#ffffff",
    border:     "#cbd5e1",
    borderLight:"#e2e8f0",
    borderInput:"#94a3b8",
    text:       "#0f172a",
    textMuted:  "#334155",
    textDim:    "#475569",
    textDimmer: "#64748b",
    textFaint:  "#94a3b8",
    textGhost:  "#cbd5e1",
    textRule:   "#cbd5e1",
    accent:     "#0891b2",
    accentDark: "#e0f2fe",
    accentBorder:"#0e7490",
    analysis:   "#f0f9ff",
    analysisBorder:"#bae6fd",
    analysisText:"#0c4a6e",
    successBg:  "#f0fdf4",
    successBorder:"#86efac",
    codeBg:     "#f1f5f9",
    scrollTrack:"#f1f5f9",
    scrollThumb:"#cbd5e1",
  },
};

// ─── PRESETS ─────────────────────────────────────────────────────────────────
const PRESETS = [
  { label: "System Health",    icon: "💻", task: "Check server health: uptime, memory usage, disk space" },
  { label: "Docker Status",    icon: "🐳", task: "Show all running Docker containers and their resource usage" },
  { label: "App Logs",         icon: "📋", task: "Tail the last 50 lines of application logs and check for errors" },
  { label: "Kubernetes",       icon: "☸️",  task: "Check all Kubernetes pod and node status across all namespaces" },
  { label: "Network",          icon: "🌐", task: "Show all open ports and active network connections" },
  { label: "Deploy Check",     icon: "🚀", task: "Check git status and verify nginx + app services are running" },
  { label: "DB Health",        icon: "🗄️", task: "Check PostgreSQL and Redis connectivity and performance" },
  { label: "Security",         icon: "🔒", task: "Check failed SSH logins, running processes, and open ports" },
  { label: "CPU/Load",         icon: "📊", task: "Show top CPU processes and system load average" },
  { label: "Cron Jobs",        icon: "⏰", task: "List all cron jobs and check recent cron execution logs" },
];

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
const Spinner = () => (
  <span style={{ display: "inline-block", animation: "spin 0.7s linear infinite" }}>⟳</span>
);

const Dot = ({ color, pulse }) => (
  <span style={{
    display: "inline-block", width: 7, height: 7, borderRadius: "50%",
    background: color, flexShrink: 0,
    animation: pulse ? "pulse 1.5s infinite" : "none",
    boxShadow: pulse ? `0 0 6px ${color}` : "none",
  }} />
);

const envStyleDark = (e) =>
  e === "production"
    ? { bg: "#2a0808", fg: "#fca5a5", border: "#7f1d1d" }
    : e === "staging"
    ? { bg: "#072010", fg: "#86efac", border: "#166534" }
    : { bg: "#080f2a", fg: "#93c5fd", border: "#1e3a8a" };

const envStyleLight = (e) =>
  e === "production"
    ? { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5" }
    : e === "staging"
    ? { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" }
    : { bg: "#eff6ff", fg: "#1d4ed8", border: "#93c5fd" };

const statusColor = (s) =>
  s === "online" ? "#22c55e" : s === "error" ? "#ef4444" : s === "configured" ? "#f59e0b" : "#475569";

// ─── ADD/EDIT SERVER MODAL ────────────────────────────────────────────────────
function ServerModal({ initial, onSave, onTest, onClose, t }) {
  const [form, setForm] = useState(
    initial || { name: "", host: "", port: "22", user: "ubuntu", env: "production", authType: "password", password: "", privateKey: "", passphrase: "" }
  );
  const [testResult, setTestResult] = useState(null); // null | { ok, message }
  const [testing, setTesting] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await onTest(form);
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    }
    setTesting(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: t.bgOverlay, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.bgModal, border: `1px solid ${t.borderLight}`, borderRadius: 10, padding: 24, width: 380, fontFamily: "inherit" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 18 }}>
          {initial ? "Edit Server" : "Add SSH Server"}
        </div>

        {/* Basic fields */}
        {[["name","Name (label)","my-server"],["host","Host / IP","10.0.0.1"],["port","SSH Port","22"],["user","SSH User","ubuntu"]].map(([k,l,ph]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: t.textDimmer, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
            <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: 5, color: t.text, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        ))}

        {/* Env */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: t.textDimmer, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Environment</div>
          <select value={form.env} onChange={e => set("env", e.target.value)}
            style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: 5, color: t.text, padding: "7px 10px", fontSize: 12, fontFamily: "inherit" }}>
            <option value="production">production</option>
            <option value="staging">staging</option>
            <option value="dev">dev</option>
          </select>
        </div>

        {/* Auth type */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: t.textDimmer, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Authentication</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["password", "key"].map(tp => (
              <button key={tp} onClick={() => set("authType", tp)}
                style={{ flex: 1, padding: "7px", borderRadius: 5, border: `1px solid ${form.authType === tp ? t.accentBorder : t.borderLight}`, background: form.authType === tp ? t.accentDark : "transparent", color: form.authType === tp ? t.accent : t.textDimmer, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
                {tp === "password" ? "🔑 Password" : "📄 Private Key"}
              </button>
            ))}
          </div>
        </div>

        {form.authType === "password" ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: t.textDimmer, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Password</div>
            <input type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="SSH password"
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: 5, color: t.text, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: t.textDimmer, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Private Key Path or PEM Content</div>
            <textarea value={form.privateKey} onChange={e => set("privateKey", e.target.value)}
              placeholder="~/.ssh/id_rsa  OR paste raw PEM"
              rows={3}
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: 5, color: t.text, padding: "7px 10px", fontSize: 11, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
            <input value={form.passphrase} onChange={e => set("passphrase", e.target.value)} placeholder="Passphrase (if any)"
              type="password"
              style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: 5, color: t.text, padding: "7px 10px", fontSize: 12, fontFamily: "inherit", marginTop: 6, boxSizing: "border-box" }} />
          </div>
        )}

        {/* Test Connection */}
        <div style={{ marginBottom: 14 }}>
          <button onClick={handleTest} disabled={testing || !form.host || !form.user}
            style={{ width: "100%", padding: "8px", borderRadius: 5, border: `1px solid ${t.borderLight}`, background: "transparent", color: t.textMuted, fontSize: 11, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: (!form.host || !form.user) ? 0.4 : 1 }}>
            {testing ? <><Spinner /> Testing...</> : "⟳ Test Connection"}
          </button>
          {testResult && (
            <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 5, fontSize: 11, lineHeight: 1.5, border: `1px solid ${testResult.ok ? "#145228" : "#7f1d1d"}`, background: testResult.ok ? "#061a10" : "#2a0808", color: testResult.ok ? "#6ee7b7" : "#fca5a5" }}>
              {testResult.ok ? "✓ " : "✗ "}{testResult.message}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "transparent", border: `1px solid ${t.borderLight}`, borderRadius: 5, color: t.textDim, padding: "9px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={() => onSave(form)}
            style={{ flex: 2, background: t.accentDark, border: `1px solid ${t.accentBorder}`, borderRadius: 5, color: t.accent, padding: "9px", fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            {initial ? "Save Changes" : "Connect Server"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [servers,       setServers]       = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [sessions,      setSessions]      = useState({});   // { serverId: [entry] }
  const [task,          setTask]          = useState("");
  const [mode,          setMode]          = useState("ai"); // "ai" | "direct"
  const [running,       setRunning]       = useState(false);
  const [backendOk,     setBackendOk]     = useState(null); // null=checking, true, false
  const [modal,         setModal]         = useState(null); // null | "add" | { server }
  const [testingId,     setTestingId]     = useState(null);
  const [theme,         setTheme]         = useState(() => localStorage.getItem("theme") || "dark");
  const termRef  = useRef(null);
  const inputRef = useRef(null);

  const t = THEMES[theme];
  const envStyle = theme === "dark" ? envStyleDark : envStyleLight;
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  const selected = servers.find(s => s.id === activeId) || servers[0];
  const history  = sessions[selected?.id] || [];

  // ── Boot: check backend + load servers ──────────────────────────────────────
  useEffect(() => {
    api.health()
      .then(() => { setBackendOk(true); return api.getServers(); })
      .then(list => {
        setServers(list);
        if (list.length) setActiveId(list[0].id);
      })
      .catch(() => setBackendOk(false));
  }, []);

  // ── Auto-scroll terminal ─────────────────────────────────────────────────────
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [sessions, activeId]);

  // ── Session helpers ──────────────────────────────────────────────────────────
  const addEntry = (sid, entry) =>
    setSessions(s => ({ ...s, [sid]: [...(s[sid] || []), entry] }));

  const patchEntry = (sid, id, patch) =>
    setSessions(s => ({
      ...s,
      [sid]: (s[sid] || []).map(e => e.id === id ? { ...e, ...patch } : e),
    }));

  // ── Run task ─────────────────────────────────────────────────────────────────
  const runTask = useCallback(async (taskText) => {
    const t = (taskText || task).trim();
    if (!t || running || !selected) return;
    setRunning(true);
    setTask("");
    setTimeout(() => inputRef.current?.focus(), 50);

    const srv = selected;
    const eid = Date.now();

    if (mode === "direct") {
      // ── Direct mode: run command as-is via SSH ──
      const baseEntry = {
        id: eid, task: t, server: srv,
        ts: new Date().toLocaleTimeString("vi-VN"),
        status: "executing", analysis: "", commands: [{ cmd: t, purpose: "direct" }], results: [], warnings: [], summary: "",
      };
      addEntry(srv.id, baseEntry);

      try {
        const res = await api.execSSH(srv.id, t, 30000);
        const ok = res.ok && res.exitCode === 0;
        const results = [{ cmd: t, purpose: "direct", output: res.output || res.error || "", ok }];
        patchEntry(srv.id, eid, { status: "done", results });
      } catch (err) {
        patchEntry(srv.id, eid, { status: "error", analysis: `❌ ${err.message}` });
      }
    } else {
      // ── AI mode: Claude plans then execute ──
      const baseEntry = {
        id: eid, task: t, server: srv,
        ts: new Date().toLocaleTimeString("vi-VN"),
        status: "thinking", analysis: "", commands: [], results: [], warnings: [], summary: "",
      };
      addEntry(srv.id, baseEntry);

      try {
        const plan = await api.claudePlan(t, srv, sessions[srv.id] || []);
        if (plan.error) throw new Error(plan.error);

        patchEntry(srv.id, eid, {
          status: "executing",
          analysis:  plan.analysis  || "",
          commands:  plan.commands  || [],
          warnings:  plan.warnings  || [],
          summary:   plan.summary   || "",
        });

        const results = [];
        for (const cmdObj of (plan.commands || [])) {
          const res = await api.execSSH(srv.id, cmdObj.cmd, 30000);
          const ok  = res.ok && res.exitCode === 0;
          results.push({ ...cmdObj, output: res.output || res.error || "", ok });
          patchEntry(srv.id, eid, { results: [...results] });
        }

        patchEntry(srv.id, eid, { status: "done", results });
      } catch (err) {
        patchEntry(srv.id, eid, { status: "error", analysis: `❌ ${err.message}` });
      }
    }

    setRunning(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [task, running, selected, sessions, mode]);

  // ── SSH test ─────────────────────────────────────────────────────────────────
  const testServer = async (srv) => {
    setTestingId(srv.id);
    try {
      const res = await api.testSSH(srv.id);
      setServers(list => list.map(s => s.id === srv.id
        ? { ...s, status: res.ok ? "online" : "error" } : s));
    } catch {
      setServers(list => list.map(s => s.id === srv.id ? { ...s, status: "error" } : s));
    }
    setTestingId(null);
  };

  // ── Add server ───────────────────────────────────────────────────────────────
  const handleAddServer = async (form) => {
    const res = await api.addServer(form);
    const fresh = await api.getServers();
    setServers(fresh);
    setActiveId(res.id || fresh[fresh.length - 1]?.id);
    setModal(null);
  };

  // ── Edit server ────────────────────────────────────────────────────────────────
  const handleEditServer = async (form) => {
    await api.updateServer(form.id, form);
    const fresh = await api.getServers();
    setServers(fresh);
    setModal(null);
  };

  // ── Test connection from modal (saves first if editing, then tests) ─────────
  const handleTestFromModal = async (form) => {
    // If editing existing server, save credentials first so backend can use them
    if (form.id) {
      await api.updateServer(form.id, form);
      const res = await api.testSSH(form.id);
      const fresh = await api.getServers();
      setServers(fresh.map(s => s.id === form.id ? { ...s, status: res.ok ? "online" : "error" } : s));
      return { ok: res.ok, message: res.ok ? `Connected! ${res.output || ""}`.trim() : (res.error || "Connection failed") };
    }
    // For new server: add temporarily, test, then keep
    const added = await api.addServer(form);
    const sid = added.id;
    const res = await api.testSSH(sid);
    const fresh = await api.getServers();
    setServers(fresh.map(s => s.id === sid ? { ...s, status: res.ok ? "online" : "error" } : s));
    setActiveId(sid);
    return { ok: res.ok, message: res.ok ? `Connected! ${res.output || ""}`.trim() : (res.error || "Connection failed") };
  };

  // ── Delete server ─────────────────────────────────────────────────────────────
  const handleDeleteServer = async (id) => {
    await api.deleteServer(id);
    const fresh = await api.getServers();
    setServers(fresh);
    if (activeId === id) setActiveId(fresh[0]?.id || null);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", background: t.bg, height: "100vh", color: t.textMuted, display: "flex", flexDirection: "column", fontSize: 13, overflow: "hidden", transition: "background .3s, color .3s" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: ${t.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 2px; }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.25} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }
        .fade-in { animation: fadeSlide .2s ease; }
        textarea:focus, input:focus, select:focus { outline: none; }
        button { font-family: inherit; cursor: pointer; border: none; }
        .hover-dim:hover { opacity: .7; }
        .run-btn:hover:not(:disabled) { background: ${t.accent} !important; color: ${t.bg} !important; }
        .preset-btn:hover { background: ${theme === "dark" ? "#0f1a2e" : "#e2e8f0"} !important; border-color: ${theme === "dark" ? "#1e3a5f" : "#94a3b8"} !important; }
        .srv-tab:hover { background: ${theme === "dark" ? "#0c1020" : "#e2e8f0"} !important; }
        .theme-toggle:hover { background: ${theme === "dark" ? "#1e2a40" : "#cbd5e1"} !important; }
      `}</style>

      {/* ── MODALS ── */}
      {modal === "add" && <ServerModal onSave={handleAddServer} onTest={handleTestFromModal} onClose={() => setModal(null)} t={t} />}
      {modal && modal !== "add" && modal.id && <ServerModal initial={modal} onSave={handleEditServer} onTest={handleTestFromModal} onClose={() => setModal(null)} t={t} />}

      {/* ── BACKEND OFFLINE BANNER ── */}
      {backendOk === false && (
        <div style={{ background: theme === "dark" ? "#3b0a0a" : "#fef2f2", borderBottom: `1px solid ${theme === "dark" ? "#7f1d1d" : "#fca5a5"}`, padding: "10px 20px", fontSize: 12, color: theme === "dark" ? "#fca5a5" : "#b91c1c", display: "flex", gap: 12, alignItems: "center" }}>
          <span>⚠️</span>
          <span><b>Backend offline.</b> Chạy backend trước: <code style={{ background: theme === "dark" ? "#500" : "#fee2e2", padding: "1px 6px", borderRadius: 3 }}>cd backend && npm install && cp .env.example .env && node server.js</code></span>
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{ background: t.bgAlt, borderBottom: `1px solid ${t.border}`, padding: "0 16px", height: 48, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#0ea5e9,#22d3ee)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            ⚡
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: t.text, letterSpacing: ".03em" }}>AI DevOps Agent</div>
            <div style={{ fontSize: 9, color: t.textFaint, letterSpacing: ".09em" }}>CLAUDE · SSH · REAL</div>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: t.border }} />

        {/* Server tabs */}
        <div style={{ display: "flex", gap: 4, flex: 1, overflowX: "auto" }}>
          {servers.map(s => {
            const ec = envStyle(s.env);
            const isActive = selected?.id === s.id;
            return (
              <div key={s.id} className="srv-tab" onClick={() => setActiveId(s.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 5, border: `1px solid ${isActive ? t.accent : t.border}`, background: isActive ? t.accentDark : "transparent", color: isActive ? t.accent : t.textDim, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11, flexShrink: 0 }}>
                <Dot color={statusColor(s.status)} pulse={s.status === "online"} />
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{s.name}</span>
                <span style={{ background: ec.bg, color: ec.fg, border: `1px solid ${ec.border}`, borderRadius: 3, padding: "0 4px", fontSize: 9, fontWeight: 700 }}>{s.env.slice(0,4).toUpperCase()}</span>
                {/* Edit / Test / delete */}
                <button onClick={e => { e.stopPropagation(); setModal({ ...s }); }} className="hover-dim"
                  style={{ background: "none", color: t.textFaint, fontSize: 10, padding: "1px 3px", borderRadius: 3, marginLeft: 2 }}
                  title="Edit server">
                  ✎
                </button>
                <button onClick={e => { e.stopPropagation(); testServer(s); }} className="hover-dim"
                  style={{ background: "none", color: t.textFaint, fontSize: 10, padding: "1px 3px", borderRadius: 3 }}
                  title="Test SSH connection">
                  {testingId === s.id ? <Spinner /> : "⟳"}
                </button>
                <button onClick={e => { e.stopPropagation(); handleDeleteServer(s.id); }} className="hover-dim"
                  style={{ background: "none", color: t.textFaint, fontSize: 10, padding: "1px 3px", borderRadius: 3 }}
                  title="Remove server">
                  ✕
                </button>
              </div>
            );
          })}
          <button onClick={() => setModal("add")}
            style={{ padding: "4px 10px", borderRadius: 5, border: `1px dashed ${t.border}`, background: "transparent", color: t.textFaint, fontSize: 11 }}>
            + Add Server
          </button>
        </div>

        {/* Right status + theme toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {running && <span style={{ fontSize: 10, color: "#f59e0b", animation: "pulse 1s infinite" }}>● RUNNING</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
            <Dot color={backendOk ? "#22c55e" : "#ef4444"} />
            <span style={{ color: t.textFaint }}>backend</span>
          </div>
          <button onClick={toggleTheme} className="theme-toggle"
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 13, color: t.textDim, display: "flex", alignItems: "center", gap: 4, transition: "all .2s" }}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? "☀️" : "🌙"}
            <span style={{ fontSize: 9, fontWeight: 600 }}>{theme === "dark" ? "LIGHT" : "DARK"}</span>
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ width: 196, background: t.bgDeep, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "10px 10px 6px", fontSize: 9, fontWeight: 700, color: t.textGhost, letterSpacing: ".12em" }}>QUICK TASKS</div>
          <div style={{ overflowY: "auto", flex: 1, padding: "0 6px 6px" }}>
            {PRESETS.map((p, i) => (
              <button key={i} className="preset-btn" onClick={() => runTask(p.task)} disabled={running || !selected || backendOk === false}
                style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 7, padding: "7px 8px", borderRadius: 5, border: "1px solid transparent", background: "transparent", color: t.textDim, textAlign: "left", marginBottom: 2, fontSize: 11, lineHeight: 1.35, transition: "all .15s", opacity: (running || backendOk === false) ? .4 : 1 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{p.icon}</span>
                <div>
                  <div style={{ color: t.textMuted, fontWeight: 600, fontSize: 11 }}>{p.label}</div>
                  <div style={{ fontSize: 9, color: t.textFaint, marginTop: 1, lineHeight: 1.4 }}>{p.task.slice(0, 44)}…</div>
                </div>
              </button>
            ))}
          </div>

          {/* Active server info */}
          {selected && (
            <div style={{ padding: "10px 12px", borderTop: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 9, color: t.textGhost, marginBottom: 5, letterSpacing: ".08em" }}>CONNECTED TO</div>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{selected.name}</div>
              <div style={{ fontSize: 10, color: t.textFaint, marginTop: 1 }}>{selected.user}@{selected.host}:{selected.port}</div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <Dot color={statusColor(selected.status)} />
                <span style={{ fontSize: 10, color: t.textFaint }}>{selected.status}</span>
              </div>
            </div>
          )}
        </aside>

        {/* ── TERMINAL ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* macOS traffic lights bar */}
          <div style={{ background: t.bgAlt, borderBottom: `1px solid ${t.border}`, padding: "6px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 5 }}>
              {["#ef4444","#f59e0b","#22c55e"].map((c,i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: t.textGhost }}>
              {selected ? `${selected.user}@${selected.name} — ${selected.host}:${selected.port} — SSH` : "No server selected"}
            </div>
            <button onClick={() => setSessions(s => ({ ...s, [selected?.id]: [] }))}
              style={{ background: "none", color: t.textFaint, fontSize: 11, padding: "2px 8px", borderRadius: 3 }}>
              clear
            </button>
          </div>

          {/* Output */}
          <div ref={termRef} style={{ flex: 1, overflowY: "auto", padding: "14px 18px", background: t.bg }}>
            {/* Welcome */}
            {history.length === 0 && selected && (
              <div style={{ color: t.textRule, lineHeight: 2, fontSize: 12 }}>
                <div style={{ color: t.accent, marginBottom: 6 }}>AI DevOps Agent v2.0 — Ready</div>
                <div>SSH target: <span style={{ color: "#6ee7b7" }}>{selected.user}@{selected.host}:{selected.port}</span></div>
                <div>Environment: <span style={{ color: selected.env === "production" ? "#fca5a5" : "#86efac" }}>{selected.env}</span></div>
                <div>Auth: <span style={{ color: t.textMuted }}>{selected.authType || "password"}</span></div>
                <div style={{ marginTop: 10, color: t.textGhost }}>────────────────────────────────</div>
                <div style={{ marginTop: 6 }}>
                  {selected.status !== "online"
                    ? <span style={{ color: "#f59e0b" }}>⚠ Test SSH connection first (click ⟳ on server tab)</span>
                    : <span style={{ color: "#22c55e" }}>✓ SSH connected — type a task or pick Quick Task</span>}
                </div>
              </div>
            )}

            {!selected && (
              <div style={{ color: t.textRule, fontSize: 12, marginTop: 20 }}>
                <div style={{ color: "#f59e0b" }}>No servers configured.</div>
                <div style={{ marginTop: 6 }}>Click <b style={{ color: t.accent }}>+ Add Server</b> in the header to connect your first SSH server.</div>
              </div>
            )}

            {/* Task entries */}
            {history.map(entry => (
              <div key={entry.id} className="fade-in" style={{ marginBottom: 20 }}>
                {/* Prompt line */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ color: t.accent, flexShrink: 0 }}>❯</span>
                  <span style={{ color: t.text, flex: 1, lineHeight: 1.5, wordBreak: "break-word" }}>{entry.task}</span>
                  <span style={{ color: t.textGhost, fontSize: 10, flexShrink: 0 }}>{entry.ts}</span>
                </div>

                {/* Status */}
                <div style={{ paddingLeft: 16, marginBottom: 8, fontSize: 11, height: 18 }}>
                  {entry.status === "thinking"  && <span style={{ color: "#f59e0b" }}><Spinner /> AI đang phân tích…</span>}
                  {entry.status === "executing" && <span style={{ color: "#0ea5e9" }}><Spinner /> Đang thực thi trên {entry.server?.name}…</span>}
                  {entry.status === "done"      && <span style={{ color: "#22c55e" }}>✓ Hoàn thành — {entry.results?.filter(r=>r.ok).length}/{entry.commands?.length} lệnh OK</span>}
                  {entry.status === "error"     && <span style={{ color: "#ef4444" }}>✗ Lỗi</span>}
                </div>

                {/* AI analysis */}
                {entry.analysis && (
                  <div style={{ marginLeft: 16, marginBottom: 10, background: t.analysis, border: `1px solid ${t.analysisBorder}`, borderLeft: "3px solid #0ea5e9", borderRadius: "0 5px 5px 0", padding: "8px 12px" }}>
                    <div style={{ fontSize: 9, color: "#0ea5e9", fontWeight: 700, letterSpacing: ".1em", marginBottom: 5 }}>◈ AI ANALYSIS</div>
                    <div style={{ color: t.analysisText, fontSize: 11, lineHeight: 1.7 }}>{entry.analysis}</div>
                    {entry.warnings?.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {entry.warnings.map((w, i) => (
                          <span key={i} style={{ background: theme === "dark" ? "#1c1000" : "#fefce8", border: `1px solid ${theme === "dark" ? "#7c5300" : "#fbbf24"}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "#fbbf24" }}>⚠ {w}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Commands + output */}
                {entry.commands.map((cmd, ci) => {
                  const res = entry.results[ci];
                  const live = entry.status === "executing" && ci === entry.results.length;
                  return (
                    <div key={ci} style={{ marginLeft: 16, marginBottom: 6 }}>
                      {/* Command bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: t.bgCard, borderRadius: res ? "5px 5px 0 0" : "5px", border: `1px solid ${res ? (res.ok ? (theme === "dark" ? "#0f3020" : "#86efac") : (theme === "dark" ? "#2a0f10" : "#fca5a5")) : t.borderLight}`, borderBottom: res ? "none" : undefined }}>
                        <span style={{ color: t.textGhost, fontSize: 10, width: 18, textAlign: "right", flexShrink: 0 }}>{ci+1}</span>
                        <span style={{ color: t.textDimmer }}>$</span>
                        <span style={{ color: theme === "dark" ? "#93c5fd" : "#1d4ed8", flex: 1, fontWeight: 500, wordBreak: "break-all" }}>{cmd.cmd}</span>
                        {cmd.purpose && <span style={{ color: t.textGhost, fontSize: 10, flexShrink: 0, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{cmd.purpose}</span>}
                        {live && <span style={{ color: "#f59e0b", fontSize: 11, flexShrink: 0 }}><Spinner /></span>}
                        {res  && <span style={{ color: res.ok ? "#22c55e" : "#ef4444", fontSize: 10, flexShrink: 0, fontWeight: 700 }}>{res.ok ? "✓ exit 0" : "✗ exit 1"}</span>}
                      </div>
                      {/* Output */}
                      {res && (
                        <pre style={{ margin: 0, padding: "8px 10px 8px 38px", background: t.codeBg, border: `1px solid ${res.ok ? (theme === "dark" ? "#0f3020" : "#86efac") : (theme === "dark" ? "#2a0f10" : "#fca5a5")}`, borderTop: "none", borderRadius: "0 0 5px 5px", fontSize: 11, color: res.ok ? (theme === "dark" ? "#7fb59a" : "#15803d") : "#f87171", lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200 }}>
                          {res.output}
                        </pre>
                      )}
                    </div>
                  );
                })}

                {/* Summary */}
                {entry.status === "done" && entry.summary && (
                  <div style={{ marginLeft: 16, marginTop: 6, display: "flex", gap: 8, padding: "7px 12px", background: t.successBg, border: `1px solid ${t.successBorder}`, borderRadius: 5 }}>
                    <span style={{ color: "#22c55e" }}>✓</span>
                    <span style={{ color: theme === "dark" ? "#6ee7b7" : "#15803d", fontSize: 11 }}>{entry.summary}</span>
                  </div>
                )}

                <div style={{ borderBottom: `1px solid ${t.bgCard}`, marginTop: 12 }} />
              </div>
            ))}

            {/* Blinking cursor */}
            {!running && (
              <div style={{ display: "flex", gap: 8, color: t.textGhost, fontSize: 12, alignItems: "center" }}>
                <span style={{ color: t.accent }}>❯</span>
                <span style={{ animation: "blink 1.2s infinite" }}>█</span>
              </div>
            )}
          </div>

          {/* ── INPUT ── */}
          <div style={{ background: t.bgAlt, borderTop: `1px solid ${t.border}`, padding: "10px 14px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              {/* Mode toggle */}
              <button
                onClick={() => setMode(m => m === "ai" ? "direct" : "ai")}
                title={mode === "ai" ? "Switch to Direct SSH mode" : "Switch to AI mode"}
                style={{ padding: "9px 10px", borderRadius: 6, border: `1px solid ${mode === "direct" ? "#f59e0b" : t.accentBorder}`, background: mode === "direct" ? (theme === "dark" ? "#1c1000" : "#fefce8") : t.accentDark, color: mode === "direct" ? "#f59e0b" : t.accent, fontSize: 11, flexShrink: 0, transition: "all .15s", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", minWidth: 36, textAlign: "center" }}>
                {mode === "ai" ? "AI" : "$_"}
              </button>
              <div style={{ flex: 1, background: t.bgInput, border: `1px solid ${mode === "direct" ? "#f59e0b44" : t.borderInput}`, borderRadius: 6, padding: "9px 12px", display: "flex", gap: 7, alignItems: "flex-end", transition: "border-color .15s" }}>
                <span style={{ color: mode === "direct" ? "#f59e0b" : t.accent, fontSize: 14, flexShrink: 0, paddingBottom: 1 }}>{mode === "direct" ? "$" : "❯"}</span>
                <textarea
                  ref={inputRef}
                  value={task}
                  onChange={e => setTask(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runTask(); } }}
                  disabled={running || !selected || backendOk === false}
                  placeholder={
                    backendOk === false ? "Backend offline — start server first…"
                    : !selected        ? "Add a server first…"
                    : mode === "direct"
                    ? `Nhập lệnh SSH cho ${selected?.name}…  (Enter ↵ chạy)`
                    : `Mô tả task cho ${selected?.name}…  (Enter ↵ chạy, Shift+Enter xuống dòng)`
                  }
                  rows={1}
                  style={{ flex: 1, background: "transparent", border: "none", color: t.text, fontSize: 12, resize: "none", lineHeight: 1.5, maxHeight: 90, overflow: "auto" }}
                />
              </div>
              <button
                onClick={() => runTask()}
                disabled={running || !task.trim() || !selected || backendOk === false}
                className="run-btn"
                style={{ padding: "9px 16px", borderRadius: 6, border: `1px solid ${t.accentBorder}`, background: t.accentDark, color: t.accent, fontSize: 12, display: "flex", alignItems: "center", gap: 6, flexShrink: 0, transition: "all .15s", opacity: (!selected || backendOk === false) ? .4 : 1 }}>
                {running ? <><Spinner /> Đang chạy…</> : "▶ Run"}
              </button>
            </div>
            <div style={{ fontSize: 9, color: t.textRule, marginTop: 5, paddingLeft: 54 }}>
              {mode === "direct"
                ? "DIRECT MODE — Enter↵ chạy lệnh thẳng · Không qua AI · Click [AI] để chuyển về"
                : "AI MODE — Enter↵ run · Shift+Enter newline · AI plans automatically · Click [$_] để chạy lệnh thẳng"}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
