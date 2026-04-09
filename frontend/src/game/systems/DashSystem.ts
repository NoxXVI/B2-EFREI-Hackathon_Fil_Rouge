import { World } from "../ecs/World";
import {
  type DashState,
  type Invulnerable,
  type Velocity,
} from "../components";

import { DASH_COOLDOWN_MS, DASH_DURATION_MS } from "../config/abilities";

export { DASH_COOLDOWN_MS, DASH_DURATION_MS };

const keys: Record<string, boolean> = {};

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    keys.Space = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    keys.Space = false;
  }
});

let spaceWasDown = false;

function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len <= 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function dashSystem(world: World, deltaMS: number) {
  const player = world.query(["PlayerTag", "LocalPlayerTag", "Velocity"])[0];
  if (player === undefined) return;

  const vel = world.getComponent<Velocity>(player, "Velocity")!;

  const state =
    world.getComponent<DashState>(player, "DashState") ??
    ({
      activeMS: 0,
      cooldownMS: 0,
      dirX: 0,
      dirY: 0,
      lastDirX: 0,
      lastDirY: -1,
    } satisfies DashState);

  state.activeMS = Math.max(0, state.activeMS - deltaMS);
  state.cooldownMS = Math.max(0, state.cooldownMS - deltaMS);

  if (vel.vx !== 0 || vel.vy !== 0) {
    const n = normalize(vel.vx, vel.vy);
    state.lastDirX = n.x;
    state.lastDirY = n.y;
  }

  const spaceDown = !!keys.Space;
  const pressed = spaceDown && !spaceWasDown;
  spaceWasDown = spaceDown;

  if (pressed && state.cooldownMS <= 0 && state.activeMS <= 0) {
    const dashDir =
      state.lastDirX !== 0 || state.lastDirY !== 0
        ? normalize(state.lastDirX, state.lastDirY)
        : { x: 0, y: -1 };

    state.activeMS = DASH_DURATION_MS;
    state.cooldownMS = DASH_COOLDOWN_MS;
    state.dirX = dashDir.x;
    state.dirY = dashDir.y;

    const inv =
      world.getComponent<Invulnerable>(player, "Invulnerable") ??
      ({
        timer: 0,
        duration: 0,
      } satisfies Invulnerable);

    inv.timer = Math.max(inv.timer, DASH_DURATION_MS);
    inv.duration = Math.max(inv.duration, DASH_DURATION_MS);
    world.addComponent(player, "Invulnerable", inv);
  }

  if (state.activeMS > 0) {
    vel.vx = state.dirX;
    vel.vy = state.dirY;
  }

  world.addComponent(player, "DashState", state);
}
