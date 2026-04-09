import { World } from "../ecs/World";
import {
  type HazardCooldown,
  type Health,
  type Invulnerable,
  type Position,
  type ShieldState,
} from "../components";
import { TILE_LAVA, type MapTheme } from "./MapData";

const VOLCANIC_LAVA_DAMAGE = 1;
const VOLCANIC_LAVA_COOLDOWN_MS = 3500;
const VOLCANIC_LAVA_SCAN_RADIUS_TILES = 1;
const VOLCANIC_INVULNERABILITY_MS = 900;

type HazardMapInfo = {
  theme: MapTheme;
  grid: number[][];
  tileSize: number;
};

export function environmentHazardSystem(
  world: World,
  deltaMS: number,
  map: HazardMapInfo,
) {
  const players = world.query(["PlayerTag", "Position", "Health"]);
  if (players.length === 0) return;

  for (const player of players) {
    if (world.hasComponent(player, "DeadTag")) continue;
    const health = world.getComponent<Health>(player, "Health");
    if (!health || health.isDead || health.current <= 0) continue;

    const cooldown =
      world.getComponent<HazardCooldown>(player, "HazardCooldown") ??
      ({
        timer: 0,
      } satisfies HazardCooldown);

    cooldown.timer = Math.max(0, cooldown.timer - deltaMS);
    world.addComponent(player, "HazardCooldown", cooldown);

    if (map.theme !== "volcanic") continue;
    if (cooldown.timer > 0) continue;

    const inv = world.getComponent<Invulnerable>(player, "Invulnerable");
    if (inv && inv.timer > 0) continue;

    const shield = world.getComponent<ShieldState>(player, "ShieldState");
    if (shield && shield.activeMS > 0) continue;

    const pos = world.getComponent<Position>(player, "Position");
    if (!pos) continue;

    const tileX = Math.floor(pos.x / map.tileSize);
    const tileY = Math.floor(pos.y / map.tileSize);

    let nearLava = false;
    for (
      let oy = -VOLCANIC_LAVA_SCAN_RADIUS_TILES;
      oy <= VOLCANIC_LAVA_SCAN_RADIUS_TILES;
      oy++
    ) {
      const y = tileY + oy;
      const row = map.grid[y];
      if (!row) continue;

      for (
        let ox = -VOLCANIC_LAVA_SCAN_RADIUS_TILES;
        ox <= VOLCANIC_LAVA_SCAN_RADIUS_TILES;
        ox++
      ) {
        const x = tileX + ox;
        if (row[x] === TILE_LAVA) {
          nearLava = true;
          break;
        }
      }
      if (nearLava) break;
    }

    if (!nearLava) continue;

    health.current -= VOLCANIC_LAVA_DAMAGE;
    world.addComponent(player, "Invulnerable", {
      timer: VOLCANIC_INVULNERABILITY_MS,
      duration: VOLCANIC_INVULNERABILITY_MS,
    });
    world.addComponent(player, "HazardCooldown", {
      timer: VOLCANIC_LAVA_COOLDOWN_MS,
    });
  }
}
