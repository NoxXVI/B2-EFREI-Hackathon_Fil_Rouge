import { World } from "../ecs/World";
import { type DashState, Position, Velocity } from "../components";
import { DASH_SPEED } from "../config/abilities";

export function movementSystem(world: World, deltaMS: number) {
  const dt = deltaMS / 1000;

  const movingEntities = world.query(["Position", "Velocity"]);

  for (const entity of movingEntities) {
    const pos = world.getComponent<Position>(entity, "Position")!;
    const vel = world.getComponent<Velocity>(entity, "Velocity")!;
    const dash = world.getComponent<DashState>(entity, "DashState");
    const speed = dash && dash.activeMS > 0 ? DASH_SPEED : vel.speed;

    if (vel.vx === 0 && vel.vy === 0) continue;

    const length = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);

    if (length > 0) {
      const nx = vel.vx / length;
      const ny = vel.vy / length;

      pos.x += nx * speed * dt;
      pos.y += ny * speed * dt;
    }
  }
}
