import { World } from "../ecs/World";
import { Position, Velocity } from "../components";

export function movementSystem(world: World, deltaMS: number) {
  const dt = deltaMS / 1000;

  const movingEntities = world.query(["Position", "Velocity"]);

  for (const entity of movingEntities) {
    const pos = world.getComponent<Position>(entity, "Position")!;
    const vel = world.getComponent<Velocity>(entity, "Velocity")!;

    if (vel.vx === 0 && vel.vy === 0) continue;

    const length = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);

    if (length > 0) {
      const nx = vel.vx / length;
      const ny = vel.vy / length;

      pos.x += nx * vel.speed * dt;
      pos.y += ny * vel.speed * dt;
    }
  }
}
