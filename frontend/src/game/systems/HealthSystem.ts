import { World } from "../ecs/World";
import {
  Position,
  Health,
  Invulnerable,
  type ShieldState,
  type ContactDamage,
} from "../components";
import { grantEnemyXp } from "./PlayerProgressSystem";
import { addLocalKills } from "./ScoreSystem";

const PLAYER_DAMAGE = 1;
const INVULNERABILITY_DURATION = 1500;
const COLLISION_RADIUS = 30;
const DEATH_ANIMATION_DURATION = 2000;

export function healthSystem(world: World, deltaMS: number) {
  const players = world.query(["PlayerTag", "Position", "Health"]);
  const enemies = world.query(["EnemyTag", "Position", "Health"]);

  for (const player of players) {
    const playerPos = world.getComponent<Position>(player, "Position")!;
    const health = world.getComponent<Health>(player, "Health")!;
    if (health.isDead || world.hasComponent(player, "DeadTag")) continue;

    const invuln = world.getComponent<Invulnerable>(player, "Invulnerable");

    if (invuln && invuln.timer > 0) {
      invuln.timer -= deltaMS;
      if (invuln.timer <= 0) {
        world.addComponent(player, "Invulnerable", { timer: 0, duration: 0 });
      }
      continue;
    }

    const shield = world.getComponent<ShieldState>(player, "ShieldState");
    if (shield && shield.activeMS > 0) {
      continue;
    }

    for (const enemy of enemies) {
      const enemyPos = world.getComponent<Position>(enemy, "Position")!;
      const enemyHealth = world.getComponent<Health>(enemy, "Health")!;
      if (enemyHealth.isDead || world.hasComponent(enemy, "DeadTag")) continue;

      const contact = world.getComponent<ContactDamage>(enemy, "ContactDamage");
      const radius = contact?.radius ?? COLLISION_RADIUS;
      const damage = contact?.amount ?? PLAYER_DAMAGE;

      const dx = playerPos.x - enemyPos.x;
      const dy = playerPos.y - enemyPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        health.current -= damage;
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
    if (health.current <= 0 && !health.isDead) {
      health.isDead = true;
      world.addComponent(player, "DeadTag", {});
      world.addComponent(player, "TimerComponent", {
        timeLeft: DEATH_ANIMATION_DURATION,
      });
      world.addComponent(player, "Velocity", { vx: 0, vy: 0, speed: 0 });
    }
  }

  const deadPlayers = world.query(["PlayerTag", "DeadTag", "TimerComponent"]);
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

  const enemies = world.query(["EnemyTag", "Health"]);
  for (const enemy of enemies) {
    const health = world.getComponent<Health>(enemy, "Health")!;
    if (health.current <= 0 && !health.isDead) {
      health.isDead = true;
      grantEnemyXp(world, 1);
      addLocalKills(world, 1);
      world.addComponent(enemy, "DeadTag", {});
      world.addComponent(enemy, "TimerComponent", {
        timeLeft: 250,
      });
    }
  }

  const deadEnemies = world.query(["EnemyTag", "DeadTag", "TimerComponent"]);
  for (const enemy of deadEnemies) {
    const timer = world.getComponent<{ timeLeft: number }>(
      enemy,
      "TimerComponent",
    )!;
    timer.timeLeft -= 16;
    if (timer.timeLeft <= 0) {
      world.destroyEntity(enemy);
    }
  }

  const bosses = world.query(["BossTag", "Health"]);
  for (const boss of bosses) {
    const health = world.getComponent<Health>(boss, "Health")!;
    if (health.current <= 0 && !health.isDead) {
      health.isDead = true;
      grantEnemyXp(world, 10);
      addLocalKills(world, 10);
      world.addComponent(boss, "DeadTag", {});
      world.addComponent(boss, "TimerComponent", {
        timeLeft: 500,
      });
    }
  }

  const deadBosses = world.query(["BossTag", "DeadTag", "TimerComponent"]);
  for (const boss of deadBosses) {
    const timer = world.getComponent<{ timeLeft: number }>(
      boss,
      "TimerComponent",
    )!;
    timer.timeLeft -= 16;
    if (timer.timeLeft <= 0) {
      world.destroyEntity(boss);
    }
  }
}
