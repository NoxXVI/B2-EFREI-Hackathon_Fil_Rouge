import { World } from "../ecs/World";
import {
  Position,
  Velocity,
  Health,
  CombatStats,
  type ProjectileAppearance,
  ProjectileStats,
  type WeaponState,
} from "../components";
import { getWeaponSpec } from "../config/weapons";

const ATTACK_ANIMATION_HOLD_MS = 600;
const MAX_PROJECTILES_PER_SHOT = 9;
const FALLBACK_PROJECTILE_DAMAGE = 1;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

let mouseX = 0;
let mouseY = 0;
let attackHeld = false;
let attackCooldown = 0;
let cameraX = 0;
let cameraY = 0;
let attackAnimTimer = 0;

export function setCameraOffset(x: number, y: number) {
  cameraX = x;
  cameraY = y;
}

function updateMousePosition(e: MouseEvent) {
  const container = document.getElementById("pixi-container");
  if (container) {
    const rect = container.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  } else {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
}

window.addEventListener("mousemove", (e) => {
  updateMousePosition(e);
});

window.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    attackHeld = true;
    updateMousePosition(e);
  }
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    attackHeld = false;
  }
});

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

export function getAttackTriggered(): boolean {
  return attackAnimTimer > 0;
}

export function resetAttackTrigger() {
  attackAnimTimer = 0;
}

export function attackSystem(world: World, deltaMS: number) {
  attackCooldown = Math.max(0, attackCooldown - deltaMS);
  attackAnimTimer = Math.max(0, attackAnimTimer - deltaMS);
  if (!attackHeld || attackCooldown > 0) return;

  const players = world.query([
    "PlayerTag",
    "LocalPlayerTag",
    "Position",
    "CombatStats",
  ]);
  if (players.length === 0) return;

  const player = players[0];
  const playerPos = world.getComponent<Position>(player, "Position")!;
  const combatStats = world.getComponent<CombatStats>(
    player,
    "CombatStats",
  ) ?? {
    fireRateMultiplier: 1,
    damageBonus: 0,
    multishot: 1,
    critChance: 0,
    critMultiplier: 1.5,
    homingStrength: 0,
  };

  const weaponState = world.getComponent<WeaponState>(player, "WeaponState");
  const weapon = getWeaponSpec(weaponState?.type ?? "bow");

  const targetX = mouseX + cameraX;
  const targetY = mouseY + cameraY;
  const dx = targetX - playerPos.x;
  const dy = targetY - playerPos.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return;
  }

  const dirX = dx / length;
  const dirY = dy / length;

  const upgradeExtraShots = Math.max(0, Math.floor(combatStats.multishot) - 1);
  const projectileCount = Math.min(
    MAX_PROJECTILES_PER_SHOT,
    Math.max(1, weapon.baseMultishot + upgradeExtraShots),
  );
  const spread =
    projectileCount > 1 ? (weapon.spreadRad > 0 ? weapon.spreadRad : 0.18) : 0;

  const damage = weapon.baseDamage + combatStats.damageBonus;
  const homingStrength = clamp(
    combatStats.homingStrength + weapon.homingBonus,
    0,
    0.35,
  );

  for (let i = 0; i < projectileCount; i++) {
    const offset =
      projectileCount === 1 ? 0 : (i - (projectileCount - 1) / 2) * spread;
    const rotatedX = dirX * Math.cos(offset) - dirY * Math.sin(offset);
    const rotatedY = dirX * Math.sin(offset) + dirY * Math.cos(offset);

    const projectile = world.createEntity();
    world.addComponent(projectile, "ProjectileTag", {});
    world.addComponent(projectile, "Position", {
      x: playerPos.x,
      y: playerPos.y,
    });
    world.addComponent<ProjectileStats>(projectile, "ProjectileStats", {
      damage,
      critChance: combatStats.critChance,
      critMultiplier: combatStats.critMultiplier,
      homingStrength,
    });
    world.addComponent<ProjectileAppearance>(
      projectile,
      "ProjectileAppearance",
      {
        texture: weapon.projectileTexture,
        tint: weapon.projectileTint,
      },
    );
    world.addComponent(projectile, "Velocity", {
      vx: rotatedX,
      vy: rotatedY,
      speed: weapon.projectileSpeed,
    });
    world.addComponent(projectile, "TimerComponent", {
      timeLeft: weapon.projectileLifetimeFrames,
    });
    world.addComponent(projectile, "SpriteComponent", {
      width: weapon.projectileSize,
      height: weapon.projectileSize,
      anchor: 0.5,
    });
  }

  attackCooldown = Math.max(
    60,
    weapon.baseCooldownMS * combatStats.fireRateMultiplier,
  );
  attackAnimTimer = ATTACK_ANIMATION_HOLD_MS;
}

export function projectileSystem(world: World) {
  const projectiles = world.query([
    "ProjectileTag",
    "Position",
    "Velocity",
    "TimerComponent",
  ]);

  const enemies = world
    .query(["EnemyTag", "Position", "Health"])
    .filter((enemy) => {
      const health = world.getComponent<Health>(enemy, "Health");
      return (
        !!health && !health.isDead && !world.hasComponent(enemy, "DeadTag")
      );
    });

  for (const projectile of projectiles) {
    const pos = world.getComponent<Position>(projectile, "Position")!;
    const vel = world.getComponent<Velocity>(projectile, "Velocity")!;
    const timer = world.getComponent<{ timeLeft: number }>(
      projectile,
      "TimerComponent",
    )!;
    const projectileStats = world.getComponent<ProjectileStats>(
      projectile,
      "ProjectileStats",
    );

    if (
      projectileStats &&
      projectileStats.homingStrength > 0 &&
      enemies.length > 0
    ) {
      let closestEnemy = enemies[0];
      let closestDist = Number.POSITIVE_INFINITY;
      for (const enemy of enemies) {
        const enemyPos = world.getComponent<Position>(enemy, "Position")!;
        const dx = enemyPos.x - pos.x;
        const dy = enemyPos.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestEnemy = enemy;
        }
      }

      const targetPos = world.getComponent<Position>(closestEnemy, "Position")!;
      const tx = targetPos.x - pos.x;
      const ty = targetPos.y - pos.y;
      const targetLength = Math.sqrt(tx * tx + ty * ty);
      if (targetLength > 0) {
        const targetNx = tx / targetLength;
        const targetNy = ty / targetLength;
        vel.vx =
          vel.vx * (1 - projectileStats.homingStrength) +
          targetNx * projectileStats.homingStrength;
        vel.vy =
          vel.vy * (1 - projectileStats.homingStrength) +
          targetNy * projectileStats.homingStrength;
      }
    }

    pos.x += vel.vx * vel.speed;
    pos.y += vel.vy * vel.speed;

    timer.timeLeft -= 1;

    if (timer.timeLeft <= 0) {
      world.destroyEntity(projectile);
      continue;
    }

    for (const enemy of enemies) {
      const enemyPos = world.getComponent<Position>(enemy, "Position")!;
      const enemyHealth = world.getComponent<Health>(enemy, "Health")!;

      const dx = pos.x - enemyPos.x;
      const dy = pos.y - enemyPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 25) {
        const baseDamage =
          projectileStats?.damage ?? FALLBACK_PROJECTILE_DAMAGE;
        const crit =
          projectileStats && Math.random() < projectileStats.critChance;
        const damage = crit
          ? Math.floor(baseDamage * (projectileStats?.critMultiplier ?? 1.5))
          : baseDamage;
        enemyHealth.current -= damage;
        world.destroyEntity(projectile);
        break;
      }
    }

    for (const boss of world.query(["BossTag", "Position", "Health"])) {
      const bossPos = world.getComponent<Position>(boss, "Position")!;
      const bossHealth = world.getComponent<Health>(boss, "Health")!;

      const dx = pos.x - bossPos.x;
      const dy = pos.y - bossPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 50) {
        const baseDamage =
          projectileStats?.damage ?? FALLBACK_PROJECTILE_DAMAGE;
        bossHealth.current -= baseDamage;
        world.destroyEntity(projectile);
        break;
      }
    }
  }
}
