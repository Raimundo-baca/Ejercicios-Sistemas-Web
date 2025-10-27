"use strict";

const http = require("http");
const os = require("os");
const fs = require("fs");

let config = {
  port: 3000,
  intervalSeconds: 5,
  metrics: { cpu: true, memory: true, systemUptime: true, nodeUptime: true }
};

// cargar config básica desde archivo (si existe)
try {
  const raw = fs.readFileSync("./config.json", "utf8");
  const parsed = JSON.parse(raw);
  config = { ...config, ...parsed, metrics: { ...config.metrics, ...(parsed.metrics || {}) } };
} catch (_) { /* usar defaults */ }

// utilidades simples
const ts = () => new Date().toISOString();
const bytes = (n) => {
  const u = ["B","KB","MB","GB","TB"]; let i=0; while (n>=1024 && i<u.length-1){n/=1024;i++;} 
  return `${n.toFixed(2)} ${u[i]}`;
};
const dur = (s) => {
  s = Math.max(0, Math.floor(s));
  const d=Math.floor(s/86400); s%=86400;
  const h=Math.floor(s/3600); s%=3600;
  const m=Math.floor(s/60); const sec=s%60;
  return [d?`${d}d`:null, `${h}h`, `${m}m`, `${sec}s`].filter(Boolean).join(" ");
};

// info de inicio
console.log("== Servidor Node.js ==");
console.log(`Fecha/Hora: ${new Date().toString()}`);
console.log(`Node.js:    ${process.version}`);
console.log(`Plataforma: ${process.platform} ${process.arch}`);
console.log(`Hostname:   ${os.hostname()}`);
console.log(`Cores:      ${os.cpus().length}`);
console.log(`Mem total:  ${bytes(os.totalmem())}`);
console.log("=======================\n");

// CPU sistema (%): snapshot simple
function cpuSnap() {
  const cpus = os.cpus(); let idle=0, total=0;
  for (const c of cpus) {
    const t=c.times; const sum=t.user+t.nice+t.sys+t.idle+t.irq;
    idle += t.idle; total += sum;
  }
  return { idle, total };
}
let prev = cpuSnap();
function cpuPercent() {
  const cur = cpuSnap();
  const idleDiff = cur.idle - prev.idle;
  const totalDiff = cur.total - prev.total;
  prev = cur;
  if (totalDiff <= 0) return 0;
  return (1 - idleDiff / totalDiff) * 100;
}

// bucle periódico
const intervalMs = Math.max(1000, (config.intervalSeconds || 5) * 1000);
setInterval(() => {
  const out = [];
  if (config.metrics.cpu) {
    out.push(`CPU: ${cpuPercent().toFixed(2)}%`);
  }
  if (config.metrics.memory) {
    const total = os.totalmem(), free = os.freemem(), used = total - free;
    out.push(`Mem: ${bytes(used)}/${bytes(total)} (${(used/total*100).toFixed(2)}%)`);
  }
  if (config.metrics.systemUptime) {
    out.push(`Uptime SO: ${dur(os.uptime())}`);
  }
  if (config.metrics.nodeUptime) {
    out.push(`Uptime Node: ${dur(process.uptime())}`);
  }
  console.log(`[${ts()}] ${out.join(" | ")}`);
}, intervalMs);

// servidor HTTP mínimo
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("OK\n");
});

server.listen(config.port, () => {
  console.log(`[${ts()}] Escuchando en http://localhost:${config.port}`);
});

// salida limpia
process.on("SIGINT", () => { server.close(()=>process.exit(0)); });
process.on("SIGTERM", () => { server.close(()=>process.exit(0)); });
