import { World } from "../ecs/World";
import { Position, Velocity } from "../components";

const SEPARATION_DISTANCE = 30;
const SEPARATION_FORCE = 150;

export function collisionAvoidanceSystem(world: World) {
  const entities = world.query(["Position", "Velocity", "EnemyTag"]);
  const positions = entities.map((id) => ({
    id,
    pos: world.getComponent<Position>(id, "Position")!,
    vel: world.getComponent<Velocity>(id, "Velocity")!,
  }));

  for (let i = 0; i < positions.length; i++) {
    const a = positions[i];
    let pushX = 0;
    let pushY = 0;

    for (let j = 0; j < positions.length; j++) {
      if (i === j) continue;

      const b = positions[j];
      const dx = a.pos.x - b.pos.x;
      const dy = a.pos.y - b.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < SEPARATION_DISTANCE && dist > 0) {
        const factor = (SEPARATION_DISTANCE - dist) / SEPARATION_DISTANCE;
        pushX += (dx / dist) * factor;
        pushY += (dy / dist) * factor;
      }
    }

    if (pushX !== 0 || pushY !== 0) {
      const len = Math.sqrt(pushX * pushX + pushY * pushY);
      a.vel.vx += (pushX / len) * SEPARATION_FORCE;
      a.vel.vy += (pushY / len) * SEPARATION_FORCE;
    }
  }
}
