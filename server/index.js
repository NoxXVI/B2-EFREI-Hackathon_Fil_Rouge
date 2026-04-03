/* eslint-disable no-console */

const http = require("node:http");
const crypto = require("node:crypto");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const MAX_PLAYERS = 4;
const DEFAULT_ROOM_ID = "default";

function safeJsonParse(data) {
  try {
    return JSON.parse(data.toString());
  } catch {
    return null;
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sanitizeRoomId(roomId) {
  const str = String(roomId ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(str)) return null;
  return str;
}

function sanitizeName(name) {
  const str = String(name ?? "").trim();
  const cleaned = str.replace(/[^\p{L}\p{N}_\- ]/gu, "").slice(0, 18);
  return cleaned.length > 0 ? cleaned : "Player";
}

function sanitizeColor(color) {
  const num = Number(color);
  if (!Number.isFinite(num)) return 0xffffff;
  return clamp(Math.floor(num), 0x000000, 0xffffff);
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(200, { "content-type": "text/plain" });
  res.end("WebSocket server running.\n");
});

const wss = new WebSocketServer({ server });

/** @type {Map<string, { id: string, players: Map<string, { id: string, ws: import('ws').WebSocket, joined: boolean, name: string, color: number, x: number, y: number, vx: number, vy: number, kills: number }>, hostId: string | null, gameStarted: boolean, mapId: string, pendingMapId: string | null, pendingMapConfirmations: Set<string> }>} */
const rooms = new Map();

function getOrCreateRoom(roomId) {
  const id = sanitizeRoomId(roomId) ?? DEFAULT_ROOM_ID;
  let room = rooms.get(id);
  if (room) return room;

  room = {
    id,
    players: new Map(),
    hostId: null,
    gameStarted: false,
    mapId: "forest_1",
    pendingMapId: null,
    pendingMapConfirmations: new Set(),
  };
  rooms.set(id, room);
  return room;
}

function joinedPlayerIds(room) {
  return [...room.players.values()].filter((p) => p.joined).map((p) => p.id);
}

function serializeState(room, forYouId) {
  return {
    type: "state",
    roomId: room.id,
    youId: forYouId,
    hostId: room.hostId,
    gameStarted: room.gameStarted,
    mapId: room.mapId,
    pendingMapId: room.pendingMapId,
    pendingMapConfirmations: [...room.pendingMapConfirmations.values()],
    players: [...room.players.values()]
      .filter((p) => p.joined)
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        kills: p.kills,
      })),
  };
}

function broadcastState(room) {
  for (const p of room.players.values()) {
    if (p.ws.readyState !== p.ws.OPEN) continue;
    p.ws.send(JSON.stringify(serializeState(room, p.id)));
  }
}

function sendError(ws, message) {
  try {
    ws.send(JSON.stringify({ type: "error", message }));
  } catch {
    // ignore
  }
}

function ensureHost(room) {
  if (room.hostId) {
    const current = room.players.get(room.hostId);
    if (current && current.joined) return;
  }
  const joined = joinedPlayerIds(room);
  room.hostId = joined[0] ?? null;
}

function resetMapChange(room) {
  room.pendingMapId = null;
  room.pendingMapConfirmations = new Set();
}

function maybeCommitMapChange(room) {
  if (!room.pendingMapId) return;
  const joined = joinedPlayerIds(room);
  if (joined.length === 0) return;

  const allConfirmed = joined.every((id) => room.pendingMapConfirmations.has(id));
  if (!allConfirmed) return;

  room.mapId = room.pendingMapId;
  resetMapChange(room);
}

wss.on("connection", (ws, req) => {
  const id = crypto.randomUUID();

  const roomId = (() => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      return sanitizeRoomId(url.searchParams.get("room")) ?? DEFAULT_ROOM_ID;
    } catch {
      return DEFAULT_ROOM_ID;
    }
  })();

  const room = getOrCreateRoom(roomId);

  room.players.set(id, {
    id,
    ws,
    joined: false,
    name: "Player",
    color: 0xffffff,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    kills: 0,
  });

  ws.on("message", (raw) => {
    const msg = safeJsonParse(raw);
    if (!msg || typeof msg.type !== "string") return;

    const player = room.players.get(id);
    if (!player) return;

    switch (msg.type) {
      case "join": {
        const joinedCount = joinedPlayerIds(room).length;
        if (!player.joined && joinedCount >= MAX_PLAYERS) {
          sendError(ws, "La partie est pleine (4 joueurs max).");
          ws.close();
          return;
        }

        player.joined = true;
        player.name = sanitizeName(msg.name);
        player.color = sanitizeColor(msg.color);
        player.kills = 0;

        ensureHost(room);
        broadcastState(room);
        return;
      }

      case "updateColor": {
        if (!player.joined) return;
        if (room.gameStarted) return;
        player.color = sanitizeColor(msg.color);
        broadcastState(room);
        return;
      }

      case "startGame": {
        if (!player.joined) return;
        ensureHost(room);
        if (room.hostId !== id) return;
        room.gameStarted = true;
        resetMapChange(room);
        broadcastState(room);
        return;
      }

      case "playerState": {
        if (!player.joined) return;
        player.x = Number(msg.x) || 0;
        player.y = Number(msg.y) || 0;
        player.vx = Number(msg.vx) || 0;
        player.vy = Number(msg.vy) || 0;
        return;
      }

      case "mapChangeRequest": {
        if (!player.joined) return;
        if (!room.gameStarted) return;
        const requested = String(msg.mapId ?? "");
        if (!requested) return;
        if (room.pendingMapId) return; // already in progress
        room.pendingMapId = requested;
        room.pendingMapConfirmations = new Set([id]);
        broadcastState(room);
        return;
      }

      case "mapChangeConfirm": {
        if (!player.joined) return;
        if (!room.gameStarted) return;
        const requested = String(msg.mapId ?? "");
        if (!room.pendingMapId || requested !== room.pendingMapId) return;
        room.pendingMapConfirmations.add(id);
        maybeCommitMapChange(room);
        broadcastState(room);
        return;
      }

      case "mobKilled": {
        if (!player.joined) return;
        if (!room.gameStarted) return;
        const count = clamp(Math.floor(Number(msg.count) || 1), 1, 25);
        player.kills += count;
        return;
      }
    }
  });

  ws.on("close", () => {
    const wasJoined = room.players.get(id)?.joined;
    room.players.delete(id);

    if (room.hostId === id) {
      room.hostId = null;
      ensureHost(room);
    }

    if (wasJoined && room.pendingMapId) {
      room.pendingMapConfirmations.delete(id);
      maybeCommitMapChange(room);
    }

    if (room.players.size === 0) {
      rooms.delete(room.id);
      return;
    }

    ensureHost(room);
    broadcastState(room);
  });

  // Give the client its id + current state (even before join)
  try {
    ws.send(JSON.stringify(serializeState(room, id)));
  } catch {
    // ignore
  }
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.gameStarted) continue;
    broadcastState(room);
  }
}, 50);

server.listen(PORT, () => {
  console.log(`[ws] listening on :${PORT}`);
});
