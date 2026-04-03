import { World } from "../ecs/World";
import { Position, Velocity } from "../components";

const SEPARATION_DISTANCE = 30;
const SEPARATION_FORCE = 150;
const CELL_SIZE = SEPARATION_DISTANCE;
const SEP_DIST_SQ = SEPARATION_DISTANCE * SEPARATION_DISTANCE;

export function collisionAvoidanceSystem(world: World) {
  const entities = world.query(["Position", "Velocity", "EnemyTag"]);
  const enemies = entities.map((id) => ({
    id,
    pos: world.getComponent<Position>(id, "Position")!,
    vel: world.getComponent<Velocity>(id, "Velocity")!,
  }));

  const grid = new Map<string, Array<(typeof enemies)[number]>>();
  for (const e of enemies) {
    const cx = Math.floor(e.pos.x / CELL_SIZE);
    const cy = Math.floor(e.pos.y / CELL_SIZE);
    const key = `${cx},${cy}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(e);
    else grid.set(key, [e]);
  }

  for (const a of enemies) {
    const cx = Math.floor(a.pos.x / CELL_SIZE);
    const cy = Math.floor(a.pos.y / CELL_SIZE);

    let pushX = 0;
    let pushY = 0;

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const key = `${cx + ox},${cy + oy}`;
        const bucket = grid.get(key);
        if (!bucket) continue;

        for (const b of bucket) {
          if (a.id === b.id) continue;

          const dx = a.pos.x - b.pos.x;
          const dy = a.pos.y - b.pos.y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= 0 || distSq >= SEP_DIST_SQ) continue;

          const dist = Math.sqrt(distSq);
          const factor = (SEPARATION_DISTANCE - dist) / SEPARATION_DISTANCE;
          pushX += (dx / dist) * factor;
          pushY += (dy / dist) * factor;
        }
      }
    }

    if (pushX !== 0 || pushY !== 0) {
      const len = Math.sqrt(pushX * pushX + pushY * pushY);
      a.vel.vx += (pushX / len) * SEPARATION_FORCE;
      a.vel.vy += (pushY / len) * SEPARATION_FORCE;
    }
  }
}
