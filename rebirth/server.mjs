import http from "node:http";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { WebSocketServer, WebSocket } from "ws";
import { createMatch, step, INPUT, characters } from "./public/engine.mjs";
import { BUILD_VERSION } from "./public/version.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "public");
const ASSETS = path.resolve(HERE, "../static/assets");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
};
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALL_INPUTS = Object.values(INPUT).reduce((a, b) => a | b, 0);
const PRESS_INPUTS = INPUT.JUMP | INPUT.DASH | INPUT.LIGHT | INPUT.HEAVY | INPUT.SKILL | INPUT.ULT;
const STEP_MS = 1000 / 60;
const gzipAsync = promisify(gzip);
const TEXT_TYPES = new Set([".html", ".css", ".mjs", ".js", ".json", ".svg"]);
const compressedFiles = new Map();

function acceptsGzip(value = "") {
  const encodings = new Map(String(value).toLowerCase().split(",").map(part => {
    const [name, ...params] = part.trim().split(";");
    const quality = params.find(param => param.trim().startsWith("q="));
    return [name.trim(), quality ? Number(quality.trim().slice(2)) : 1];
  }));
  return (encodings.get("gzip") ?? encodings.get("*") ?? 0) > 0;
}

async function compressedFile(actual, etag) {
  const cached = compressedFiles.get(actual);
  if (cached?.etag === etag) return cached.body;
  // Only small text files enter this bounded cache. Revalidation still uses
  // the real file metadata, so a new build cannot serve old module contents.
  const body = readFile(actual).then(bytes => gzipAsync(bytes, { level: 6 }));
  compressedFiles.set(actual, { etag, body });
  if (compressedFiles.size > 32) compressedFiles.delete(compressedFiles.keys().next().value);
  try { return await body; }
  catch (error) { if (compressedFiles.get(actual)?.body === body) compressedFiles.delete(actual); throw error; }
}

function staticError(res, status, message) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(message);
}

/** Only the public bundle and legacy art are exposed, including after URL decoding and symlink resolution. */
async function staticRequest(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    return staticError(res, 405, "Method not allowed");
  }
  let pathname;
  try {
    pathname = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    return staticError(res, 400, "Malformed URL");
  }
  if (
    pathname.includes("\0") ||
    pathname.includes("\\") ||
    pathname.split("/").some((p) => p === ".." || p === ".")
  ) {
    return staticError(res, 403, "Forbidden");
  }
  if (pathname === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    return res.end(
      req.method === "HEAD"
        ? ""
        : JSON.stringify({ ok: true, version: "rebirth", build: BUILD_VERSION,
            fighterCount: Object.keys(characters).length, characters: Object.keys(characters) }),
    );
  }
  if (pathname === "/rebirth") {
    res.writeHead(308, { Location: "/rebirth/" });
    return res.end();
  }
  const isAsset = pathname.startsWith("/assets/");
  const root = isAsset ? ASSETS : PUBLIC;
  let relative = isAsset
    ? pathname.slice(8)
    : pathname.replace(/^\/rebirth\//, "/").slice(1);
  if (!relative) relative = "index.html";
  const candidate = path.resolve(root, relative);
  if (!candidate.startsWith(root + path.sep))
    return staticError(res, 403, "Forbidden");
  try {
    const actual = await realpath(candidate);
    if (!actual.startsWith(root + path.sep))
      return staticError(res, 403, "Forbidden");
    const info = await stat(actual);
    if (!info.isFile()) return staticError(res, 404, "Not found");
    const ext = path.extname(actual).toLowerCase();
    if (!TYPES[ext]) return staticError(res, 404, "Not found");
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = {
      "Content-Type": TYPES[ext],
      "Content-Length": info.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isAsset ? "public, max-age=86400" : "no-cache",
      ETag: etag,
      "Referrer-Policy": "same-origin",
    };
    const compressible = TEXT_TYPES.has(ext) && info.size >= 512 && info.size <= 2 * 1024 * 1024;
    const compressed = compressible && acceptsGzip(req.headers["accept-encoding"]);
    if (compressible) headers.Vary = "Accept-Encoding";
    if (compressed) headers["Content-Encoding"] = "gzip";
    if (req.headers["if-none-match"] === etag) {
      delete headers["Content-Length"];
      res.writeHead(304, headers);
      return res.end();
    }
    if (compressed) {
      const body = await compressedFile(actual, etag);
      headers["Content-Length"] = body.length;
      res.writeHead(200, headers);
      return res.end(req.method === "HEAD" ? undefined : body);
    }
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    const stream = createReadStream(actual);
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    if (!res.headersSent)
      staticError(res, error.code === "ENOENT" ? 404 : 500, "Not found");
    else res.destroy();
  }
}

/** Exported for live integration tests. Options shorten maintenance windows only in tests. */
export function createGameServer({
  disconnectGraceMs = 30_000,
  staleInputMs = 250,
  roomIdleMs = 15 * 60_000,
  maintenanceMs = 1000,
  maxRooms = 128,
  maxConnections = 300,
} = {}) {
  const rooms = new Map();
  const server = http.createServer((req, res) => {
    staticRequest(req, res).catch(() => {
      if (!res.headersSent) staticError(res, 500, "Server error");
      else res.destroy();
    });
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
    perMessageDeflate: false,
  });
  let closed = false;

  function send(ws, packet, encoded) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    // Never let a sleeping/mobile connection accumulate unbounded snapshots.
    if (ws.bufferedAmount > 512 * 1024) {
      ws.terminate();
      return false;
    }
    if (packet.type === "state" && ws.bufferedAmount > 64 * 1024) return false;
    ws.send(encoded ?? JSON.stringify(packet), (error) => {
      if (error) ws.terminate();
    });
    return true;
  }
  const error = (ws, message, fatal = false) =>
    send(ws, { type: "error", message, ...(fatal ? { fatal: true } : {}) });
  const publicPlayers = (room) =>
    room.players.map((p) =>
      p
        ? {
            char: p.char,
            connected: Boolean(p.ws && p.ws.readyState === WebSocket.OPEN),
            ready: p.ready,
            rematch: p.rematch,
          }
        : null,
    );
  const broadcast = (room, packet) => {
    const encoded = JSON.stringify(packet);
    room.players.forEach((p) => p && send(p.ws, packet, encoded));
  };
  const roomPacket = (room) => ({
    type: "room",
    code: room.code,
    players: publicPlayers(room),
    state: room.state,
    paused: room.paused,
  });
  const roomUpdate = (room) => broadcast(room, roomPacket(room));
  const snapshot = (room) =>
    broadcast(room, {
      type: "state",
      state: room.state,
      ack: room.players.map((p) => p?.ack ?? -1),
      inputs: room.players.map((p) => p?.mask ?? 0),
      paused: room.paused,
    });

  function clearInputs(room) {
    for (const p of room.players)
      if (p) {
        p.mask = 0;
        p.pendingMask = 0;
        p.pendingPresses = 0;
        p.pendingSeq = null;
      }
  }
  function destroyRoom(room, message) {
    rooms.delete(room.code);
    for (const p of room.players) {
      if (!p?.ws) continue;
      if (p.ws.room === room) {
        p.ws.room = null;
        p.ws.slot = null;
      }
      if (message) error(p.ws, message, true);
    }
  }
  function newPlayer(ws, char) {
    return {
      char,
      token: randomBytes(24).toString("hex"),
      ws,
      ready: false,
      rematch: false,
      mask: 0,
      pendingMask: 0,
      pendingPresses: 0,
      pendingSeq: null,
      lastSeq: -1,
      ack: -1,
      lastInput: 0,
      disconnectedAt: null,
    };
  }
  function joined(ws, room, slot) {
    ws.room = room;
    ws.slot = slot;
    room.lastActivity = performance.now();
    send(ws, {
      type: "joined",
      code: room.code,
      token: room.players[slot].token,
      slot,
      players: publicPlayers(room),
      state: room.state,
      paused: room.paused,
    });
    roomUpdate(room);
    if (room.state) snapshot(room);
  }
  function startMatch(room) {
    room.state = createMatch({
      chars: room.players.map((p) => p.char),
      bestOf: 3,
      training: false,
      seed: randomBytes(4).readUInt32LE(0) || 1,
    });
    room.paused = false;
    room.lastActivity = performance.now();
    for (const p of room.players) {
      p.rematch = false;
      p.mask = 0;
      p.pendingMask = 0;
      p.pendingPresses = 0;
      p.pendingSeq = null;
      p.ack = -1;
      p.lastSeq = -1;
      p.lastInput = 0;
    }
    roomUpdate(room);
    snapshot(room);
  }
  function requireRoom(ws) {
    if (!ws.room || !rooms.has(ws.room.code)) {
      error(ws, "먼저 방에 입장해 주세요.");
      return null;
    }
    return ws.room;
  }

  function handle(ws, msg) {
    const now = performance.now();
    switch (msg.type) {
      case "ping":
        if (typeof msg.stamp === "number" && Number.isFinite(msg.stamp))
          send(ws, { type: "pong", stamp: msg.stamp });
        else error(ws, "잘못된 ping 값입니다.");
        return;
      case "create": {
        if (ws.room) return error(ws, "이미 다른 방에 입장해 있습니다.");
        if (typeof msg.char !== "string" || !Object.hasOwn(characters, msg.char))
          return error(ws, "선택할 수 없는 캐릭터입니다.");
        if (rooms.size >= maxRooms)
          return error(
            ws,
            "현재 방이 가득 찼습니다. 잠시 후 다시 시도해 주세요.",
          );
        let code;
        do {
          code = [...randomBytes(6)]
            .map((n) => ALPHABET[n % ALPHABET.length])
            .join("");
        } while (rooms.has(code));
        const room = {
          code,
          players: [newPlayer(ws, msg.char), null],
          state: null,
          paused: false,
          lastActivity: now,
        };
        rooms.set(code, room);
        joined(ws, room, 0);
        return;
      }
      case "join": {
        if (ws.room) return error(ws, "이미 다른 방에 입장해 있습니다.");
        if (
          typeof msg.code !== "string" ||
          !/^[A-Z2-9]{6}$/.test(msg.code) ||
          typeof msg.char !== "string" ||
          !Object.hasOwn(characters, msg.char)
        ) {
          return error(ws, "방 코드 또는 캐릭터가 올바르지 않습니다.");
        }
        const room = rooms.get(msg.code);
        if (!room) return error(ws, "해당 방을 찾을 수 없습니다.");
        if (room.players[1]) return error(ws, "이미 두 명이 입장한 방입니다.");
        room.players[1] = newPlayer(ws, msg.char);
        joined(ws, room, 1);
        return;
      }
      case "resume": {
        if (ws.room) return error(ws, "이미 다른 방에 입장해 있습니다.");
        if (
          typeof msg.code !== "string" ||
          !/^[A-Z2-9]{6}$/.test(msg.code) ||
          typeof msg.token !== "string" ||
          !/^[0-9a-f]{48}$/.test(msg.token)
        ) {
          return error(ws, "재접속 정보가 올바르지 않습니다.", true);
        }
        const room = rooms.get(msg.code);
        const slot =
          room?.players.findIndex(
            (p) =>
              p &&
              timingSafeEqual(Buffer.from(p.token), Buffer.from(msg.token)),
          ) ?? -1;
        if (slot === -1)
          return error(ws, "재접속할 방을 찾을 수 없습니다.", true);
        const p = room.players[slot];
        if (
          p.disconnectedAt !== null &&
          now - p.disconnectedAt >= disconnectGraceMs
        ) {
          destroyRoom(room, "재접속 대기 시간이 지났습니다.");
          return error(ws, "재접속 대기 시간이 지났습니다.", true);
        }
        if (p.ws && p.ws !== ws) {
          p.ws.room = null;
          p.ws.slot = null;
          p.ws.close(4001, "Session resumed elsewhere");
        }
        p.ws = ws;
        p.disconnectedAt = null;
        clearInputs(room);
        // Discarded, unapplied packets must not block a refreshed client's ack-based sequence.
        p.lastSeq = p.ack;
        joined(ws, room, slot);
        if (
          room.paused &&
          room.players.every(
            (player) => player?.ws?.readyState === WebSocket.OPEN,
          )
        ) {
          room.paused = false;
          broadcast(room, { type: "resumed" });
          snapshot(room);
        } else if (room.paused)
          send(ws, {
            type: "paused",
            message: "상대의 재접속을 기다리는 중입니다. (최대 30초)",
          });
        if (
          !room.state &&
          room.players.every(
            (player) =>
              player?.ready && player.ws?.readyState === WebSocket.OPEN,
          )
        )
          startMatch(room);
        else if (
          room.state?.phase === "ended" &&
          room.players.every(
            (player) =>
              player?.rematch && player.ws?.readyState === WebSocket.OPEN,
          )
        )
          startMatch(room);
        return;
      }
      case "ready": {
        const room = requireRoom(ws);
        if (!room) return;
        if (room.state) return error(ws, "이미 시작한 경기입니다.");
        room.players[ws.slot].ready = true;
        room.lastActivity = now;
        if (
          room.players.every(
            (p) => p?.ready && p.ws?.readyState === WebSocket.OPEN,
          )
        )
          startMatch(room);
        else roomUpdate(room);
        return;
      }
      case "input": {
        const room = requireRoom(ws);
        if (!room) return;
        if (
          !Number.isSafeInteger(msg.seq) ||
          msg.seq < 0 ||
          msg.seq > 0x7fffffff ||
          !Number.isInteger(msg.mask) ||
          msg.mask < 0 ||
          (msg.mask & ~ALL_INPUTS) !== 0 ||
          msg.mask > ALL_INPUTS
        ) {
          return error(ws, "입력 데이터가 올바르지 않습니다.");
        }
        if (!room.state || room.state.phase === "ended") return;
        const p = room.players[ws.slot];
        // Acknowledgement moves only after simulation actually consumes this input.
        if (msg.seq <= p.lastSeq) return;
        p.lastSeq = msg.seq;
        p.pendingSeq = msg.seq;
        // Keep a short tap when its release arrives before the next simulation step.
        // Continuous directions/guard still use only the latest received mask.
        p.pendingPresses |= msg.mask & ~p.pendingMask & PRESS_INPUTS;
        p.pendingMask = msg.mask;
        p.lastInput = now;
        return;
      }
      case "rematch": {
        const room = requireRoom(ws);
        if (!room) return;
        if (room.state?.phase !== "ended")
          return error(ws, "경기가 끝난 뒤 재대결할 수 있습니다.");
        room.players[ws.slot].rematch = true;
        room.lastActivity = now;
        if (
          room.players.every(
            (p) => p?.rematch && p.ws?.readyState === WebSocket.OPEN,
          )
        )
          startMatch(room);
        else roomUpdate(room);
        return;
      }
      case "leave": {
        const room = requireRoom(ws);
        if (!room) return;
        destroyRoom(room, "플레이어가 방을 나가 대전이 종료되었습니다.");
        return;
      }
      default:
        error(ws, "지원하지 않는 메시지입니다.");
    }
  }

  server.on("upgrade", (req, socket, head) => {
    if (
      req.url?.split("?")[0] !== "/rebirth/ws" ||
      wss.clients.size >= maxConnections
    ) {
      socket.write(
        "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n",
      );
      socket.destroy();
      return;
    }
    // Browser clients are same-origin. Non-browser tools without Origin support integration tests.
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          throw new Error("origin");
      } catch {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });

  wss.on("connection", (ws) => {
    ws.room = null;
    ws.slot = null;
    ws.alive = true;
    ws.rateStart = performance.now();
    ws.messageCount = 0;
    ws.controlCount = 0;
    ws.on("pong", () => {
      ws.alive = true;
    });
    ws.on("error", () => ws.terminate());
    ws.on("message", (buffer, binary) => {
      if (binary) {
        ws.close(1003, "JSON text required");
        return;
      }
      const now = performance.now();
      if (now - ws.rateStart > 1000) {
        ws.rateStart = now;
        ws.messageCount = 0;
        ws.controlCount = 0;
      }
      if (++ws.messageCount > 180) {
        ws.close(1008, "Rate limit");
        return;
      }
      let msg;
      try {
        msg = JSON.parse(buffer.toString());
      } catch {
        error(ws, "JSON 메시지가 올바르지 않습니다.");
        return;
      }
      if (
        !msg ||
        typeof msg !== "object" ||
        Array.isArray(msg) ||
        typeof msg.type !== "string"
      ) {
        error(ws, "메시지가 올바르지 않습니다.");
        return;
      }
      if (
        msg.type !== "input" &&
        msg.type !== "ping" &&
        ++ws.controlCount > 20
      ) {
        ws.close(1008, "Rate limit");
        return;
      }
      handle(ws, msg);
    });
    ws.on("close", () => {
      const room = ws.room;
      if (!room || !rooms.has(room.code)) return;
      const p = room.players[ws.slot];
      if (p?.ws !== ws) return;
      p.ws = null;
      p.disconnectedAt = performance.now();
      clearInputs(room);
      if (room.state && room.state.phase !== "ended") {
        room.paused = true;
        broadcast(room, {
          type: "paused",
          message: "상대의 재접속을 기다리는 중입니다. (최대 30초)",
        });
      }
      roomUpdate(room);
    });
  });

  let previous = performance.now();
  let accumulator = 0;
  let simTick = 0;
  const simulation = setInterval(() => {
    const now = performance.now();
    accumulator = Math.min(accumulator + now - previous, STEP_MS * 6);
    previous = now;
    let pendingSnapshots;
    while (accumulator >= STEP_MS) {
      accumulator -= STEP_MS;
      simTick++;
      for (const room of rooms.values()) {
        if (!room.state || room.paused || room.state.phase === "ended")
          continue;
        for (const p of room.players) {
          if (now - p.lastInput > staleInputMs) {
            p.mask = 0;
            p.pendingMask = 0;
            p.pendingPresses = 0;
          } else {
            p.mask = p.pendingMask | p.pendingPresses;
            p.pendingPresses = 0;
          }
          if (p.pendingSeq !== null) {
            p.ack = p.pendingSeq;
            p.pendingSeq = null;
          }
        }
        step(
          room.state,
          room.players.map((p) => p.mask),
        );
        room.lastActivity = now;
        if (simTick % 3 === 0 || room.state.phase === "ended") {
          pendingSnapshots ??= new Set();
          pendingSnapshots.add(room);
        }
      }
    }
    // A stalled callback can advance several fixed steps. Send its newest
    // authoritative state once, without queuing obsolete intermediate copies.
    if (pendingSnapshots) for (const room of pendingSnapshots) snapshot(room);
  }, 8);
  const maintenance = setInterval(() => {
    const now = performance.now();
    for (const room of rooms.values()) {
      if (
        room.players.some(
          (p) =>
            p?.disconnectedAt !== null &&
            p?.disconnectedAt !== undefined &&
            now - p.disconnectedAt >= disconnectGraceMs,
        )
      ) {
        destroyRoom(room, "재접속 대기 시간이 지나 방이 종료되었습니다.");
      } else if (now - room.lastActivity > roomIdleMs)
        destroyRoom(room, "오랫동안 활동이 없어 방이 종료되었습니다.");
    }
  }, maintenanceMs);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 15_000);

  async function listen(
    port = Number(process.env.PORT) || 8000,
    host = "0.0.0.0",
  ) {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    return server.address();
  }
  async function close() {
    if (closed) return;
    closed = true;
    clearInterval(simulation);
    clearInterval(maintenance);
    clearInterval(heartbeat);
    rooms.clear();
    for (const ws of wss.clients) ws.terminate();
    await new Promise((resolve) => wss.close(resolve));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
  }
  return { server, wss, rooms, listen, close };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createGameServer();
  try {
    const address = await app.listen();
    console.log(
      `AnimeStreetFighter Rebirth · http://localhost:${address.port}/rebirth/`,
    );
  } catch (error) {
    console.error(`Unable to start Rebirth: ${error.message}`);
    await app.close();
    process.exitCode = 1;
  }
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
