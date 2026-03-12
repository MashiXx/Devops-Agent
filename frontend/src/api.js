const BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

const api = {
  // Servers
  getServers: () => fetch(`${BASE}/api/servers`).then(r => r.json()),

  addServer: (data) =>
    fetch(`${BASE}/api/servers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  updateServer: (id, data) =>
    fetch(`${BASE}/api/servers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),

  deleteServer: (id) =>
    fetch(`${BASE}/api/servers/${id}`, { method: "DELETE" }).then(r => r.json()),

  // SSH
  testSSH: (serverId) =>
    fetch(`${BASE}/api/ssh/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId }),
    }).then(r => r.json()),

  execSSH: (serverId, command, timeout, persistent = false) =>
    fetch(`${BASE}/api/ssh/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId, command, timeout, persistent }),
    }).then(r => r.json()),

  disconnectSSH: (serverId) =>
    fetch(`${BASE}/api/ssh/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId }),
    }).then(r => r.json()),

  // Claude
  claudePlan: (task, server, history) =>
    fetch(`${BASE}/api/claude/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, server, history }),
    }).then(r => r.json()),

  // Health
  health: () => fetch(`${BASE}/api/health`).then(r => r.json()),
};

export default api;
