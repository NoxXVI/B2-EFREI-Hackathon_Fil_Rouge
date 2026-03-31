import { useEffect, useRef, useState } from "react";
import { Application, Sprite, Ticker } from "pixi.js";
import { GameEngine } from "./GameEngine";
import { Position, Health } from "./components";

export const GameCanvas = () => {
  const engineRef = useRef<GameEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spritesRef = useRef<Map<number, Sprite>>(new Map());
  const appRef = useRef<Application | null>(null);
  const [health, setHealth] = useState(3);

  useEffect(() => {
    const init = async () => {
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

      await new Promise(resolve => setTimeout(resolve, 500));

      const ticker = Ticker.shared;
      
      const update = () => {
        if (!engineRef.current) return;
        engineRef.current.update(ticker.deltaMS);

        const engine = engineRef.current;
        
        const players = engine.world.query(["PlayerTag", "Health"]);
        if (players.length > 0) {
          const playerHealth = engine.world.getComponent<Health>(players[0], "Health");
          if (playerHealth) {
            setHealth(playerHealth.current);
          }
        } else {
          setHealth(0);
        }

        const entities = engine.world.query(["Position", "SpriteComponent"]);
        const activeEntityIds = new Set<number>();

        for (const entityId of entities) {
          activeEntityIds.add(entityId);
          const pos = engine.world.getComponent<Position>(entityId, "Position")!;
          const spriteComp = engine.world.getComponent<{width: number, height: number, anchor: number}>(entityId, "SpriteComponent")!;

          let sprite = spritesRef.current.get(entityId);

          if (!sprite) {
            const texture = engine.animationSystem.getCurrentTexture(entityId);
            if (texture) {
              texture.baseTexture.scaleMode = 1;
              sprite = new Sprite(texture);
              sprite.anchor.set(spriteComp.anchor);
              sprite.width = spriteComp.width;
              sprite.height = spriteComp.height;
              container.addChild(sprite);
              spritesRef.current.set(entityId, sprite);
            }
          } else {
            const newTexture = engine.animationSystem.getCurrentTexture(entityId);
            if (newTexture) {
              newTexture.baseTexture.scaleMode = 1;
              if (sprite.texture !== newTexture) {
                sprite.texture = newTexture;
              }
            }
          }

          if (sprite) {
            sprite.position.set(pos.x, pos.y);
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
      <div style={{ 
        position: "absolute", 
        top: 10, 
        left: 10, 
        display: "flex", 
        gap: "8px" 
      }}>
        {[...Array(3)].map((_, i) => (
          <span 
            key={i} 
            style={{ 
              fontSize: "24px",
              opacity: i < health ? 1 : 0.3
            }}
          >
            ❤️
          </span>
        ))}
      </div>
    </div>
  );
};
