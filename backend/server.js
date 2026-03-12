/**
 * AI DevOps Agent — Backend Server
 * Express + ssh2 + Anthropic API proxy
 *
 * Routes:
 *  POST /api/ssh/exec          — run a single command via SSH
 *  POST /api/ssh/test          — test SSH connection
 *  POST /api/claude/plan       — ask Claude to plan commands for a task
 *  GET  /api/servers           — list saved servers (in-memory)
 *  POST /api/servers           — add a server
 *  DELETE /api/servers/:id     — remove a server
 *  GET  /api/health            — health check
 */

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Client } = require("ssh2");
const { v4: uuidv4 } = require("uuid");
const fs       = require("fs");
const path     = require("path");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

// ─── In-memory server store ───────────────────────────────────────────────────
let SERVERS = [
  {
    id: "srv-1",
    name: "My Server",
    host: "your-server.com",
    port: 22,
    user: "ubuntu",
    authType: "password",   // "password" | "key"
    password: "",           // set via UI
    privateKey: "",         // path OR raw PEM
    env: "production",
    status: "unconfigured",
  },
];

// ─── Helper: run one command over SSH, returns Promise<string> ────────────────
function sshExec(serverConfig, command, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output  = "";
    let errOut  = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      conn.end();
      reject(new Error(`Command timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(command, { pty: false }, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          conn.end();
          return reject(err);
        }

        stream.on("data",         (d) => { output += d.toString(); });
        stream.stderr.on("data",  (d) => { errOut += d.toString(); });

        stream.on("close", (code) => {
          clearTimeout(timer);
          conn.end();
          if (timedOut) return;
          // Return combined output; stderr inline for visibility
          const combined = [output, errOut].filter(Boolean).join("\n").trimEnd();
          resolve({ output: combined || "(no output)", exitCode: code });
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // Build connect config
    const connectCfg = {
      host:     serverConfig.host,
      port:     parseInt(serverConfig.port) || 22,
      username: serverConfig.user,
      readyTimeout: 10000,
    };

    if (serverConfig.authType === "key" && serverConfig.privateKey) {
      // Detect raw key vs file path
      if (serverConfig.privateKey.startsWith("-----BEGIN")) {
        connectCfg.privateKey = serverConfig.privateKey;
      } else {
        try {
          connectCfg.privateKey = fs.readFileSync(
            path.resolve(serverConfig.privateKey.replace("~", process.env.HOME || ""))
          );
        } catch (e) {
          return reject(new Error(`Cannot read private key: ${e.message}`));
        }
      }
      if (serverConfig.passphrase) connectCfg.passphrase = serverConfig.passphrase;
    } else {
      connectCfg.password = serverConfig.password || "";
    }

    conn.connect(connectCfg);
  });
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), version: "2.0.0" });
});

// List servers
app.get("/api/servers", (_req, res) => {
  // Never expose passwords/keys to client
  res.json(SERVERS.map(s => ({
    id: s.id, name: s.name, host: s.host, port: s.port,
    user: s.user, env: s.env, authType: s.authType, status: s.status,
  })));
});

// Add server
app.post("/api/servers", (req, res) => {
  const { name, host, port, user, env, authType, password, privateKey, passphrase } = req.body;
  if (!host || !user) return res.status(400).json({ error: "host and user are required" });

  const srv = {
    id: uuidv4(),
    name: name || host,
    host, port: parseInt(port) || 22,
    user, env: env || "production",
    authType: authType || "password",
    password: password || "",
    privateKey: privateKey || "",
    passphrase: passphrase || "",
    status: "configured",
  };
  SERVERS.push(srv);
  res.json({ id: srv.id, message: "Server added" });
});

// Update server credentials (without exposing them back)
app.put("/api/servers/:id", (req, res) => {
  const idx = SERVERS.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  SERVERS[idx] = { ...SERVERS[idx], ...req.body };
  res.json({ ok: true });
});

// Delete server
app.delete("/api/servers/:id", (req, res) => {
  SERVERS = SERVERS.filter(s => s.id !== req.params.id);
  res.json({ ok: true });
});

// Test SSH connection
app.post("/api/ssh/test", async (req, res) => {
  const { serverId } = req.body;
  const srv = SERVERS.find(s => s.id === serverId);
  if (!srv) return res.status(404).json({ error: "Server not found" });

  try {
    const { output } = await sshExec(srv, "echo CONNECTED && uname -a", 8000);
    // Mark online
    const idx = SERVERS.findIndex(s => s.id === serverId);
    if (idx !== -1) SERVERS[idx].status = "online";
    res.json({ ok: true, output });
  } catch (err) {
    const idx = SERVERS.findIndex(s => s.id === serverId);
    if (idx !== -1) SERVERS[idx].status = "error";
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Execute SSH command
app.post("/api/ssh/exec", async (req, res) => {
  const { serverId, command, timeout } = req.body;
  if (!command) return res.status(400).json({ error: "command is required" });

  const srv = SERVERS.find(s => s.id === serverId);
  if (!srv) return res.status(404).json({ error: "Server not found" });

  try {
    const result = await sshExec(srv, command, timeout || 30000);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, output: `Error: ${err.message}` });
  }
});

// Execute SSH command — streaming (SSE) for real-time output
app.get("/api/ssh/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const { serverId, command } = req.query;
  const srv = SERVERS.find(s => s.id === serverId);
  if (!srv) {
    res.write(`data: ${JSON.stringify({ type: "error", text: "Server not found" })}\n\n`);
    return res.end();
  }

  const conn = new Client();
  const send = (type, text) => res.write(`data: ${JSON.stringify({ type, text })}\n\n`);

  conn.on("ready", () => {
    conn.exec(command, { pty: true }, (err, stream) => {
      if (err) { send("error", err.message); conn.end(); return res.end(); }
      stream.on("data", d => send("stdout", d.toString()));
      stream.stderr.on("data", d => send("stderr", d.toString()));
      stream.on("close", code => {
        send("exit", String(code));
        conn.end();
        res.end();
      });
    });
  });

  conn.on("error", err => { send("error", err.message); res.end(); });

  // Build config same as sshExec
  const cfg = {
    host: srv.host, port: srv.port || 22,
    username: srv.user, readyTimeout: 10000,
  };
  if (srv.authType === "key" && srv.privateKey) {
    cfg.privateKey = srv.privateKey.startsWith("-----BEGIN")
      ? srv.privateKey
      : fs.readFileSync(path.resolve(srv.privateKey.replace("~", process.env.HOME || "")));
  } else {
    cfg.password = srv.password;
  }
  conn.connect(cfg);

  req.on("close", () => { try { conn.end(); } catch {} });
});

// ─── Anthropic proxy (keeps API key server-side) ──────────────────────────────
const DEVOPS_SYSTEM = `You are an expert AI DevOps engineer with deep knowledge of Linux, Docker, Kubernetes, Nginx, PostgreSQL, Redis, and CI/CD pipelines.

Given a natural-language task and server context, respond with ONLY a valid JSON object — no markdown, no prose outside JSON.

Schema:
{
  "analysis": "2-3 sentence explanation of what you will do and why",
  "commands": [
    { "cmd": "exact bash command", "purpose": "one-line reason why this command" }
  ],
  "warnings": ["risk or caveat if any"],
  "summary": "one sentence confirming what was done"
}

Rules:
- Produce 1–7 real, executable bash commands in logical order
- Last command should verify/confirm the result
- Use safe, non-destructive defaults
- warnings can be an empty array []
- No placeholders like <YOUR_IP>; use real examples`;

// ─── AI Provider helpers ────────────────────────────────────────────────────

async function callAnthropic(msgs, apiKey) {
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: DEVOPS_SYSTEM,
      messages: msgs,
    }),
  });

  const data = await anthropicRes.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || "{}";
}

async function callGemini(msgs, apiKey) {
  // Convert messages to Gemini format
  const contents = [];

  // Add system instruction as first user message context
  contents.push({
    role: "user",
    parts: [{ text: DEVOPS_SYSTEM + "\n\n" + msgs[0].content }],
  });

  // If there's only the one user message, add a model placeholder to start
  for (let i = 1; i < msgs.length; i++) {
    contents.push({
      role: msgs[i].role === "assistant" ? "model" : "user",
      parts: [{ text: msgs[i].content }],
    });
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 1200,
          temperature: 0.2,
        },
      }),
    }
  );

  const data = await geminiRes.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

function getAIProvider() {
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.startsWith("AIzaSy-xxx")) return { error: "GEMINI_API_KEY not configured in .env" };
    return { provider: "gemini", apiKey: key };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("sk-ant-xxx")) return { error: "ANTHROPIC_API_KEY not configured in .env" };
  return { provider: "anthropic", apiKey: key };
}

app.post("/api/claude/plan", async (req, res) => {
  const ai = getAIProvider();
  if (ai.error) return res.status(500).json({ error: ai.error });

  const { task, server, history = [] } = req.body;
  if (!task) return res.status(400).json({ error: "task is required" });

  // Build conversation for context
  const msgs = [];
  for (const h of history.slice(-4)) {
    msgs.push({ role: "user", content: h.task });
    msgs.push({ role: "assistant", content: JSON.stringify({ analysis: h.analysis, summary: h.summary }) });
  }
  msgs.push({
    role: "user",
    content: `Server: ${server?.name} (${server?.host}:${server?.port}) | OS: Linux | Env: ${server?.env}\nTask: ${task}`,
  });

  try {
    const raw = ai.provider === "gemini"
      ? await callGemini(msgs, ai.apiKey)
      : await callAnthropic(msgs, ai.apiKey);

    let plan;
    try { plan = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
    catch { plan = { analysis: raw, commands: [], warnings: [], summary: "Could not parse response." }; }

    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Static frontend (production build) ──────────────────────────────────────
const FRONTEND_BUILD = path.join(__dirname, "..", "frontend", "build");
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use(express.static(FRONTEND_BUILD));
  app.get("*", (_req, res) => res.sendFile(path.join(FRONTEND_BUILD, "index.html")));
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   AI DevOps Agent — Backend v2.0         ║
║   http://localhost:${PORT}                  ║
╚══════════════════════════════════════════╝

📋 API Endpoints:
   GET  /api/health
   GET  /api/servers
   POST /api/servers
   POST /api/ssh/test
   POST /api/ssh/exec
   POST /api/claude/plan

⚠️  AI Provider: ${(process.env.AI_PROVIDER || "anthropic").toUpperCase()}
   Set AI_PROVIDER=gemini in .env to use Google Gemini
`);
});
