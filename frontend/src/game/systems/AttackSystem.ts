import { World } from "../ecs/World";
import { Position, Velocity, Health } from "../components";

const PROJECTILE_SPEED = 8;
const PROJECTILE_DAMAGE = 1;
const PROJECTILE_LIFETIME = 60;

let mouseX = 0;
let mouseY = 0;
let attackTriggered = false;

window.addEventListener("mousemove", (e) => {
  const canvas = document.getElementById("pixi-container");
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  } else {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
});

window.addEventListener("mousedown", (e) => {
  if (e.button === 2) {
    attackTriggered = true;
  }
});

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

export function getAttackTriggered(): boolean {
  return attackTriggered;
}

export function resetAttackTrigger() {
  attackTriggered = false;
}

export function attackSystem(world: World) {
  if (!attackTriggered) return;
  const players = world.query(["PlayerTag", "Position"]);
  if (players.length === 0) return;

  const player = players[0];
  const playerPos = world.getComponent<Position>(player, "Position")!;

  const dx = mouseX - playerPos.x;
  const dy = mouseY - playerPos.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    resetAttackTrigger();
    return;
  }

  const dirX = dx / length;
  const dirY = dy / length;

  const projectile = world.createEntity();
  world.addComponent(projectile, "ProjectileTag", {});
  world.addComponent(projectile, "Position", {
    x: playerPos.x,
    y: playerPos.y,
  });
  world.addComponent(projectile, "Velocity", {
    vx: dirX,
    vy: dirY,
    speed: PROJECTILE_SPEED,
  });
  world.addComponent(projectile, "TimerComponent", {
    timeLeft: PROJECTILE_LIFETIME,
  });
  world.addComponent(projectile, "SpriteComponent", {
    width: 24,
    height: 24,
    anchor: 0.5,
  });

  console.log(
    "Projectile created at",
    playerPos.x,
    playerPos.y,
    "direction",
    dirX,
    dirY,
  );

  resetAttackTrigger();
}

export function projectileSystem(world: World) {
  const projectiles = world.query([
    "ProjectileTag",
    "Position",
    "Velocity",
    "TimerComponent",
  ]);

  console.log("Projectiles found:", projectiles.length);

  const enemies = world.query(["EnemyTag", "Position", "Health"]);

  for (const projectile of projectiles) {
    const pos = world.getComponent<Position>(projectile, "Position")!;
    const vel = world.getComponent<Velocity>(projectile, "Velocity")!;
    const timer = world.getComponent<{ timeLeft: number }>(
      projectile,
      "TimerComponent",
    )!;

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
        enemyHealth.current -= PROJECTILE_DAMAGE;
        world.destroyEntity(projectile);
        break;
      }
    }
  }
}

export function cleanupDeadEntities(world: World) {
  const enemies = world.query(["EnemyTag", "Health"]);
  for (const enemy of enemies) {
    const health = world.getComponent<Health>(enemy, "Health")!;
    if (health.current <= 0) {
      world.destroyEntity(enemy);
    }
  }
}
