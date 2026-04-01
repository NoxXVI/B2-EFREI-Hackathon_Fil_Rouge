import { useEffect, useRef, useState } from "react";
import {
  Application,
  Sprite,
  Ticker,
  SCALE_MODES,
  Assets,
  Texture,
} from "pixi.js";
import { GameEngine } from "./GameEngine";
import { Position, Health } from "./components";

export const GameCanvas = () => {
  const engineRef = useRef<GameEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spritesRef = useRef<Map<number, Sprite>>(new Map());
  const appRef = useRef<Application | null>(null);
  const arrowTextureRef = useRef<Texture | null>(null);
  const heartTextureRef = useRef<Texture | null>(null);
  const heartSpritesRef = useRef<Sprite[]>([]);
  const [mouseX, setMouseX] = useState(400);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.getElementById("pixi-container");
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setMouseX(e.clientX - rect.left);
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

      const app = new Application();
      appRef.current = app;

      await app.init({
        width: 800,
        height: 600,
        backgroundColor: 0x1099bb,
      });

      if (!containerRef.current) return;
      containerRef.current.appendChild(app.canvas);
      const container = new Sprite();
      app.stage.addChild(container);

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

      const ticker = Ticker.shared;

      const update = () => {
        if (!engineRef.current) return;
        engineRef.current.update(ticker.deltaMS);

        const engine = engineRef.current;

        const players = engine.world.query([
          "PlayerTag",
          "Health",
          "Position",
          "DeadTag",
        ]);
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
          container.position.set(400 - playerPos.x, 300 - playerPos.y);
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
            if (
              engine.world.hasComponent(entityId, "ProjectileTag") &&
              arrowTextureRef.current
            ) {
              sprite = new Sprite(arrowTextureRef.current);
              sprite.anchor.set(spriteComp.anchor);
              container.addChild(sprite);
              spritesRef.current.set(entityId, sprite);
            } else {
              const animTexture =
                engine.animationSystem.getCurrentTexture(entityId);
              if (animTexture) {
                animTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
                sprite = new Sprite(animTexture);
                sprite.anchor.set(spriteComp.anchor);
                sprite.width = spriteComp.width;
                sprite.height = spriteComp.height;
                container.addChild(sprite);
                spritesRef.current.set(entityId, sprite);
              }
            }
          } else {
            const newTexture =
              engine.animationSystem.getCurrentTexture(entityId);
            if (newTexture) {
              newTexture.baseTexture.scaleMode = SCALE_MODES.NEAREST;
              if (sprite.texture !== newTexture) {
                sprite.texture = newTexture;
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
              const playerPos = pos;
              if (mouseX < playerPos.x) {
                sprite.scale.x = -2;
              } else {
                sprite.scale.x = 2;
              }
            }
          }
        }

        for (const [id, sprite] of spritesRef.current) {
          if (!activeEntityIds.has(id)) {
            container.removeChild(sprite);
            sprite.destroy();
            spritesRef.current.delete(id);
          }
        }
      };

      ticker.add(update);
    };

    init();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
      }
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} />
    </div>
  );
};
