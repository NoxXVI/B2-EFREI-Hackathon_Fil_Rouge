import { World } from "../ecs/World";
import { Position, Health, Invulnerable } from "../components";

const PLAYER_DAMAGE = 1;
const INVULNERABILITY_DURATION = 1500;
const COLLISION_RADIUS = 30;

export function healthSystem(world: World, deltaMS: number, onPlayerDeath?: () => void) {
  const players = world.query(["PlayerTag", "Position", "Health"]);
  const enemies = world.query(["EnemyTag", "Position"]);

  for (const player of players) {
    const playerPos = world.getComponent<Position>(player, "Position")!;
    const health = world.getComponent<Health>(player, "Health")!;
    const invuln = world.getComponent<Invulnerable>(player, "Invulnerable");

    if (invuln && invuln.timer > 0) {
      invuln.timer -= deltaMS;
      if (invuln.timer <= 0) {
        world.addComponent(player, "Invulnerable", { timer: 0, duration: 0 });
      }
      continue;
    }

    for (const enemy of enemies) {
      const enemyPos = world.getComponent<Position>(enemy, "Position")!;
      const dx = playerPos.x - enemyPos.x;
      const dy = playerPos.y - enemyPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < COLLISION_RADIUS) {
        health.current -= PLAYER_DAMAGE;
        world.addComponent(player, "Invulnerable", {
          timer: INVULNERABILITY_DURATION,
          duration: INVULNERABILITY_DURATION,
        });
        break;
      }
    }
  }
}

export function checkDeath(world: World, onPlayerDeath?: () => void) {
  const players = world.query(["PlayerTag", "Health"]);
  for (const player of players) {
    const health = world.getComponent<Health>(player, "Health")!;
    if (health.current <= 0) {
      world.destroyEntity(player);
      if (onPlayerDeath) onPlayerDeath();
    }
  }
}
