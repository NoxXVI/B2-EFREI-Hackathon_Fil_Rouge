import { World } from "../ecs/World";
import {
  type Bomb,
  type BombThrower,
  type Health,
  type Position,
  type SpriteComponent,
} from "../components";
import { isWalkableTile, type GeneratedMap } from "./MapData";

const BASE_BOMB_FUSE_MS = 1350;
const BASE_BOMB_RADIUS = 96;
const BASE_THROW_COOLDOWN_MS = 2600;
const MIN_THROW_COOLDOWN_MS = 1400;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pickBombTargetPixels(
  map: GeneratedMap,
  playerPos: Position,
): [number, number] {
  const tileSize = map.tileSize;
  const cols = map.cols;
  const rows = map.rows;
  const grid = map.grid;

  const playerTileX = clamp(Math.floor(playerPos.x / tileSize), 1, cols - 2);
  const playerTileY = clamp(Math.floor(playerPos.y / tileSize), 1, rows - 2);

  for (let attempt = 0; attempt < 18; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distTiles = 2 + Math.random() * 2.2;
    const tx = clamp(
      playerTileX + Math.round(Math.cos(angle) * distTiles),
      1,
      cols - 2,
    );
    const ty = clamp(
      playerTileY + Math.round(Math.sin(angle) * distTiles),
      1,
      rows - 2,
    );

    if (!isWalkableTile(grid[ty]?.[tx])) continue;

    const jitterX = (Math.random() - 0.5) * tileSize * 0.5;
    const jitterY = (Math.random() - 0.5) * tileSize * 0.5;
    return [
      tx * tileSize + tileSize / 2 + jitterX,
      ty * tileSize + tileSize / 2 + jitterY,
    ];
  }

  return [
    playerPos.x + (Math.random() - 0.5) * tileSize,
    playerPos.y + (Math.random() - 0.5) * tileSize,
  ];
}

export function bombThrowerSystem(
  world: World,
  deltaMS: number,
  map: GeneratedMap,
  level: number,
) {
  const players = world.query(["PlayerTag", "LocalPlayerTag", "Position"]);
  if (players.length === 0) return;
  const player = players[0]!;
  const playerPos = world.getComponent<Position>(player, "Position");
  if (!playerPos) return;

  let bombsAlive = world.query(["BombTag"]).length;
  const throwers = world.query(["EnemyTag", "BombThrower", "Position"]);

  for (const thrower of throwers) {
    const health = world.getComponent<Health>(thrower, "Health");
    if (!health || health.isDead || world.hasComponent(thrower, "DeadTag")) {
      continue;
    }

    const bombThrower = world.getComponent<BombThrower>(
      thrower,
      "BombThrower",
    )!;

    bombThrower.cooldownMS = Math.max(0, bombThrower.cooldownMS - deltaMS);
    if (bombThrower.cooldownMS > 0) {
      world.addComponent(thrower, "BombThrower", bombThrower);
      continue;
    }

    if (bombsAlive >= 18) {
      bombThrower.cooldownMS = 600 + Math.random() * 700;
      world.addComponent(thrower, "BombThrower", bombThrower);
      continue;
    }

    const throwerPos = world.getComponent<Position>(thrower, "Position");
    if (!throwerPos) continue;
    const dx = throwerPos.x - playerPos.x;
    const dy = throwerPos.y - playerPos.y;
    const distSq = dx * dx + dy * dy;

    // Evite le spam hors-champ: le thrower doit être "dans la zone".
    if (distSq > 650 * 650) {
      bombThrower.cooldownMS = 400 + Math.random() * 400;
      world.addComponent(thrower, "BombThrower", bombThrower);
      continue;
    }

    const [bx, by] = pickBombTargetPixels(map, playerPos);

    const damage = clamp(1 + Math.floor((level - 1) / 35), 1, 2);
    const fuseMS = clamp(
      BASE_BOMB_FUSE_MS - Math.floor((level - 1) / 20) * 40,
      950,
      BASE_BOMB_FUSE_MS,
    );
    const radius = clamp(
      BASE_BOMB_RADIUS + Math.floor((level - 1) / 25) * 6,
      BASE_BOMB_RADIUS,
      120,
    );

    const bomb = world.createEntity();
    world.addComponent(bomb, "BombTag", {});
    world.addComponent<Position>(bomb, "Position", { x: bx, y: by });
    world.addComponent<SpriteComponent>(bomb, "SpriteComponent", {
      width: 30,
      height: 30,
      anchor: 0.5,
    });
    world.addComponent<Bomb>(bomb, "Bomb", {
      owner: thrower,
      fuseMS,
      radius,
      damage,
    });
    bombsAlive++;

    const scaledCooldown = clamp(
      BASE_THROW_COOLDOWN_MS - Math.floor((level - 1) / 10) * 90,
      MIN_THROW_COOLDOWN_MS,
      BASE_THROW_COOLDOWN_MS,
    );
    bombThrower.cooldownMS = scaledCooldown + Math.random() * 500;
    world.addComponent(thrower, "BombThrower", bombThrower);
  }
}
