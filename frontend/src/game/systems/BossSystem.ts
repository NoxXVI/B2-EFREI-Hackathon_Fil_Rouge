import { World } from "../ecs/World";
import {
  Position,
  Velocity,
  Health,
  Invulnerable,
  LaserStats,
  FollowTarget,
  TimerComponent,
} from "../components";
import { AnimationSystem } from "./AnimationSystem";
import { SpriteManifest } from "../components/Animation";
import spritesManifest from "../../assets/sprites_manifest.json";

const createBossManifest = (): SpriteManifest => ({
  walk: spritesManifest.boss_walk,
});

const BOSS_HEALTH = 50;
const BOSS_SPEED = 60;
const BOSS_STOP_DISTANCE = 200;
const LASER_DAMAGE = 1;
const LASER_COOLDOWN = 2000;
const LASER_DURATION = 3000;
const LASER_LENGTH = 2000;
const PLAYER_INVULNERABILITY_DURATION = 1500;

let lastAttackTime = 0;
let lastDamageTime = 0;
const DAMAGE_COOLDOWN = 500;

export function bossSystem(world: World, deltaMS: number) {
  const bosses = world.query(["BossTag", "Position", "Health"]);

  for (const boss of bosses) {
    const health = world.getComponent<Health>(boss, "Health");
    if (world.hasComponent(boss, "DeadTag") || !health || health.current <= 0) {
      continue;
    }

    const bossPos = world.getComponent<Position>(boss, "Position")!;

    const players = world.query(["PlayerTag", "Position", "Health"]);
    const player = players.find((entity) => {
      const health = world.getComponent<Health>(entity, "Health");
      return (
        !!health && !health.isDead && !world.hasComponent(entity, "DeadTag")
      );
    });
    if (player === undefined) continue;

    const playerPos = world.getComponent<Position>(player, "Position")!;
    const dx = playerPos.x - bossPos.x;
    const dy = playerPos.y - bossPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > BOSS_STOP_DISTANCE) {
      const dt = deltaMS / 1000;
      bossPos.x += (dx / dist) * BOSS_SPEED * dt;
      bossPos.y += (dy / dist) * BOSS_SPEED * dt;
    }

    const now = Date.now();
    if (now - lastAttackTime >= LASER_COOLDOWN) {
      const existingLasers = world.query(["LaserTag", "FollowTarget"]);
      for (const existingLaser of existingLasers) {
        const follow = world.getComponent<FollowTarget>(
          existingLaser,
          "FollowTarget",
        );
        if (follow?.entity === boss) {
          world.destroyEntity(existingLaser);
        }
      }

      for (let i = 0; i < 3; i++) {
        const angle = now / 1000 + (i * (Math.PI * 2)) / 3;
        const lx = Math.cos(angle);
        const ly = Math.sin(angle);

        const laser = world.createEntity();
        world.addComponent(laser, "LaserTag", {});
        world.addComponent(laser, "FollowTarget", { entity: boss });
        world.addComponent(laser, "Position", { x: bossPos.x, y: bossPos.y });
        world.addComponent(laser, "Velocity", { vx: lx, vy: ly, speed: 0 });
        world.addComponent(laser, "LaserStats", {
          length: LASER_LENGTH,
          damage: LASER_DAMAGE,
        });
        world.addComponent(laser, "TimerComponent", {
          timeLeft: LASER_DURATION,
        });
        world.addComponent(laser, "SpriteComponent", {
          width: 20,
          height: LASER_LENGTH,
          anchor: 0.5,
        });
      }
      lastAttackTime = now;
    }
  }
}

export function laserSystem(world: World, deltaMS: number) {
  const lasers = world.query([
    "LaserTag",
    "Position",
    "Velocity",
    "LaserStats",
    "TimerComponent",
  ]);
  const players = world.query(["PlayerTag", "Position", "Health"]);
  const player = players.find((entity) => {
    const health = world.getComponent<Health>(entity, "Health");
    return !!health && !health.isDead && !world.hasComponent(entity, "DeadTag");
  });
  const playerPos =
    player !== undefined
      ? world.getComponent<Position>(player, "Position")
      : undefined;
  const playerRadius = 24;

  for (const laser of lasers) {
    const followTarget = world.getComponent<FollowTarget>(
      laser,
      "FollowTarget",
    );
    if (!followTarget) {
      world.destroyEntity(laser);
      continue;
    }
    const laserPos = world.getComponent<Position>(laser, "Position")!;
    const laserVel = world.getComponent<Velocity>(laser, "Velocity")!;
    const laserStats = world.getComponent<LaserStats>(laser, "LaserStats")!;
    const timer = world.getComponent<TimerComponent>(laser, "TimerComponent")!;

    timer.timeLeft -= deltaMS;
    if (timer.timeLeft <= 0) {
      world.destroyEntity(laser);
      continue;
    }

    if (!world.entities.has(followTarget.entity)) {
      world.destroyEntity(laser);
      continue;
    }

    if (world.hasComponent(followTarget.entity, "DeadTag")) {
      world.destroyEntity(laser);
      continue;
    }

    const enemyPos = world.getComponent<Position>(
      followTarget.entity,
      "Position",
    );
    if (enemyPos) {
      laserPos.x = enemyPos.x;
      laserPos.y = enemyPos.y;
    }

    const vx = laserVel.vx;
    const vy = laserVel.vy;

    if (player === undefined || !playerPos) {
      continue;
    }

    const dx = playerPos.x - laserPos.x;
    const dy = playerPos.y - laserPos.y;

    const t = dx * vx + dy * vy;

    if (t < 0 || t > laserStats.length) continue;

    const closestX = laserPos.x + vx * t;
    const closestY = laserPos.y + vy * t;

    const distX = playerPos.x - closestX;
    const distY = playerPos.y - closestY;
    const dist = Math.sqrt(distX * distX + distY * distY);

    const now = Date.now();
    if (dist < playerRadius && now - lastDamageTime >= DAMAGE_COOLDOWN) {
      const playerHealth = world.getComponent<Health>(player, "Health");
      const playerInvulnerable = world.getComponent<Invulnerable>(
        player,
        "Invulnerable",
      );
      const isInvulnerable =
        !!playerInvulnerable && playerInvulnerable.timer > 0;

      if (
        playerHealth &&
        !playerHealth.isDead &&
        !world.hasComponent(player, "DeadTag") &&
        !isInvulnerable
      ) {
        playerHealth.current -= laserStats.damage;
        world.addComponent(player, "Invulnerable", {
          timer: PLAYER_INVULNERABILITY_DURATION,
          duration: PLAYER_INVULNERABILITY_DURATION,
        });
        lastDamageTime = now;
      }
    }
  }
}

export function spawnBoss(
  world: World,
  x: number,
  y: number,
  animationSystem?: AnimationSystem,
) {
  const boss = world.createEntity();
  world.addComponent(boss, "BossTag", {});
  world.addComponent(boss, "Position", { x, y });
  world.addComponent(boss, "Velocity", { vx: 0, vy: 0, speed: BOSS_SPEED });
  world.addComponent(boss, "Health", {
    current: BOSS_HEALTH,
    max: BOSS_HEALTH,
    isDead: false,
  });
  world.addComponent(boss, "SpriteComponent", {
    width: 96,
    height: 96,
    anchor: 0.5,
  });

  if (animationSystem) {
    void animationSystem.loadAnimations(boss, createBossManifest(), {
      walk: { speed: 8, loop: true },
    });
  }

  return boss;
}

export function cleanupLaserEntities(world: World) {
  const lasers = world.query(["LaserTag"]);
  for (const laser of lasers) {
    const timer = world.getComponent<TimerComponent>(laser, "TimerComponent");
    if (timer && timer.timeLeft <= 0) {
      world.destroyEntity(laser);
    }
  }
}
