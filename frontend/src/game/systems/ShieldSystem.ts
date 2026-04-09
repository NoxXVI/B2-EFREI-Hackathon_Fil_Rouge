import { World } from "../ecs/World";
import { type ShieldState } from "../components";

import { SHIELD_COOLDOWN_MS, SHIELD_DURATION_MS } from "../config/abilities";

export { SHIELD_COOLDOWN_MS, SHIELD_DURATION_MS };

let rightClickTriggered = false;

window.addEventListener("mousedown", (e) => {
  if (e.button === 2) {
    rightClickTriggered = true;
  }
});

window.addEventListener("blur", () => {
  rightClickTriggered = false;
});

export function shieldSystem(world: World, deltaMS: number) {
  const player = world.query(["PlayerTag", "LocalPlayerTag"])[0];
  if (player === undefined) return;

  const state =
    world.getComponent<ShieldState>(player, "ShieldState") ??
    ({
      activeMS: 0,
      cooldownMS: 0,
    } satisfies ShieldState);

  state.activeMS = Math.max(0, state.activeMS - deltaMS);
  state.cooldownMS = Math.max(0, state.cooldownMS - deltaMS);

  const pressed = rightClickTriggered;
  rightClickTriggered = false;

  if (pressed && state.cooldownMS <= 0 && state.activeMS <= 0) {
    state.activeMS = SHIELD_DURATION_MS;
    state.cooldownMS = SHIELD_COOLDOWN_MS;
  }

  world.addComponent(player, "ShieldState", state);
}

export function isShieldActive(world: World, entity: number): boolean {
  const shield = world.getComponent<ShieldState>(entity, "ShieldState");
  return !!shield && shield.activeMS > 0;
}
