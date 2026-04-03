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
  getMapMeta,
  getMapThemeForLevel,
  type MapTheme,
} from "./systems/MapData";

export const GameCanvas = () => {
  const engineRef = useRef<GameEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spritesRef = useRef<Map<number, Sprite>>(new Map());
  const appRef = useRef<Application | null>(null);
  const arrowTextureRef = useRef<Texture | null>(null);
  const heartTextureRef = useRef<Texture | null>(null);
  const heartSpritesRef = useRef<Sprite[]>([]);
  const lastFrameAtRef = useRef(0);
  const laserContainerRef = useRef<Sprite | null>(null);
  const mouseXRef = useRef(400);
  const lastLevelRef = useRef(1);
  const levelUpOpenRef = useRef(false);
  const mapChangeOpenRef = useRef(false);
  const currentMapThemeRef = useRef<MapTheme | null>(null);
  const mapChangeRef = useRef<MapChangeState | null>(null);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [mapChangeOpen, setMapChangeOpen] = useState(false);
  const [mapChange, setMapChange] = useState<MapChangeState | null>(null);
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
      heartTextureRef.current = heartTex;

      const engine = new GameEngine();
      engineRef.current = engine;
      currentMapThemeRef.current = engine.mapTheme;

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

        if (!levelUpOpenRef.current && !mapChangeOpenRef.current) {
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

            if (progress.level > lastLevelRef.current) {
              lastLevelRef.current = progress.level;
              openUpgradeMenu();
            } else if (progress.skillPoints > 0 && !levelUpOpenRef.current) {
              openUpgradeMenu();
            }

            // Changement de map aux paliers (5,10,20,25,35,40,50...)
            const desiredTheme = getMapThemeForLevel(progress.level);
            const currentTheme =
              currentMapThemeRef.current ?? engine.mapTheme ?? "forest";
            if (
              desiredTheme !== currentTheme &&
              !levelUpOpenRef.current &&
              !mapChangeOpenRef.current
            ) {
              const meta = getMapMeta(desiredTheme);
              const next: MapChangeState = {
                level: progress.level,
                theme: desiredTheme,
                name: meta.name,
                description: meta.description,
              };
              mapChangeRef.current = next;
              mapChangeOpenRef.current = true;
              setMapChange(next);
              setMapChangeOpen(true);
            }
          }
        }

        let camX = 0;
        let camY = 0;

        const players = engine.world.query(["PlayerTag", "Health", "Position"]);
        if (
          players.length > 0 &&
          !engine.world.hasComponent(players[0], "DeadTag")
        ) {
          const playerHealth = engine.world.getComponent<Health>(
            players[0],
            "Health",
          );
          if (playerHealth) {
            for (let i = 0; i < heartSpritesRef.current.length; i++) {
              if (i < playerHealth.current) {
                heartSpritesRef.current[i].tint = 0xffffff;
              } else {
                heartSpritesRef.current[i].tint = 0x888888;
              }
            }
          }

          const playerPos = engine.world.getComponent<Position>(
            players[0],
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
              const mouseWorldX = camX + mouseXRef.current;
              sprite.scale.x = mouseWorldX < pos.x ? -2 : 2;
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
        if (levelUpOpenRef.current || mapChangeOpenRef.current) return;

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
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        id="pixi-container"
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
      />
      <HudOverlay
        progress={hudProgress}
        levelUpOpen={levelUpOpen}
        upgradeOptions={upgradeOptions}
        mapChangeOpen={mapChangeOpen}
        mapChangeInfo={mapChange}
        onConfirmMapChange={async () => {
          if (!engineRef.current) return;
          const change = mapChangeRef.current;
          if (!change) return;
          await engineRef.current.changeMap(change.theme, change.level);
          currentMapThemeRef.current = change.theme;
          mapChangeRef.current = null;
          mapChangeOpenRef.current = false;
          setMapChangeOpen(false);
          setMapChange(null);
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
