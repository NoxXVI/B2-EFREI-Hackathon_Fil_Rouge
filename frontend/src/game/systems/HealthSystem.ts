import { World } from "../ecs/World";
import { Position, Health, Invulnerable } from "../components";

const PLAYER_DAMAGE = 1;
const INVULNERABILITY_DURATION = 1500;
const COLLISION_RADIUS = 30;
const DEATH_ANIMATION_DURATION = 2000;

export function healthSystem(world: World, deltaMS: number) {
  const players = world.query(["PlayerTag", "Position", "Health"]);
  const enemies = world.query(["EnemyTag", "Position"]);

  for (const player of players) {
    if (world.hasComponent(player, "DeadTag")) continue;

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
      if (world.hasComponent(enemy, "DeadTag")) continue;

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

export function checkDeath(world: World) {
  const players = world.query(["PlayerTag", "Health"]);
  for (const player of players) {
    const health = world.getComponent<Health>(player, "Health")!;
    if (health.current <= 0 && !world.hasComponent(player, "DeadTag")) {
      world.addComponent(player, "DeadTag", {});
      world.addComponent(player, "TimerComponent", {
        timeLeft: DEATH_ANIMATION_DURATION,
      });
      world.addComponent(player, "Velocity", { vx: 0, vy: 0, speed: 0 });
    }
  }

  const deadPlayers = world.query(["DeadTag", "TimerComponent"]);
  for (const entity of deadPlayers) {
    const timer = world.getComponent<{ timeLeft: number }>(
      entity,
      "TimerComponent",
    )!;
    timer.timeLeft -= 16;
    if (timer.timeLeft <= 0) {
      world.destroyEntity(entity);
    }
  }
}
