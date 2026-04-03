import { useCallback, useEffect, useRef, useState } from "react";
import {
  Application,
  Assets,
  Graphics,
  SCALE_MODES,
  Sprite,
  Texture,
  Ticker,
} from "pixi.js";
import { GameEngine } from "./GameEngine";
import { type Health, type Position } from "./components";
import { setCameraOffset } from "./systems/AttackSystem";
import {
  getMapMeta,
  getMapThemeForLevel,
  type MapTheme,
} from "./systems/MapData";
import {
  applyUpgrade,
  getUpgradeOptions,
  type UpgradeOption,
} from "./systems/PlayerProgressSystem";
import { consumePendingLocalKills } from "./systems/ScoreSystem";
import { HudOverlay } from "./ui/HudOverlay";

type LobbyPlayer = {
  id: string;
  name: string;
  color: number;
  kills: number;
};

const MAP_THEMES: MapTheme[] = [
  "forest",
  "fairy_forest",
  "dungeon",
  "kings_hall",
  "castle_courtyard",
  "battlefield",
  "rocky_lava",
  "volcanic",
];

function isMapTheme(value: unknown): value is MapTheme {
  return typeof value === "string" && MAP_THEMES.includes(value as MapTheme);
}

const LEGACY_MAP_ID_TO_THEME: Record<string, MapTheme> = {
  forest_1: "forest",
  forest_2: "forest",
  dungeon_1: "dungeon",
  lava_1: "volcanic",
};

function coerceMapTheme(value: unknown): MapTheme | null {
  if (typeof value !== "string") return null;
  if (isMapTheme(value)) return value;
  return LEGACY_MAP_ID_TO_THEME[value] ?? null;
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

function safeRoomId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(cleaned)) return generateRoomId();
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
  mode: "solo" | "multi";
  initialPlayerName?: string;
  initialPlayerColor?: string;
  roomId?: string;
  onGameOver?: () => void;
}

export const GameCanvas = ({
  mode,
  initialPlayerName,
  initialPlayerColor,
  roomId: roomIdProp,
  onGameOver,
}: GameCanvasProps) => {
  const engineRef = useRef<GameEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spritesRef = useRef<Map<number, Sprite>>(new Map());
  const appRef = useRef<Application | null>(null);
  const arrowTextureRef = useRef<Texture | null>(null);
  const heartSpritesRef = useRef<Sprite[]>([]);
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
  const currentMapThemeRef = useRef<MapTheme | null>(null);
  const mapChangeRef = useRef<MapChangeState | null>(null);

  // Multiplayer (WS)
  const roomId = safeRoomId(roomIdProp ?? "default");
  const wsRef = useRef<WebSocket | null>(null);
  const youIdRef = useRef<string | null>(null);
  const hostIdRef = useRef<string | null>(null);
  const mpConnectedRef = useRef(false);
  const mpGameStartedRef = useRef(false);
  const lastNetSendAtRef = useRef(0);
  const lastMapRequestRef = useRef<MapTheme | null>(null);

  const [playerName] = useState(() => {
    if (initialPlayerName?.trim()) return initialPlayerName.trim();
    return typeof localStorage !== "undefined"
      ? (localStorage.getItem("mp_name") ?? "")
      : "";
  });
  const [playerColor] = useState(() => {
    if (initialPlayerColor) return safeHexColor(initialPlayerColor);
    return typeof localStorage !== "undefined"
      ? (localStorage.getItem("mp_color") ?? "#44ccff")
      : "#44ccff";
  });
  const [mpPlayers, setMpPlayers] = useState<LobbyPlayer[]>([]);
  const [mpConnecting, setMpConnecting] = useState(false);
  const [mpConnected, setMpConnected] = useState(false);
  const [mpYouId, setMpYouId] = useState<string | null>(null);
  const [mpGameStarted, setMpGameStarted] = useState(false);

  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [mapChangeOpen, setMapChangeOpen] = useState(false);
  const [mapChange, setMapChange] = useState<MapChangeState | null>(null);
  const [isChangingMap, setIsChangingMap] = useState(false);
  const [currentMapName, setCurrentMapName] = useState("—");
  const [hudProgress, setHudProgress] = useState({
    level: 1,
    xp: 0,
    xpToNext: 5,
    skillPoints: 0,
  });

  const openUpgradeMenu = () => {
    setUpgradeOptions(
      getUpgradeOptions()
        .sort(() => Math.random() - 0.5)
        .slice(0, 3),
    );
    levelUpOpenRef.current = true;
    setLevelUpOpen(true);
  };

  const openMapChangeMenu = (theme: MapTheme, level: number) => {
    const meta = getMapMeta(theme);
    const next: MapChangeState = {
      level,
      theme,
      name: meta.name,
      description: meta.description,
    };
    mapChangeRef.current = next;
    mapChangeOpenRef.current = true;
    setMapChange(next);
    setMapChangeOpen(true);
  };

  const closeMapChangeMenu = () => {
    mapChangeRef.current = null;
    mapChangeOpenRef.current = false;
    setMapChangeOpen(false);
    setMapChange(null);
  };

  const resetMultiplayer = useCallback(() => {
    mpConnectedRef.current = false;
    mpGameStartedRef.current = false;
    youIdRef.current = null;
    hostIdRef.current = null;
    wsRef.current = null;
    lastNetSendAtRef.current = 0;
    lastMapRequestRef.current = null;

    if (engineRef.current) {
      for (const id of engineRef.current.getRemotePlayerIds()) {
        engineRef.current.removeRemotePlayer(id);
      }
    }

    setMpConnecting(false);
    setMpConnected(false);
    setMpYouId(null);
    setMpGameStarted(false);
    setMpPlayers([]);
  }, []);

  const sendWs = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  const getEngineLevel = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return 1;
    const entity = engine.world.query(["ProgressionTag", "PlayerProgress"])[0];
    if (entity === undefined) return 1;
    const progress = engine.world.getComponent<{ level: number }>(
      entity,
      "PlayerProgress",
    );
    const level = progress?.level ?? 1;
    return Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  }, []);

  const applyMapChange = useCallback(
    async (theme: MapTheme) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (engine.mapTheme === theme) {
        currentMapThemeRef.current = engine.mapTheme;
        setCurrentMapName(engine.mapInfo.name);
        if (mapChangeRef.current?.theme === theme) {
          closeMapChangeMenu();
        }
        isChangingMapRef.current = false;
        setIsChangingMap(false);
        return;
      }
      if (isApplyingMapRef.current) return;

      isApplyingMapRef.current = true;
      isChangingMapRef.current = true;
      setIsChangingMap(true);

      try {
        await engine.changeMap(theme, getEngineLevel());
        currentMapThemeRef.current = engine.mapTheme;
        setCurrentMapName(engine.mapInfo.name);
      } finally {
        isApplyingMapRef.current = false;
        isChangingMapRef.current = false;
        setIsChangingMap(false);
        closeMapChangeMenu();
      }
    },
    [getEngineLevel],
  );

  const connectMultiplayer = useCallback(() => {
    if (mpConnecting || mpConnected) return;
    setMpConnecting(true);

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
        console.warn("[WS] Server error:", msg.message);
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

      hostIdRef.current = nextHostId;

      mpGameStartedRef.current = started;
      setMpGameStarted(started);

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

      const mapTheme = coerceMapTheme(msg.mapId);
      const pendingMapTheme = coerceMapTheme(msg.pendingMapId);

      if (started && pendingMapTheme && !mapChangeOpenRef.current) {
        openMapChangeMenu(pendingMapTheme, 0);
        isChangingMapRef.current = false;
        setIsChangingMap(false);
      }

      if (started && mapTheme) {
        void applyMapChange(mapTheme);
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
      console.warn("[WS] Disconnected from server.");
    });

    ws.addEventListener("error", () => {
      setMpConnecting(false);
      console.warn("[WS] Unable to connect to server.");
    });
  }, [
    applyMapChange,
    mpConnected,
    mpConnecting,
    playerColor,
    playerName,
    resetMultiplayer,
    roomId,
    sendWs,
  ]);

  useEffect(() => {
    if (mode !== "multi") {
      wsRef.current?.close();
      resetMultiplayer();
      return;
    }
    connectMultiplayer();
  }, [connectMultiplayer, mode, resetMultiplayer]);

  useEffect(() => {
    if (mode !== "multi") return;
    if (!mpConnected) return;
    if (mpGameStarted) return;
    sendWs({ type: "startGame" });
  }, [mode, mpConnected, mpGameStarted, sendWs]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

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

      const heartTex = await Assets.load("/assets/heart.png");
      heartTex.baseTexture.scaleMode = SCALE_MODES.NEAREST;

      const engine = new GameEngine();
      engineRef.current = engine;
      currentMapThemeRef.current = engine.mapTheme;
      setCurrentMapName(engine.mapInfo.name);

      const name = playerName.trim() || "Player";
      const colorNum = hexToColor(safeHexColor(playerColor));
      engine.setLocalPlayerAppearance(name, colorNum);

      const app = new Application();
      appRef.current = app;

      const initialW =
        containerRef.current?.clientWidth ||
        (typeof window !== "undefined" ? window.innerWidth : 800) ||
        800;
      const initialH =
        containerRef.current?.clientHeight ||
        (typeof window !== "undefined" ? window.innerHeight : 600) ||
        600;

      await app.init({
        width: initialW,
        height: initialH,
        backgroundColor: 0x0a0a0f,
      });

      if (!containerRef.current) return;
      containerRef.current.appendChild(app.canvas);
      app.canvas.style.display = "block";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";

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

      const heartsContainer = new Sprite();
      app.stage.addChild(heartsContainer);

      for (let i = 0; i < 3; i++) {
        const heartSprite = new Sprite(heartTex);
        heartSprite.anchor.set(0.5);
        heartSprite.x = 40 + i * 60;
        heartSprite.y = 40;
        heartSprite.scale.set(1);
        heartsContainer.addChild(heartSprite);
        heartSpritesRef.current.push(heartSprite);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const ticker = app.ticker ?? Ticker.shared;
      ticker.start();

      const resizeToContainer = () => {
        if (!appRef.current) return;
        if (!containerRef.current) return;
        const w = Math.floor(containerRef.current.clientWidth);
        const h = Math.floor(containerRef.current.clientHeight);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
          return;
        }
        appRef.current.renderer.resize(w, h);
      };

      resizeToContainer();
      const ro =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver(() => resizeToContainer())
          : null;
      ro?.observe(containerRef.current);

      const update = () => {
        if (!engineRef.current) return;
        lastFrameAtRef.current =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const engine = engineRef.current;

        if (
          !levelUpOpenRef.current &&
          !mapChangeOpenRef.current &&
          !isApplyingMapRef.current
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

            // Changement de map aux paliers (5,10,20,25,35,40,50...)
            const desiredTheme = getMapThemeForLevel(progress.level);
            const currentTheme =
              currentMapThemeRef.current ?? engine.mapTheme ?? "forest";
            const needsMapChange = desiredTheme !== currentTheme;

            if (
              needsMapChange &&
              !mapChangeOpenRef.current &&
              !isChangingMapRef.current
            ) {
              if (mpConnectedRef.current && mpGameStartedRef.current) {
                const youId = youIdRef.current;
                const hostId = hostIdRef.current;
                const isHost = !!youId && !!hostId && youId === hostId;
                if (isHost && lastMapRequestRef.current !== desiredTheme) {
                  lastMapRequestRef.current = desiredTheme;
                  sendWs({ type: "mapChangeRequest", mapId: desiredTheme });
                }
              } else {
                openMapChangeMenu(desiredTheme, progress.level);
              }
            } else if (progress.skillPoints > 0 && !levelUpOpenRef.current) {
              if (!mapChangeOpenRef.current) openUpgradeMenu();
            } else if (leveledUp && !levelUpOpenRef.current) {
              if (!mapChangeOpenRef.current) openUpgradeMenu();
            }
          }
        }

        const localPlayer = engine.getLocalPlayerEntity();
        if (localPlayer !== null) {
          hasSpawnedPlayerRef.current = true;
        } else if (hasSpawnedPlayerRef.current && !gameOverSentRef.current) {
          gameOverSentRef.current = true;
          onGameOverRef.current?.();
        }

        let camX = 0;
        let camY = 0;

        if (
          localPlayer !== null &&
          !engine.world.hasComponent(localPlayer, "DeadTag")
        ) {
          const playerHealth = engine.world.getComponent<Health>(
            localPlayer,
            "Health",
          );
          if (playerHealth) {
            for (let i = 0; i < heartSpritesRef.current.length; i++) {
              heartSpritesRef.current[i].tint =
                i < playerHealth.current ? 0xffffff : 0x888888;
            }
          }

          const playerPos = engine.world.getComponent<Position>(
            localPlayer,
            "Position",
          )!;

          // Camera clamped to map bounds so screen→world aiming stays correct.
          const mapW = engine.tilemapSystem.bounds.width;
          const mapH = engine.tilemapSystem.bounds.height;
          const viewW = appRef.current?.screen.width ?? 800;
          const viewH = appRef.current?.screen.height ?? 600;
          const maxCamX = Math.max(0, mapW - viewW);
          const maxCamY = Math.max(0, mapH - viewH);
          camX = Math.max(0, Math.min(playerPos.x - viewW / 2, maxCamX));
          camY = Math.max(0, Math.min(playerPos.y - viewH / 2, maxCamY));

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

            if (engine.world.hasComponent(entityId, "ProjectileTag")) {
              const vel = engine.world.getComponent<{
                vx: number;
                vy: number;
              }>(entityId, "Velocity");
              if (vel) {
                sprite.rotation = Math.atan2(vel.vy, vel.vx);
              }
            } else if (engine.world.hasComponent(entityId, "PlayerTag")) {
              const appearance = engine.world.getComponent<{ color: number }>(
                entityId,
                "PlayerAppearance",
              );
              if (appearance) {
                sprite.tint = appearance.color;
              }

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
        ro?.disconnect();
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
  }, [playerColor, playerName, sendWs]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        id="pixi-container"
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />
      <HudOverlay
        progress={hudProgress}
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
        mapChangeInfo={mapChange}
        isChangingMap={isChangingMap}
        onConfirmMapChange={async () => {
          if (!engineRef.current) return;
          const change = mapChangeRef.current;
          if (!change) return;

          if (mpConnectedRef.current && mpGameStartedRef.current) {
            isChangingMapRef.current = true;
            setIsChangingMap(true);
            sendWs({ type: "mapChangeConfirm", mapId: change.theme });
            return;
          }

          await applyMapChange(change.theme);

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

interface MapChangeState {
  level: number;
  theme: MapTheme;
  name: string;
  description: string;
}
