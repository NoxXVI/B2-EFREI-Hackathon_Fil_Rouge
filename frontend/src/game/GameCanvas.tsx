import { useEffect, useRef, useState } from "react";
import {
  Application,
  Sprite,
  Ticker,
  SCALE_MODES,
  Assets,
  Texture,
  Graphics,
} from "pixi.js";
import { GameEngine } from "./GameEngine";
import { Position, Health } from "./components";
import {
  applyUpgrade,
  getUpgradeOptions,
  type UpgradeOption,
} from "./systems/PlayerProgressSystem";
import { HudOverlay } from "./ui/HudOverlay";
import { setCameraOffset } from "./systems/AttackSystem";
import {
  getMapDisplayName,
  getTargetMapIdForLevel,
  type MapId,
} from "./systems/MapData";
import { consumePendingLocalKills } from "./systems/ScoreSystem";
import { MultiplayerLobby, type LobbyPlayer } from "./ui/MultiplayerLobby";

const MAP_IDS: MapId[] = [
  "forest_1",
  "forest_2",
  "ice_1",
  "dungeon_1",
  "lava_1",
];

function isMapId(value: unknown): value is MapId {
  return typeof value === "string" && MAP_IDS.includes(value as MapId);
}

function generateRoomId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return out;
  }
  return Math.random().toString(36).slice(2, 12);
}

function safeRoomId(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(cleaned)) return null;
  return cleaned;
}

function hexToColor(hex: string): number {
  const cleaned = hex.replace("#", "").trim();
  const num = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(num)) return 0xffffff;
  return Math.max(0, Math.min(0xffffff, num));
}

function safeHexColor(hex: string): string {
  const cleaned = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(cleaned)) return "#ffffff";
  return cleaned.toLowerCase();
}

interface GameCanvasProps {
  onGameOver?: () => void;
}

export const GameCanvas = ({ onGameOver }: GameCanvasProps) => {
  const engineRef = useRef<GameEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spritesRef = useRef<Map<number, Sprite>>(new Map());
  const appRef = useRef<Application | null>(null);
  const arrowTextureRef = useRef<Texture | null>(null);
  const lastFrameAtRef = useRef(0);
  const laserContainerRef = useRef<Sprite | null>(null);
  const mouseXRef = useRef(400);
  const lastLevelRef = useRef(1);
  const levelUpOpenRef = useRef(false);
  const hasSpawnedPlayerRef = useRef(false);
  const gameOverSentRef = useRef(false);
  const onGameOverRef = useRef(onGameOver);
  const mapChangeOpenRef = useRef(false);
  const isChangingMapRef = useRef(false);
  const isApplyingMapRef = useRef(false);

  // Multiplayer (WS)
  const [roomId] = useState(() => {
    if (typeof window === "undefined") return "default";
    const url = new URL(window.location.href);
    const existing = safeRoomId(url.searchParams.get("room"));
    if (existing) return existing;
    const next = generateRoomId();
    url.searchParams.set("room", next);
    window.history.replaceState(null, "", url.toString());
    return next;
  });
  const lobbyOpenRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const youIdRef = useRef<string | null>(null);
  const mpConnectedRef = useRef(false);
  const mpGameStartedRef = useRef(false);
  const lastNetSendAtRef = useRef(0);
  const lastMapRequestRef = useRef<MapId | null>(null);
  const pendingMapIdRef = useRef<MapId | null>(null);

  const [lobbyOpen, setLobbyOpen] = useState(true);
  const [playerName, setPlayerName] = useState(() => {
    return typeof localStorage !== "undefined"
      ? (localStorage.getItem("mp_name") ?? "")
      : "";
  });
  const [playerColor, setPlayerColor] = useState(() => {
    return typeof localStorage !== "undefined"
      ? (localStorage.getItem("mp_color") ?? "#44ccff")
      : "#44ccff";
  });
  const [mpPlayers, setMpPlayers] = useState<LobbyPlayer[]>([]);
  const [mpConnecting, setMpConnecting] = useState(false);
  const [mpConnected, setMpConnected] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpHostId, setMpHostId] = useState<string | null>(null);
  const [mpYouId, setMpYouId] = useState<string | null>(null);
  const [mpGameStarted, setMpGameStarted] = useState(false);

  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [hudProgress, setHudProgress] = useState({
    level: 1,
    xp: 0,
    xpToNext: 5,
    skillPoints: 0,
  });
  const [hudHealth, setHudHealth] = useState({
    current: 3,
    max: 3,
  });
  const [currentMapName, setCurrentMapName] = useState("—");
  const [mapChangeOpen, setMapChangeOpen] = useState(false);
  const [pendingMapId, setPendingMapId] = useState<MapId | null>(null);
  const [isChangingMap, setIsChangingMap] = useState(false);

  const openUpgradeMenu = () => {
    setUpgradeOptions(
      getUpgradeOptions()
        .sort(() => Math.random() - 0.5)
        .slice(0, 3),
    );
    levelUpOpenRef.current = true;
    setLevelUpOpen(true);
  };

  const openMapChangeMenu = (mapId: MapId) => {
    setPendingMapId(mapId);
    pendingMapIdRef.current = mapId;
    mapChangeOpenRef.current = true;
    setMapChangeOpen(true);
  };

  const closeMapChangeMenu = () => {
    pendingMapIdRef.current = null;
    mapChangeOpenRef.current = false;
    setMapChangeOpen(false);
    setPendingMapId(null);
  };

  const closeLobby = () => {
    lobbyOpenRef.current = false;
    setLobbyOpen(false);
  };

  const resetMultiplayer = () => {
    mpConnectedRef.current = false;
    mpGameStartedRef.current = false;
    youIdRef.current = null;
    wsRef.current = null;
    lastNetSendAtRef.current = 0;
    lastMapRequestRef.current = null;

    setMpConnecting(false);
    setMpConnected(false);
    setMpHostId(null);
    setMpYouId(null);
    setMpGameStarted(false);
    setMpPlayers([]);
  };

  const sendWs = (payload: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  };

  const applyMapChange = async (mapId: MapId) => {
    if (!engineRef.current) return;
    if (!appRef.current) return;
    if (engineRef.current.currentMap.id === mapId) return;
    if (isApplyingMapRef.current) return;

    isApplyingMapRef.current = true;
    isChangingMapRef.current = true;
    setIsChangingMap(true);

    try {
      await engineRef.current.changeMap(mapId);
      setCurrentMapName(engineRef.current.currentMap.name);
      appRef.current.renderer.background.color =
        engineRef.current.currentMap.backgroundColor;
    } finally {
      isApplyingMapRef.current = false;
      isChangingMapRef.current = false;
      setIsChangingMap(false);
      closeMapChangeMenu();
    }
  };

  const connectMultiplayer = () => {
    if (mpConnecting || mpConnected) return;
    setMpConnecting(true);
    setMpError(null);

    const name = playerName.trim() || "Player";
    const colorHex = safeHexColor(playerColor);
    const colorNum = hexToColor(colorHex);

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mp_name", name);
      localStorage.setItem("mp_color", colorHex);
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const wsUrl =
      (import.meta.env.VITE_WS_URL as string | undefined) ??
      `${protocol}//${host}:3001`;

    const wsWithRoom = (() => {
      try {
        const url = new URL(wsUrl);
        url.searchParams.set("room", roomId);
        return url.toString();
      } catch {
        const sep = wsUrl.includes("?") ? "&" : "?";
        return `${wsUrl}${sep}room=${encodeURIComponent(roomId)}`;
      }
    })();

    const ws = new WebSocket(wsWithRoom);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      setMpConnected(true);
      mpConnectedRef.current = true;
      setMpConnecting(false);

      engineRef.current?.setLocalPlayerAppearance(name, colorNum);
      sendWs({ type: "join", name, color: colorNum, roomId });
    });

    ws.addEventListener("message", (event) => {
      const msg = (() => {
        try {
          return JSON.parse(String(event.data));
        } catch {
          return null;
        }
      })();

      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "error" && typeof msg.message === "string") {
        setMpError(msg.message);
        return;
      }

      if (msg.type !== "state") return;

      const nextYouId = typeof msg.youId === "string" ? msg.youId : null;
      const nextHostId = typeof msg.hostId === "string" ? msg.hostId : null;
      const started = !!msg.gameStarted;

      if (nextYouId) {
        youIdRef.current = nextYouId;
        setMpYouId((prev) => (prev === nextYouId ? prev : nextYouId));
        engineRef.current?.setLocalNetworkId(nextYouId);
      }

      setMpHostId((prev) => (prev === nextHostId ? prev : nextHostId));

      mpGameStartedRef.current = started;
      setMpGameStarted(started);

      if (started && lobbyOpenRef.current) {
        closeLobby();
      }

      const incomingPlayers: LobbyPlayer[] = Array.isArray(msg.players)
        ? msg.players
            .filter(
              (p: unknown) =>
                !!p &&
                typeof (p as { id?: unknown }).id === "string" &&
                typeof (p as { name?: unknown }).name === "string" &&
                typeof (p as { color?: unknown }).color === "number",
            )
            .map(
              (p: {
                id: string;
                name: string;
                color: number;
                kills?: unknown;
              }) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                kills: typeof p.kills === "number" ? p.kills : 0,
              }),
            )
        : [];

      incomingPlayers.sort((a, b) => a.id.localeCompare(b.id));
      setMpPlayers((prev) => {
        if (prev.length !== incomingPlayers.length) return incomingPlayers;
        for (let i = 0; i < prev.length; i++) {
          const a = prev[i];
          const b = incomingPlayers[i];
          if (
            a.id !== b.id ||
            a.name !== b.name ||
            a.color !== b.color ||
            a.kills !== b.kills
          ) {
            return incomingPlayers;
          }
        }
        return prev;
      });

      const mapId = isMapId(msg.mapId) ? msg.mapId : null;
      const pendingMapId = isMapId(msg.pendingMapId) ? msg.pendingMapId : null;

      if (started && pendingMapId && !mapChangeOpenRef.current) {
        openMapChangeMenu(pendingMapId);
        isChangingMapRef.current = false;
        setIsChangingMap(false);
      }

      if (started && mapId) {
        void applyMapChange(mapId);
      }

      if (started && engineRef.current && Array.isArray(msg.players)) {
        const remotePlayers = msg.players.filter(
          (p: { id: string }) => p.id && p.id !== nextYouId,
        );

        for (const p of remotePlayers) {
          engineRef.current.upsertRemotePlayer({
            id: p.id,
            name: typeof p.name === "string" ? p.name : "Player",
            color: typeof p.color === "number" ? p.color : 0xffffff,
            x: typeof p.x === "number" ? p.x : 0,
            y: typeof p.y === "number" ? p.y : 0,
            vx: typeof p.vx === "number" ? p.vx : 0,
            vy: typeof p.vy === "number" ? p.vy : 0,
          });
        }

        const remoteIds = new Set<string>(
          remotePlayers.map((p: { id: string }) => p.id),
        );
        for (const existingId of engineRef.current.getRemotePlayerIds()) {
          if (!remoteIds.has(existingId)) {
            engineRef.current.removeRemotePlayer(existingId);
          }
        }
      }
    });

    ws.addEventListener("close", () => {
      resetMultiplayer();
      setMpError("Déconnecté du serveur.");
    });

    ws.addEventListener("error", () => {
      setMpConnecting(false);
      setMpError("Impossible de se connecter au serveur WS.");
    });
  };

  const startMultiplayer = () => {
    sendWs({ type: "startGame" });
  };

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.getElementById("pixi-container");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        mouseXRef.current = e.clientX - rect.left;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const init = async () => {
      const arrowTex = await Assets.load("/assets/projectile/arrow.png");
      arrowTex.baseTexture.scaleMode = SCALE_MODES.NEAREST;
      arrowTextureRef.current = arrowTex;

      const engine = new GameEngine();
      engineRef.current = engine;
      setCurrentMapName(engine.currentMap.name);

      const app = new Application();
      appRef.current = app;

      await app.init({
        width: 800,
        height: 600,
        backgroundColor: 0x0a0a0f,
      });

      if (!containerRef.current) return;
      containerRef.current.appendChild(app.canvas);

      const worldContainer = new Sprite();
      app.stage.addChild(worldContainer);

      // Map layer (background)
      worldContainer.addChild(engine.tilemapSystem.container);

      const laserContainer = new Sprite();
      worldContainer.addChild(laserContainer);
      laserContainerRef.current = laserContainer;

      const spriteContainer = new Sprite();
      worldContainer.addChild(spriteContainer);

      const bossContainer = new Sprite();
      worldContainer.addChild(bossContainer);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const ticker = app.ticker ?? Ticker.shared;
      ticker.start();

      const update = () => {
        if (!engineRef.current) return;
        lastFrameAtRef.current =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const engine = engineRef.current;

        if (
          !levelUpOpenRef.current &&
          !mapChangeOpenRef.current &&
          !lobbyOpenRef.current
        ) {
          engine.update(ticker.deltaMS);
        }

        const progressEntity = engine.world.query([
          "ProgressionTag",
          "PlayerProgress",
        ])[0];
        if (progressEntity !== undefined) {
          const progress = engine.world.getComponent<{
            level: number;
            xp: number;
            xpToNext: number;
            skillPoints: number;
          }>(progressEntity, "PlayerProgress");

          if (progress) {
            setHudProgress((prev) => {
              if (
                prev.level === progress.level &&
                prev.xp === progress.xp &&
                prev.xpToNext === progress.xpToNext &&
                prev.skillPoints === progress.skillPoints
              ) {
                return prev;
              }
              return {
                level: progress.level,
                xp: progress.xp,
                xpToNext: progress.xpToNext,
                skillPoints: progress.skillPoints,
              };
            });

            const leveledUp = progress.level > lastLevelRef.current;
            if (leveledUp) lastLevelRef.current = progress.level;

            const targetMapId = getTargetMapIdForLevel(progress.level);
            const needsMapChange = targetMapId !== engine.currentMap.id;

            if (
              needsMapChange &&
              !mapChangeOpenRef.current &&
              !isChangingMapRef.current
            ) {
              if (mpConnectedRef.current && mpGameStartedRef.current) {
                if (lastMapRequestRef.current !== targetMapId) {
                  lastMapRequestRef.current = targetMapId;
                  sendWs({ type: "mapChangeRequest", mapId: targetMapId });
                }
              } else {
                openMapChangeMenu(targetMapId);
              }
            } else if (progress.skillPoints > 0 && !levelUpOpenRef.current) {
              // Normal level-up flow
              if (!mapChangeOpenRef.current) openUpgradeMenu();
            } else if (leveledUp && !levelUpOpenRef.current) {
              if (!mapChangeOpenRef.current) openUpgradeMenu();
            }
          }
        }

        let camX = 0;
        let camY = 0;

        const players = engine.world.query(["PlayerTag", "Health", "Position"]);
        if (players.length > 0) {
          hasSpawnedPlayerRef.current = true;
        } else if (hasSpawnedPlayerRef.current && !gameOverSentRef.current) {
          gameOverSentRef.current = true;
          onGameOverRef.current?.();
        }

        if (
          players.length > 0 &&
          !engine.world.hasComponent(players[0], "DeadTag")
        ) {
          const playerHealth = engine.world.getComponent<Health>(
            players[0],
            "Health",
          );
          if (playerHealth) {
            setHudHealth((prev) => {
              if (
                prev.current === playerHealth.current &&
                prev.max === playerHealth.max
              ) {
                return prev;
              }

              return {
                current: playerHealth.current,
                max: playerHealth.max,
              };
            });
          }

          const playerPos = engine.world.getComponent<Position>(
            players[0],
            "Position",
          )!;

          // Camera clamped to map bounds so screen→world aiming stays correct.
          const mapW = engine.tilemapSystem.bounds.width;
          const mapH = engine.tilemapSystem.bounds.height;
          const maxCamX = Math.max(0, mapW - 800);
          const maxCamY = Math.max(0, mapH - 600);
          camX = Math.max(0, Math.min(playerPos.x - 400, maxCamX));
          camY = Math.max(0, Math.min(playerPos.y - 300, maxCamY));

          worldContainer.position.set(-camX, -camY);
          setCameraOffset(camX, camY);
        } else {
          worldContainer.position.set(0, 0);
          setCameraOffset(0, 0);
        }

        const entities = engine.world.query(["Position", "SpriteComponent"]);
        const activeEntityIds = new Set<number>();

        for (const entityId of entities) {
          activeEntityIds.add(entityId);
          const pos = engine.world.getComponent<Position>(
            entityId,
            "Position",
          )!;
          const spriteComp = engine.world.getComponent<{
            width: number;
            height: number;
            anchor: number;
          }>(entityId, "SpriteComponent")!;

          let sprite = spritesRef.current.get(entityId);

          if (!sprite) {
            // PROJECTILE
            if (
              engine.world.hasComponent(entityId, "ProjectileTag") &&
              arrowTextureRef.current
            ) {
              sprite = new Sprite(arrowTextureRef.current);
              sprite.anchor.set(spriteComp.anchor);

              spriteContainer.addChild(sprite);
              spritesRef.current.set(entityId, sprite);
            }

            // NORMAL / ANIMATION
            else if (
              !engine.world.hasComponent(entityId, "LaserTag") ||
              engine.world.hasComponent(entityId, "BossTag")
            ) {
              const animTexture =
                engine.animationSystem.getCurrentTexture(entityId);

              if (animTexture) {
                animTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

                sprite = new Sprite(animTexture);
                sprite.anchor.set(spriteComp.anchor);
                sprite.width = spriteComp.width;
                sprite.height = spriteComp.height;

                if (engine.world.hasComponent(entityId, "BossTag")) {
                  bossContainer.addChild(sprite);
                } else {
                  spriteContainer.addChild(sprite);
                }
                spritesRef.current.set(entityId, sprite);
              }
            }

            // LASER (only create once, not for boss)
            if (!sprite && engine.world.hasComponent(entityId, "LaserTag")) {
              const vel = engine.world.getComponent<{ vx: number; vy: number }>(
                entityId,
                "Velocity",
              );
              const stats = engine.world.getComponent<{ length: number }>(
                entityId,
                "LaserStats",
              );

              if (vel && stats && laserContainerRef.current) {
                const laserGraphics = new Graphics();
                laserGraphics.rect(0, 0, stats.length, spriteComp.width);
                laserGraphics.fill(0xff0000);
                laserGraphics.rotation = Math.atan2(vel.vy, vel.vx);

                laserContainerRef.current.addChild(laserGraphics);

                spritesRef.current.set(
                  entityId,
                  laserGraphics as unknown as Sprite,
                );

                sprite = laserGraphics as unknown as Sprite;
              }
            }
          } else {
            // ⚠️ IMPORTANT → ne pas toucher aux lasers
            if (!engine.world.hasComponent(entityId, "LaserTag")) {
              const newTexture =
                engine.animationSystem.getCurrentTexture(entityId);

              if (newTexture) {
                newTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;

                if ("texture" in sprite && sprite.texture !== newTexture) {
                  sprite.texture = newTexture;
                }
              }
            }
          }
          if (sprite) {
            sprite.position.set(pos.x, pos.y);

            const appearance = engine.world.getComponent<{ color: number }>(
              entityId,
              "PlayerAppearance",
            );
            if (appearance) {
              sprite.tint = appearance.color;
            }

            if (engine.world.hasComponent(entityId, "ProjectileTag")) {
              const vel = engine.world.getComponent<{
                vx: number;
                vy: number;
              }>(entityId, "Velocity");
              if (vel) {
                sprite.rotation = Math.atan2(vel.vy, vel.vx);
              }
            } else if (engine.world.hasComponent(entityId, "PlayerTag")) {
              const isLocal = engine.world.hasComponent(
                entityId,
                "LocalPlayerTag",
              );
              if (isLocal) {
                const mouseWorldX = camX + mouseXRef.current;
                sprite.scale.x = mouseWorldX < pos.x ? -2 : 2;
                sprite.scale.y = 2;
              } else {
                const vel = engine.world.getComponent<{
                  vx: number;
                  vy: number;
                }>(entityId, "Velocity");
                if (vel && vel.vx !== 0) {
                  sprite.scale.x = vel.vx < 0 ? -2 : 2;
                  sprite.scale.y = 2;
                }
              }
            } else if (engine.world.hasComponent(entityId, "EnemyTag")) {
              const vel = engine.world.getComponent<{
                vx: number;
                vy: number;
              }>(entityId, "Velocity");
              if (vel) {
                sprite.scale.x = vel.vx < 0 ? -2 : 2;
                sprite.scale.y = 2;
              }
            }
          }
        }

        const ws = wsRef.current;
        if (
          ws &&
          ws.readyState === WebSocket.OPEN &&
          mpConnectedRef.current &&
          mpGameStartedRef.current
        ) {
          const now =
            typeof performance !== "undefined" ? performance.now() : Date.now();
          if (now - lastNetSendAtRef.current >= 50) {
            lastNetSendAtRef.current = now;
            const localPlayer = engine.getLocalPlayerEntity();
            if (localPlayer !== null) {
              const pos = engine.world.getComponent<Position>(
                localPlayer,
                "Position",
              );
              const vel = engine.world.getComponent<{
                vx: number;
                vy: number;
              }>(localPlayer, "Velocity");
              if (pos && vel) {
                sendWs({
                  type: "playerState",
                  x: pos.x,
                  y: pos.y,
                  vx: vel.vx,
                  vy: vel.vy,
                });
              }
            }

            const pendingKills = consumePendingLocalKills(engine.world);
            if (pendingKills > 0) {
              sendWs({ type: "mobKilled", count: pendingKills });
            }
          }
        }

        for (const [id, sprite] of spritesRef.current) {
          if (!activeEntityIds.has(id)) {
            if (sprite.parent) {
              sprite.parent.removeChild(sprite);
            }
            sprite.destroy();
            spritesRef.current.delete(id);
          }
        }
      };

      ticker.add(update);

      const fallbackInterval = window.setInterval(() => {
        if (!engineRef.current) return;
        if (levelUpOpenRef.current) return;
        if (mapChangeOpenRef.current) return;
        if (isChangingMapRef.current) return;
        if (lobbyOpenRef.current) return;

        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const last = lastFrameAtRef.current;

        // If no frame callback came recently, force a small engine step.
        if (last === 0 || now - last > 350) {
          engineRef.current.update(16);
          lastFrameAtRef.current = now;
        }
      }, 100);

      return () => {
        window.clearInterval(fallbackInterval);
        ticker.remove(update);
      };
    };

    let disposeTicker: (() => void) | undefined;

    init().then((dispose) => {
      disposeTicker = dispose;
    });

    return () => {
      disposeTicker?.();
      if (appRef.current) {
        appRef.current.destroy(true);
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "800px", height: "600px" }}>
      <div id="pixi-container" ref={containerRef} />
      <MultiplayerLobby
        open={lobbyOpen}
        roomId={roomId}
        inviteLink={typeof window !== "undefined" ? window.location.href : "—"}
        connecting={mpConnecting}
        connected={mpConnected}
        error={mpError}
        playerName={playerName}
        playerColor={safeHexColor(playerColor)}
        players={mpPlayers}
        youId={mpYouId}
        hostId={mpHostId}
        gameStarted={mpGameStarted}
        onPlayerNameChange={(name) => {
          setPlayerName(name);
        }}
        onPlayerColorChange={(hex) => {
          const safe = safeHexColor(hex);
          setPlayerColor(safe);

          const name = playerName.trim() || "Player";
          const colorNum = hexToColor(safe);
          engineRef.current?.setLocalPlayerAppearance(name, colorNum);

          if (typeof localStorage !== "undefined") {
            localStorage.setItem("mp_color", safe);
          }

          if (mpConnectedRef.current && !mpGameStartedRef.current) {
            sendWs({ type: "updateColor", color: colorNum });
          }
        }}
        onJoin={connectMultiplayer}
        onStart={startMultiplayer}
        onPlaySolo={() => {
          wsRef.current?.close();
          resetMultiplayer();
          closeLobby();
        }}
      />
      <HudOverlay
        progress={hudProgress}
        health={hudHealth}
        currentMapName={currentMapName}
        scoreboard={
          mpConnected && mpGameStarted
            ? mpPlayers.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                kills: p.kills,
                isYou: !!mpYouId && p.id === mpYouId,
              }))
            : undefined
        }
        levelUpOpen={levelUpOpen}
        upgradeOptions={upgradeOptions}
        mapChangeOpen={mapChangeOpen}
        pendingMapName={pendingMapId ? getMapDisplayName(pendingMapId) : ""}
        isChangingMap={isChangingMap}
        onConfirmMapChange={async () => {
          if (!engineRef.current) return;
          if (!pendingMapId) return;

          if (mpConnectedRef.current && mpGameStartedRef.current) {
            isChangingMapRef.current = true;
            setIsChangingMap(true);
            sendWs({ type: "mapChangeConfirm", mapId: pendingMapId });
            return;
          }

          isChangingMapRef.current = true;
          setIsChangingMap(true);

          try {
            await engineRef.current.changeMap(pendingMapId);
            setCurrentMapName(engineRef.current.currentMap.name);

            if (appRef.current) {
              appRef.current.renderer.background.color =
                engineRef.current.currentMap.backgroundColor;
            }
          } finally {
            isChangingMapRef.current = false;
            setIsChangingMap(false);
          }

          closeMapChangeMenu();

          // Après changement de map, si des points de skill sont dispo, on ouvre l'upgrade menu.
          const progressEntity = engineRef.current.world.query([
            "ProgressionTag",
            "PlayerProgress",
          ])[0];
          const progress = progressEntity
            ? engineRef.current.world.getComponent<{
                skillPoints: number;
              }>(progressEntity, "PlayerProgress")
            : null;
          if (progress && progress.skillPoints > 0 && !levelUpOpenRef.current) {
            openUpgradeMenu();
          }
        }}
        onUpgrade={(option) => {
          if (!engineRef.current) return;
          applyUpgrade(engineRef.current.world, option.type);
          const progressEntity = engineRef.current.world.query([
            "ProgressionTag",
            "PlayerProgress",
          ])[0];
          const progress = progressEntity
            ? engineRef.current.world.getComponent<{
                level: number;
                xp: number;
                xpToNext: number;
                skillPoints: number;
              }>(progressEntity, "PlayerProgress")
            : null;
          if (!progress || progress.skillPoints <= 0) {
            levelUpOpenRef.current = false;
            setLevelUpOpen(false);
          } else {
            openUpgradeMenu();
          }
        }}
      />
    </div>
  );
};
