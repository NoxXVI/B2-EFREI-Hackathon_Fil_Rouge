import { World } from "./ecs/World";
import { movementSystem } from "./systems/MovementSystem";
import { enemyFollowSystem } from "./systems/EnemyFollowSystem";
import { playerInputSystem } from "./systems/PlayerInputSystem";
import { collisionAvoidanceSystem } from "./systems/CollisionAvoidanceSystem";
import { healthSystem, checkDeath } from "./systems/HealthSystem";
import { ensurePlayerProgress } from "./systems/PlayerProgressSystem";
import {
  attackSystem,
  getAttackTriggered,
  projectileSystem,
} from "./systems/AttackSystem";
import {
  bossSystem,
  laserSystem,
  cleanupLaserEntities,
  spawnBoss,
} from "./systems/BossSystem";
import { AnimationSystem } from "./systems/AnimationSystem";
import { TilemapSystem } from "./systems/TilemapSystem"; // ← NOUVEAU
import {
  Position,
  Velocity,
  SpriteComponent,
  Health,
  type PlayerAppearance,
  type PlayerProgress,
} from "./components";
import { SpriteManifest } from "./components/Animation";
import spritesManifest from "../assets/sprites_manifest.json";
import {
  generateMap,
  getMapThemeForLevel,
  isWalkableTile,
  type GeneratedMap,
  type MapTheme,
} from "./systems/MapData"; // ← NOUVEAU

const BASE_SPAWN_INTERVAL_MS = 1500;
const MIN_SPAWN_INTERVAL_MS = 450;
const SPAWN_INTERVAL_DECAY_MS_PER_LEVEL = 35;

const BASE_MAX_ENEMIES = 25;
const MIN_ADDED_ENEMIES_PER_LEVEL = 15;
const MAX_ADDED_ENEMIES_PER_LEVEL = 30;
const MAX_ENEMIES_CAP = 600;

const BASE_SPAWNS_PER_TICK = 3;
const MAX_SPAWNS_PER_TICK = 12;

function addedEnemiesForLevel(level: number): number {
  // Déterministe (pas "vraiment" random) => stable par level.
  const safeLevel = Math.max(1, Math.floor(level));
  const range = MAX_ADDED_ENEMIES_PER_LEVEL - MIN_ADDED_ENEMIES_PER_LEVEL + 1;

  let h = (Math.imul(safeLevel, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  const r = h / 0xffffffff;

  return MIN_ADDED_ENEMIES_PER_LEVEL + Math.floor(r * range);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const createSoldierManifest = (): SpriteManifest => ({
  idle: spritesManifest.soldier_walk.slice(0, 1),
  walk: spritesManifest.soldier_walk,
  attack: spritesManifest.soldier_attack,
  death: spritesManifest.soldier_death,
});

const createOrcManifest = (): SpriteManifest => ({
  walk: spritesManifest.orc_walk,
});

export class GameEngine {
  public world: World;
  public animationSystem: AnimationSystem;
  public tilemapSystem: TilemapSystem; // ← NOUVEAU
  private currentMap: GeneratedMap;
  private readonly remotePlayerEntities = new Map<string, number>();
  private readonly initPromise: Promise<void>;
  private pendingLocalAppearance: { name: string; color: number } | null = null;
  private pendingLocalNetworkId: string | null = null;
  private spawnableFloorTiles: Array<[number, number]>;
  private spawnTimer = 0;
  private spawnIndex = 0; // ← pour tourner sur les spawn points
  private bossSpawnTimerMS = 3000;
  private bossSpawned = false;
  private cachedMaxEnemiesLevel = 0;
  private cachedMaxEnemiesValue = BASE_MAX_ENEMIES;

  constructor() {
    this.world = new World();
    this.animationSystem = new AnimationSystem();
    this.tilemapSystem = new TilemapSystem(); // ← NOUVEAU
    this.currentMap = generateMap(getMapThemeForLevel(1));
    this.spawnableFloorTiles = this.buildSpawnableFloorTiles(this.currentMap);
    this.initPromise = this.initGame();
  }

  get mapTheme(): MapTheme {
    return this.currentMap.theme;
  }

  get mapInfo() {
    return {
      theme: this.currentMap.theme,
      name: this.currentMap.name,
      description: this.currentMap.description,
    };
  }

  async changeMap(theme: MapTheme, level: number) {
    await this.initPromise;
    const safeLevel = Math.max(1, Math.floor(level));
    const nextMap = generateMap(theme);

    this.currentMap = nextMap;
    this.spawnableFloorTiles = this.buildSpawnableFloorTiles(nextMap);
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.bossSpawnTimerMS = 3000;
    this.bossSpawned = false;

    await this.tilemapSystem.loadMap(nextMap);

    // Téléporte le joueur sur le spawn de la nouvelle map
    const player = this.getLocalPlayerEntity();
    if (player !== null) {
      const pos = this.world.getComponent<Position>(player, "Position")!;
      pos.x = nextMap.playerSpawn[0];
      pos.y = nextMap.playerSpawn[1];
      const vel = this.world.getComponent<Velocity>(player, "Velocity");
      if (vel) {
        vel.vx = 0;
        vel.vy = 0;
      }
    }

    // Nettoie ennemis + projectiles pour éviter les positions hors-map
    for (const enemy of this.world.query(["EnemyTag"])) {
      this.world.destroyEntity(enemy);
    }
    for (const proj of this.world.query(["ProjectileTag"])) {
      this.world.destroyEntity(proj);
    }
    for (const boss of this.world.query(["BossTag"])) {
      this.world.destroyEntity(boss);
    }
    for (const laser of this.world.query(["LaserTag"])) {
      this.world.destroyEntity(laser);
    }

    // Respawn d'un pack initial adapté au level actuel
    const settings = this.getSpawnSettings(safeLevel);
    const initialEnemies = Math.min(settings.maxEnemies, 20);
    for (let i = 0; i < initialEnemies; i++) {
      await this.spawnOrc(settings.maxEnemies, safeLevel);
    }
  }

  async initGame() {
    // Construction de la map (async, charge le tileset)
    await this.tilemapSystem.loadMap(this.currentMap); // ← NOUVEAU

    // Joueur spawn sur le point de spawn de la map
    const player = this.world.createEntity();
    this.world.addComponent(player, "PlayerTag", {});
    this.world.addComponent(player, "LocalPlayerTag", {});
    this.world.addComponent<Position>(player, "Position", {
      x: this.currentMap.playerSpawn[0], // ← utilise le spawn de la map
      y: this.currentMap.playerSpawn[1],
    });
    this.world.addComponent<Velocity>(player, "Velocity", {
      vx: 0,
      vy: 0,
      speed: 200,
    });
    this.world.addComponent<Health>(player, "Health", {
      current: 3,
      max: 3,
      isDead: false,
    });
    this.world.addComponent<SpriteComponent>(player, "SpriteComponent", {
      width: 48,
      height: 48,
      anchor: 0.5,
    });
    this.world.addComponent<PlayerAppearance>(player, "PlayerAppearance", {
      name: "You",
      color: 0xffffff,
    });

    if (this.pendingLocalAppearance) {
      const { name, color } = this.pendingLocalAppearance;
      this.pendingLocalAppearance = null;
      this.setLocalPlayerAppearance(name, color);
    }
    if (this.pendingLocalNetworkId) {
      const id = this.pendingLocalNetworkId;
      this.pendingLocalNetworkId = null;
      this.setLocalNetworkId(id);
    }

    await this.animationSystem.loadAnimations(player, createSoldierManifest(), {
      idle: { speed: 1, loop: true },
      walk: { speed: 10, loop: true },
      attack: { speed: 15, loop: false },
      death: { speed: 8, loop: false },
    });

    ensurePlayerProgress(this.world);

    // Spawn des ennemis initiaux sur les points de spawn de la map
    const level = this.getCurrentLevel();
    const settings = this.getSpawnSettings(level);
    const initialEnemies = Math.min(settings.maxEnemies, 20);
    for (let i = 0; i < initialEnemies; i++) {
      await this.spawnOrc(settings.maxEnemies, level);
    }
  }

  getLocalPlayerEntity(): number | null {
    return this.world.query(["PlayerTag", "LocalPlayerTag"])[0] ?? null;
  }

  setLocalPlayerAppearance(name: string, color: number) {
    const player = this.getLocalPlayerEntity();
    if (player === null) {
      this.pendingLocalAppearance = { name, color };
      return;
    }

    if (!this.world.hasComponent(player, "PlayerAppearance")) {
      this.world.addComponent<PlayerAppearance>(player, "PlayerAppearance", {
        name,
        color,
      });
      return;
    }

    const appearance = this.world.getComponent<PlayerAppearance>(
      player,
      "PlayerAppearance",
    )!;
    appearance.name = name;
    appearance.color = color;
  }

  setLocalNetworkId(id: string) {
    const player = this.getLocalPlayerEntity();
    if (player === null) {
      this.pendingLocalNetworkId = id;
      return;
    }
    this.world.addComponent(player, "NetworkPlayer", { id });
  }

  upsertRemotePlayer(data: {
    id: string;
    name: string;
    color: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
  }) {
    const networkId = data.id;
    if (!networkId) return;

    let entity = this.remotePlayerEntities.get(networkId);
    if (
      entity === undefined ||
      !this.world.hasComponent(entity, "RemotePlayerTag")
    ) {
      entity = this.world.createEntity();
      this.remotePlayerEntities.set(networkId, entity);

      this.world.addComponent(entity, "PlayerTag", {});
      this.world.addComponent(entity, "RemotePlayerTag", {});
      this.world.addComponent(entity, "NetworkPlayer", { id: networkId });
      this.world.addComponent<Position>(entity, "Position", {
        x: data.x,
        y: data.y,
      });
      this.world.addComponent<Velocity>(entity, "Velocity", {
        vx: data.vx,
        vy: data.vy,
        speed: 0,
      });
      this.world.addComponent<SpriteComponent>(entity, "SpriteComponent", {
        width: 48,
        height: 48,
        anchor: 0.5,
      });
      this.world.addComponent<PlayerAppearance>(entity, "PlayerAppearance", {
        name: data.name,
        color: data.color,
      });

      if (!this.animationSystem.hasAnimation(entity)) {
        void this.animationSystem
          .loadAnimations(entity, createSoldierManifest(), {
            idle: { speed: 1, loop: true },
            walk: { speed: 10, loop: true },
            attack: { speed: 15, loop: true },
            death: { speed: 8, loop: false },
          })
          .catch((err) => {
            console.warn(
              "[GameEngine] Failed to load remote player anims",
              err,
            );
          });
      }
    }

    const pos = this.world.getComponent<Position>(entity, "Position");
    if (pos) {
      pos.x = data.x;
      pos.y = data.y;
    }

    const vel = this.world.getComponent<Velocity>(entity, "Velocity");
    if (vel) {
      vel.vx = data.vx;
      vel.vy = data.vy;
      vel.speed = 0;
    }

    const appearance = this.world.getComponent<PlayerAppearance>(
      entity,
      "PlayerAppearance",
    );
    if (appearance) {
      appearance.name = data.name;
      appearance.color = data.color;
    } else {
      this.world.addComponent<PlayerAppearance>(entity, "PlayerAppearance", {
        name: data.name,
        color: data.color,
      });
    }
  }

  removeRemotePlayer(networkId: string) {
    const entity = this.remotePlayerEntities.get(networkId);
    if (entity === undefined) return;
    this.remotePlayerEntities.delete(networkId);
    this.world.destroyEntity(entity);
  }

  getRemotePlayerIds(): string[] {
    return [...this.remotePlayerEntities.keys()];
  }

  update(deltaMS: number) {
    // Safety net: keep progression components present even if init was interrupted.
    ensurePlayerProgress(this.world);

    const level = this.getCurrentLevel();
    const settings = this.getSpawnSettings(level);

    this.spawnTimer += deltaMS;
    while (this.spawnTimer >= settings.spawnIntervalMS) {
      this.spawnTimer -= settings.spawnIntervalMS;

      const enemyCount = this.world.query(["EnemyTag"]).length;
      const missing = settings.maxEnemies - enemyCount;
      if (missing <= 0) break;

      const toSpawn = Math.min(missing, settings.spawnsPerTick);
      for (let i = 0; i < toSpawn; i++) {
        void this.spawnOrc(settings.maxEnemies, level);
      }
    }

    if (!this.bossSpawned) {
      this.bossSpawnTimerMS -= deltaMS;
      if (this.bossSpawnTimerMS <= 0) {
        this.bossSpawned = true;
        const [bx, by] = this.pickBossSpawnPositionPixels(level);
        spawnBoss(this.world, bx, by, this.animationSystem);
      }
    }

    playerInputSystem(this.world);
    attackSystem(this.world, deltaMS);
    projectileSystem(this.world);
    bossSystem(this.world, deltaMS);
    laserSystem(this.world, deltaMS);
    enemyFollowSystem(this.world);
    collisionAvoidanceSystem(this.world);
    movementSystem(this.world, deltaMS);

    // Résolution collisions avec les murs après le mouvement ← NOUVEAU
    this.tilemapSystem.resolveWallCollisions(this.world);

    healthSystem(this.world, deltaMS);
    checkDeath(this.world);
    cleanupLaserEntities(this.world);
    this.animationSystem.update(this.world, deltaMS);
    this.updateAnimations();
  }

  private getCurrentLevel(): number {
    const entity = this.world.query(["ProgressionTag", "PlayerProgress"])[0];
    if (entity === undefined) return 1;
    const progress = this.world.getComponent<PlayerProgress>(
      entity,
      "PlayerProgress",
    );
    const level = progress?.level ?? 1;
    return Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  }

  private getSpawnSettings(level: number) {
    const safeLevel = Math.max(1, Math.floor(level));
    const maxEnemies = this.getMaxEnemiesForLevel(safeLevel);
    const spawnIntervalMS = Math.max(
      MIN_SPAWN_INTERVAL_MS,
      BASE_SPAWN_INTERVAL_MS -
        (safeLevel - 1) * SPAWN_INTERVAL_DECAY_MS_PER_LEVEL,
    );
    const spawnsPerTick = clamp(
      BASE_SPAWNS_PER_TICK + Math.floor((safeLevel - 1) / 4),
      BASE_SPAWNS_PER_TICK,
      MAX_SPAWNS_PER_TICK,
    );
    return { maxEnemies, spawnIntervalMS, spawnsPerTick };
  }

  private buildSpawnableFloorTiles(map: GeneratedMap): Array<[number, number]> {
    const tiles: Array<[number, number]> = [];
    const cols = map.cols;
    const rows = map.rows;
    const grid = map.grid;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (isWalkableTile(grid[y]?.[x])) tiles.push([x, y]);
      }
    }
    return tiles;
  }

  private getMaxEnemiesForLevel(level: number): number {
    const safeLevel = Math.max(1, Math.floor(level));
    if (safeLevel === this.cachedMaxEnemiesLevel) {
      return this.cachedMaxEnemiesValue;
    }

    let max = BASE_MAX_ENEMIES;
    for (let l = 2; l <= safeLevel; l++) {
      max += addedEnemiesForLevel(l);
    }

    max = Math.min(MAX_ENEMIES_CAP, max);
    this.cachedMaxEnemiesLevel = safeLevel;
    this.cachedMaxEnemiesValue = max;
    return max;
  }

  private pickSpawnPositionPixels(level: number): [number, number] {
    const playerEntity = this.world.query([
      "PlayerTag",
      "LocalPlayerTag",
      "Position",
    ])[0];
    const playerPos =
      playerEntity !== undefined
        ? this.world.getComponent<Position>(playerEntity, "Position")
        : null;

    const cols = this.currentMap.cols;
    const rows = this.currentMap.rows;
    const tileSize = this.currentMap.tileSize;
    const spawn = this.currentMap.playerSpawn;
    const px = playerPos?.x ?? spawn[0];
    const py = playerPos?.y ?? spawn[1];
    const playerTileX = clamp(Math.floor(px / tileSize), 1, cols - 2);
    const playerTileY = clamp(Math.floor(py / tileSize), 1, rows - 2);

    const safeLevel = Math.max(1, Math.floor(level));
    const minDistTiles = clamp(16 - Math.floor((safeLevel - 1) / 12), 10, 16);
    const minDistSq = minDistTiles * minDistTiles;

    const floorTiles = this.spawnableFloorTiles;
    if (floorTiles.length > 0) {
      for (let attempt = 0; attempt < 120; attempt++) {
        const idx = Math.floor(Math.random() * floorTiles.length);
        const [tx, ty] = floorTiles[idx];

        const dx = tx - playerTileX;
        const dy = ty - playerTileY;
        if (dx * dx + dy * dy < minDistSq) continue;

        return [tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2];
      }
    }

    const spawns = this.currentMap.enemySpawns;
    const fallback = spawns[this.spawnIndex % spawns.length];
    return [fallback[0], fallback[1]];
  }

  private pickBossSpawnPositionPixels(level: number): [number, number] {
    const playerEntity = this.world.query([
      "PlayerTag",
      "LocalPlayerTag",
      "Position",
    ])[0];
    const playerPos =
      playerEntity !== undefined
        ? this.world.getComponent<Position>(playerEntity, "Position")
        : null;

    const cols = this.currentMap.cols;
    const rows = this.currentMap.rows;
    const tileSize = this.currentMap.tileSize;
    const spawn = this.currentMap.playerSpawn;
    const px = playerPos?.x ?? spawn[0];
    const py = playerPos?.y ?? spawn[1];
    const playerTileX = clamp(Math.floor(px / tileSize), 1, cols - 2);
    const playerTileY = clamp(Math.floor(py / tileSize), 1, rows - 2);

    const safeLevel = Math.max(1, Math.floor(level));
    const minDistTiles = clamp(44 + Math.floor((safeLevel - 1) / 10), 44, 60);
    const minDistSq = minDistTiles * minDistTiles;

    const floorTiles = this.spawnableFloorTiles;
    if (floorTiles.length > 0) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const idx = Math.floor(Math.random() * floorTiles.length);
        const [tx, ty] = floorTiles[idx];

        const dx = tx - playerTileX;
        const dy = ty - playerTileY;
        if (dx * dx + dy * dy < minDistSq) continue;

        return [tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2];
      }
    }

    const spawns = this.currentMap.enemySpawns;
    let best: [number, number] = spawns[0] ?? this.currentMap.playerSpawn;
    let bestDistSq = -1;

    for (const s of spawns) {
      const dx = s[0] - px;
      const dy = s[1] - py;
      const d = dx * dx + dy * dy;
      if (d > bestDistSq) {
        bestDistSq = d;
        best = s;
      }
    }

    return [best[0], best[1]];
  }

  private async spawnOrc(maxEnemies: number, level: number) {
    const enemyCount = this.world.query(["EnemyTag"]).length;
    if (enemyCount >= maxEnemies) return;

    const [spawnX, spawnY] = this.pickSpawnPositionPixels(level);
    this.spawnIndex++;

    // Légère variation aléatoire pour éviter le stacking
    const offsetX = (Math.random() - 0.5) * 32;
    const offsetY = (Math.random() - 0.5) * 32;

    const enemy = this.world.createEntity();
    this.world.addComponent(enemy, "EnemyTag", {});
    this.world.addComponent<Position>(enemy, "Position", {
      x: spawnX + offsetX,
      y: spawnY + offsetY,
    });
    this.world.addComponent<Velocity>(enemy, "Velocity", {
      vx: 0,
      vy: 0,
      speed: 80,
    });
    this.world.addComponent<Health>(enemy, "Health", {
      current: 3,
      max: 3,
      isDead: false,
    });
    this.world.addComponent<SpriteComponent>(enemy, "SpriteComponent", {
      width: 48,
      height: 48,
      anchor: 0.5,
    });

    await this.animationSystem.loadAnimations(enemy, createOrcManifest(), {
      walk: { speed: 8, loop: true },
    });
  }

  private updateAnimations() {
    const players = this.world.query(["PlayerTag", "Velocity"]);
    for (const player of players) {
      if (this.world.hasComponent(player, "DeadTag")) {
        this.animationSystem.setAnimation(player, "death");
        continue;
      }
      const vel = this.world.getComponent<Velocity>(player, "Velocity")!;
      const isLocal = this.world.hasComponent(player, "LocalPlayerTag");
      if (isLocal && getAttackTriggered()) {
        this.animationSystem.setAnimation(player, "attack");
      } else if (vel.vx !== 0 || vel.vy !== 0) {
        this.animationSystem.setAnimation(player, "walk");
      } else {
        this.animationSystem.setAnimation(player, "idle");
      }
    }

    const enemies = this.world.query(["EnemyTag", "Velocity"]);
    for (const enemy of enemies) {
      const vel = this.world.getComponent<Velocity>(enemy, "Velocity")!;
      if (vel.vx !== 0 || vel.vy !== 0) {
        this.animationSystem.setAnimation(enemy, "walk");
      }
    }

    const bosses = this.world.query(["BossTag", "Velocity"]);
    for (const boss of bosses) {
      const vel = this.world.getComponent<Velocity>(boss, "Velocity")!;
      if (vel.vx !== 0 || vel.vy !== 0) {
        this.animationSystem.setAnimation(boss, "walk");
      }
    }
  }
}
