import { World } from "../ecs/World";
import {
  type Bomb,
  type ExplosionFx,
  type Health,
  type Invulnerable,
  type Position,
  type ShieldState,
  type SpriteComponent,
  type TimerComponent,
} from "../components";
import { SHIELD_COOLDOWN_MS, SHIELD_DURATION_MS } from "../config/abilities";

const EXPLOSION_FX_DURATION_MS = 320;
const PLAYER_INVULNERABILITY_MS = 950;

export function bombSystem(world: World, deltaMS: number) {
  // Tick + cleanup FX
  const fxEntities = world.query(["ExplosionFxTag", "TimerComponent"]);
  for (const fx of fxEntities) {
    const timer = world.getComponent<TimerComponent>(fx, "TimerComponent");
    if (!timer) continue;
    timer.timeLeft -= deltaMS;
    if (timer.timeLeft <= 0) {
      world.destroyEntity(fx);
    } else {
      world.addComponent(fx, "TimerComponent", timer);
    }
  }

  const bombs = world.query(["BombTag", "Bomb", "Position"]);
  if (bombs.length === 0) return;

  const players = world.query(["PlayerTag", "Position", "Health"]);

  for (const bombEntity of bombs) {
    const bomb = world.getComponent<Bomb>(bombEntity, "Bomb");
    const pos = world.getComponent<Position>(bombEntity, "Position");
    if (!bomb || !pos) {
      world.destroyEntity(bombEntity);
      continue;
    }

    bomb.fuseMS -= deltaMS;
    if (bomb.fuseMS > 0) {
      world.addComponent(bombEntity, "Bomb", bomb);
      continue;
    }

    const fx = world.createEntity();
    world.addComponent(fx, "ExplosionFxTag", {});
    world.addComponent<Position>(fx, "Position", { x: pos.x, y: pos.y });
    world.addComponent<ExplosionFx>(fx, "ExplosionFx", { radius: bomb.radius });
    world.addComponent<TimerComponent>(fx, "TimerComponent", {
      timeLeft: EXPLOSION_FX_DURATION_MS,
    });
    world.addComponent<SpriteComponent>(fx, "SpriteComponent", {
      width: Math.max(10, bomb.radius * 2),
      height: Math.max(10, bomb.radius * 2),
      anchor: 0.5,
    });

    for (const player of players) {
      if (world.hasComponent(player, "DeadTag")) continue;
      const health = world.getComponent<Health>(player, "Health");
      if (!health || health.isDead || health.current <= 0) continue;

      const inv = world.getComponent<Invulnerable>(player, "Invulnerable");
      if (inv && inv.timer > 0) continue;

      const p = world.getComponent<Position>(player, "Position");
      if (!p) continue;

      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= bomb.radius * bomb.radius) {
        const shield =
          world.getComponent<ShieldState>(player, "ShieldState") ??
          ({
            activeMS: 0,
            cooldownMS: 0,
          } satisfies ShieldState);

        // Sécurité: si le joueur a oublié, on auto-active le bouclier
        // (uniquement pour les bombes) si disponible.
        if (shield.activeMS > 0) {
          continue;
        }

        if (shield.cooldownMS <= 0) {
          shield.activeMS = SHIELD_DURATION_MS;
          shield.cooldownMS = SHIELD_COOLDOWN_MS;
          world.addComponent(player, "ShieldState", shield);
          continue;
        }

        health.current -= bomb.damage;
        world.addComponent(player, "Invulnerable", {
          timer: PLAYER_INVULNERABILITY_MS,
          duration: PLAYER_INVULNERABILITY_MS,
        });
      }
    }

    world.destroyEntity(bombEntity);
  }
}
