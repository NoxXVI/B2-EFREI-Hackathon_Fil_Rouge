import { World } from "../ecs/World";
import { Velocity } from "../components";

const keys: { [key: string]: boolean } = {};

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

export function playerInputSystem(world: World) {
  const players = world.query(["PlayerTag", "Velocity"]);

  for (const player of players) {
    const vel = world.getComponent<Velocity>(player, "Velocity")!;

    let vx = 0;
    let vy = 0;

    if (keys["ArrowUp"] || keys["KeyW"] || keys["KeyZ"]) vy -= 1;
    if (keys["ArrowDown"] || keys["KeyS"]) vy += 1;
    if (keys["ArrowLeft"] || keys["KeyA"] || keys["KeyQ"]) vx -= 1;
    if (keys["ArrowRight"] || keys["KeyD"]) vx += 1;

    vel.vx = vx;
    vel.vy = vy;
  }
}
