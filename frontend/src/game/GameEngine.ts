import { World } from "./ecs/World";
import { movementSystem } from "./systems/MovementSystem";
import { enemyFollowSystem } from "./systems/EnemyFollowSystem";
import { playerInputSystem } from "./systems/PlayerInputSystem";
import { collisionAvoidanceSystem } from "./systems/CollisionAvoidanceSystem";
import { healthSystem, checkDeath } from "./systems/HealthSystem";
import { environmentHazardSystem } from "./systems/EnvironmentHazardSystem";
import { dashSystem } from "./systems/DashSystem";
import { shieldSystem } from "./systems/ShieldSystem";
import { bombThrowerSystem } from "./systems/BombThrowerSystem";
import { bombSystem } from "./systems/BombSystem";
import { getWeaponSpec, weaponForTier } from "./config/weapons";
import {
  applyUpgrade,
  ensurePlayerProgress,
  getUpgradeOptions,
  type UpgradeType,
} from "./systems/PlayerProgressSystem";
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
  type CombatStats,
  type ContactDamage,
  type HealPickup,
  type PowerPickup,
  type PowerPickupType,
  type PlayerAppearance,
  type PlayerProgress,
  type DashState,
  type ShieldState,
  type WeaponState,
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

type EnemyKind =
  | "orc"
  | "armored_orc"
  | "elite_orc"
  | "orc_rider"
  | "skeleton"
  | "armored_skeleton"
  | "greatsword_skeleton"
  | "armored_axeman"
  | "knight"
  | "lancer"
  | "knight_templar"
  | "wizard";

type EnemyBaseStats = {
  hp: number;
  speed: number;
  width: number;
  height: number;
  animSpeed: number;
  contactRadius: number;
};

type EnemySpawnRule = {
  kind: EnemyKind;
  baseWeight: number;
  minLevel: number;
};

const ENEMY_MANIFESTS: Record<EnemyKind, SpriteManifest> = {
  orc: { walk: spritesManifest.orc_walk },
  armored_orc: { walk: spritesManifest.armored_orc_walk },
  elite_orc: { walk: spritesManifest.elite_orc_walk },
  orc_rider: { walk: spritesManifest.orc_rider_walk },
  skeleton: { walk: spritesManifest.skeleton_walk },
  armored_skeleton: { walk: spritesManifest.armored_skeleton_walk },
  greatsword_skeleton: { walk: spritesManifest.greatsword_skeleton_walk },
  armored_axeman: { walk: spritesManifest.armored_axeman_walk },
  knight: { walk: spritesManifest.knight_walk },
  lancer: { walk: spritesManifest.lancer_walk },
  knight_templar: { walk: spritesManifest.knight_templar_walk },
  wizard: { walk: spritesManifest.wizard_walk },
};

const ENEMY_STATS: Record<EnemyKind, EnemyBaseStats> = {
  orc: {
    hp: 3,
    speed: 80,
    width: 48,
    height: 48,
    animSpeed: 8,
    contactRadius: 30,
  },
  skeleton: {
    hp: 3,
    speed: 85,
    width: 48,
    height: 48,
    animSpeed: 8,
    contactRadius: 30,
  },
  armored_orc: {
    hp: 5,
    speed: 90,
    width: 48,
    height: 48,
    animSpeed: 9,
    contactRadius: 32,
  },
  armored_skeleton: {
    hp: 5,
    speed: 90,
    width: 48,
    height: 48,
    animSpeed: 9,
    contactRadius: 32,
  },
  elite_orc: {
    hp: 7,
    speed: 100,
    width: 48,
    height: 48,
    animSpeed: 10,
    contactRadius: 34,
  },
  greatsword_skeleton: {
    hp: 7,
    speed: 95,
    width: 48,
    height: 48,
    animSpeed: 9,
    contactRadius: 34,
  },
  orc_rider: {
    hp: 6,
    speed: 110,
    width: 48,
    height: 48,
    animSpeed: 10,
    contactRadius: 34,
  },
  armored_axeman: {
    hp: 8,
    speed: 88,
    width: 48,
    height: 48,
    animSpeed: 8,
    contactRadius: 36,
  },
  knight: {
    hp: 6,
    speed: 96,
    width: 48,
    height: 48,
    animSpeed: 8,
    contactRadius: 32,
  },
  lancer: {
    hp: 6,
    speed: 106,
    width: 48,
    height: 48,
    animSpeed: 9,
    contactRadius: 34,
  },
  knight_templar: {
    hp: 9,
    speed: 102,
    width: 48,
    height: 48,
    animSpeed: 9,
    contactRadius: 36,
  },
  wizard: {
    hp: 7,
    speed: 78,
    width: 48,
    height: 48,
    animSpeed: 8,
    contactRadius: 28,
  },
};

const ENEMY_POOLS: Record<MapTheme, EnemySpawnRule[]> = {
  forest: [
    { kind: "orc", baseWeight: 1, minLevel: 1 },
    { kind: "skeleton", baseWeight: 0.35, minLevel: 4 },
    { kind: "armored_orc", baseWeight: 0.18, minLevel: 12 },
    { kind: "elite_orc", baseWeight: 0.08, minLevel: 28 },
  ],
  fairy_forest: [
    { kind: "orc", baseWeight: 0.9, minLevel: 1 },
    { kind: "skeleton", baseWeight: 0.45, minLevel: 5 },
    { kind: "armored_orc", baseWeight: 0.2, minLevel: 14 },
    { kind: "elite_orc", baseWeight: 0.1, minLevel: 30 },
  ],
  dungeon: [
    { kind: "skeleton", baseWeight: 0.9, minLevel: 1 },
    { kind: "armored_skeleton", baseWeight: 0.35, minLevel: 12 },
    { kind: "greatsword_skeleton", baseWeight: 0.22, minLevel: 22 },
    { kind: "wizard", baseWeight: 0.24, minLevel: 18 },
    { kind: "elite_orc", baseWeight: 0.12, minLevel: 30 },
  ],
  kings_hall: [
    { kind: "knight", baseWeight: 0.8, minLevel: 1 },
    { kind: "lancer", baseWeight: 0.42, minLevel: 18 },
    { kind: "armored_axeman", baseWeight: 0.28, minLevel: 22 },
    { kind: "wizard", baseWeight: 0.18, minLevel: 24 },
    { kind: "knight_templar", baseWeight: 0.18, minLevel: 34 },
  ],
  castle_courtyard: [
    { kind: "knight", baseWeight: 0.7, minLevel: 1 },
    { kind: "lancer", baseWeight: 0.45, minLevel: 24 },
    { kind: "armored_axeman", baseWeight: 0.35, minLevel: 26 },
    { kind: "wizard", baseWeight: 0.2, minLevel: 30 },
    { kind: "knight_templar", baseWeight: 0.22, minLevel: 38 },
  ],
  battlefield: [
    { kind: "armored_axeman", baseWeight: 0.75, minLevel: 1 },
    { kind: "orc_rider", baseWeight: 0.35, minLevel: 28 },
    { kind: "armored_orc", baseWeight: 0.35, minLevel: 22 },
    { kind: "wizard", baseWeight: 0.22, minLevel: 32 },
    { kind: "elite_orc", baseWeight: 0.28, minLevel: 32 },
  ],
  rocky_lava: [
    { kind: "armored_orc", baseWeight: 0.75, minLevel: 1 },
    { kind: "elite_orc", baseWeight: 0.38, minLevel: 34 },
    { kind: "armored_axeman", baseWeight: 0.32, minLevel: 32 },
    { kind: "greatsword_skeleton", baseWeight: 0.28, minLevel: 30 },
    { kind: "wizard", baseWeight: 0.2, minLevel: 36 },
    { kind: "orc_rider", baseWeight: 0.26, minLevel: 38 },
  ],
  volcanic: [
    { kind: "elite_orc", baseWeight: 0.6, minLevel: 1 },
    { kind: "knight_templar", baseWeight: 0.35, minLevel: 44 },
    { kind: "armored_axeman", baseWeight: 0.35, minLevel: 36 },
    { kind: "greatsword_skeleton", baseWeight: 0.3, minLevel: 34 },
    { kind: "orc_rider", baseWeight: 0.28, minLevel: 40 },
    { kind: "wizard", baseWeight: 0.24, minLevel: 46 },
  ],
};

function pickWeighted<T>(
  items: Array<{ value: T; weight: number }>,
  fallback: T,
): T {
  let total = 0;
  for (const item of items) total += Math.max(0, item.weight);
  if (total <= 0) return fallback;

  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll <= 0) return item.value;
  }

  return items.length > 0 ? items[items.length - 1].value : fallback;
}

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
  private nextBossSpawnLevel = 5;
  private nextWeaponUpgradeLevel = 5;
  private weaponUpgradeTier = 0;
  private cachedMaxEnemiesLevel = 0;
  private cachedMaxEnemiesValue = BASE_MAX_ENEMIES;
  private healSpawnTimerMS = 16000;
  private powerSpawnTimerMS = 22000;
  private notifications: string[] = [];

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

  consumeNotifications(): string[] {
    if (this.notifications.length === 0) return [];
    return this.notifications.splice(0, this.notifications.length);
  }

  async changeMap(theme: MapTheme, level: number) {
    await this.initPromise;
    const safeLevel = Math.max(1, Math.floor(level));
    const nextMap = generateMap(theme);

    this.currentMap = nextMap;
    this.spawnableFloorTiles = this.buildSpawnableFloorTiles(nextMap);
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.healSpawnTimerMS = 12000;
    this.powerSpawnTimerMS = 18000;

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
    for (const pickup of this.world.query(["HealPickupTag"])) {
      this.world.destroyEntity(pickup);
    }
    for (const power of this.world.query(["PowerPickupTag"])) {
      this.world.destroyEntity(power);
    }
    for (const bomb of this.world.query(["BombTag"])) {
      this.world.destroyEntity(bomb);
    }
    for (const fx of this.world.query(["ExplosionFxTag"])) {
      this.world.destroyEntity(fx);
    }

    // Respawn d'un pack initial adapté au level actuel
    const settings = this.getSpawnSettings(safeLevel);
    const initialEnemies = Math.min(settings.maxEnemies, 20);
    for (let i = 0; i < initialEnemies; i++) {
      await this.spawnEnemy(settings.maxEnemies, safeLevel);
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
    this.world.addComponent<ShieldState>(player, "ShieldState", {
      activeMS: 0,
      cooldownMS: 0,
    });
    this.world.addComponent<WeaponState>(player, "WeaponState", {
      type: "bow",
    });
    this.world.addComponent<DashState>(player, "DashState", {
      activeMS: 0,
      cooldownMS: 0,
      dirX: 0,
      dirY: 0,
      lastDirX: 0,
      lastDirY: -1,
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
      await this.spawnEnemy(settings.maxEnemies, level);
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

  private pushNotification(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;
    this.notifications.push(trimmed);
    if (this.notifications.length > 6) {
      this.notifications.splice(0, this.notifications.length - 6);
    }
  }

  update(deltaMS: number) {
    // Safety net: keep progression components present even if init was interrupted.
    ensurePlayerProgress(this.world);

    const level = this.getCurrentLevel();
    const settings = this.getSpawnSettings(level);

    this.applyAutoWeaponUpgrades(level);

    this.spawnTimer += deltaMS;
    while (this.spawnTimer >= settings.spawnIntervalMS) {
      this.spawnTimer -= settings.spawnIntervalMS;

      const enemyCount = this.world.query(["EnemyTag"]).length;
      const missing = settings.maxEnemies - enemyCount;
      if (missing <= 0) break;

      const toSpawn = Math.min(missing, settings.spawnsPerTick);
      for (let i = 0; i < toSpawn; i++) {
        void this.spawnEnemy(settings.maxEnemies, level);
      }
    }

    this.spawnBossIfNeeded(level);

    playerInputSystem(this.world);
    dashSystem(this.world, deltaMS);
    shieldSystem(this.world, deltaMS);
    attackSystem(this.world, deltaMS);
    projectileSystem(this.world);
    bossSystem(this.world, deltaMS);
    laserSystem(this.world, deltaMS);
    enemyFollowSystem(this.world);
    collisionAvoidanceSystem(this.world);
    movementSystem(this.world, deltaMS);

    // Résolution collisions avec les murs après le mouvement ← NOUVEAU
    this.tilemapSystem.resolveWallCollisions(this.world);

    environmentHazardSystem(this.world, deltaMS, this.currentMap);
    bombThrowerSystem(this.world, deltaMS, this.currentMap, level);
    bombSystem(this.world, deltaMS);
    healthSystem(this.world, deltaMS);
    this.updateHealPickups(deltaMS, level);
    this.updatePowerPickups(deltaMS, level);
    checkDeath(this.world);
    cleanupLaserEntities(this.world);
    this.animationSystem.update(this.world, deltaMS);
    this.updateAnimations();
  }

  private applyAutoWeaponUpgrades(level: number) {
    const safeLevel = Math.max(1, Math.floor(level));
    if (safeLevel < this.nextWeaponUpgradeLevel) return;

    const player = this.getLocalPlayerEntity();
    if (player === null) return;

    const stats = this.world.getComponent<CombatStats>(player, "CombatStats");
    if (!stats) return;

    const weaponState =
      this.world.getComponent<WeaponState>(player, "WeaponState") ??
      ({
        type: "bow",
      } satisfies WeaponState);

    let lastMessage: string | null = null;

    while (safeLevel >= this.nextWeaponUpgradeLevel) {
      this.weaponUpgradeTier += 1;
      const weaponType = weaponForTier(this.weaponUpgradeTier);
      const weaponSpec = getWeaponSpec(weaponType);
      weaponState.type = weaponType;

      const bonusParts: string[] = [];

      stats.damageBonus += 1;
      bonusParts.push("+1 dégâts");

      if (this.weaponUpgradeTier % 2 === 0) {
        stats.fireRateMultiplier = Math.max(
          0.45,
          stats.fireRateMultiplier * 0.94,
        );
        bonusParts.push("cadence ↑");
      }

      if (this.weaponUpgradeTier % 3 === 0) {
        stats.multishot = Math.min(5, stats.multishot + 1);
        bonusParts.push("+1 tir");
      }

      lastMessage = `Nouvelle arme (Niveau ${this.nextWeaponUpgradeLevel}) : ${weaponSpec.name} — ${bonusParts.join(
        " · ",
      )}`;

      this.nextWeaponUpgradeLevel += 5;
    }

    this.world.addComponent(player, "CombatStats", stats);
    this.world.addComponent(player, "WeaponState", weaponState);
    if (lastMessage) this.pushNotification(lastMessage);
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

  private hasLivingBoss(): boolean {
    const bosses = this.world.query(["BossTag", "Health"]);
    for (const boss of bosses) {
      const health = this.world.getComponent<Health>(boss, "Health");
      if (!health) continue;
      if (health.isDead) continue;
      if (this.world.hasComponent(boss, "DeadTag")) continue;
      if (health.current > 0) return true;
    }
    return false;
  }

  private spawnBossIfNeeded(level: number) {
    const safeLevel = Math.max(1, Math.floor(level));
    if (safeLevel < this.nextBossSpawnLevel) return;
    if (this.hasLivingBoss()) return;

    const [bx, by] = this.pickBossSpawnPositionPixels(safeLevel);
    spawnBoss(this.world, bx, by, this.animationSystem);
    this.nextBossSpawnLevel += 5;
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

  private pickEnemyKind(level: number): EnemyKind {
    const safeLevel = Math.max(1, Math.floor(level));
    const pool = ENEMY_POOLS[this.currentMap.theme] ?? ENEMY_POOLS.forest;
    const candidates = pool.filter((rule) => safeLevel >= rule.minLevel);

    const weighted = candidates.map((rule) => {
      const age = Math.max(0, safeLevel - rule.minLevel);
      const scaledWeight = rule.baseWeight * (1 + Math.min(1.3, age / 45));
      return { value: rule.kind, weight: scaledWeight };
    });

    return pickWeighted(weighted, "orc");
  }

  private async spawnEnemy(maxEnemies: number, level: number) {
    const enemyCount = this.world.query(["EnemyTag"]).length;
    if (enemyCount >= maxEnemies) return;

    const safeLevel = Math.max(1, Math.floor(level));
    const kind = this.pickEnemyKind(safeLevel);
    const base = ENEMY_STATS[kind] ?? ENEMY_STATS.orc;

    const hpBonus = Math.floor((safeLevel - 1) / 9);
    const speedBonus = Math.floor((safeLevel - 1) / 15) * 5;
    const hp = clamp(base.hp + hpBonus, base.hp, base.hp + 14);
    const speed = clamp(base.speed + speedBonus, base.speed, base.speed + 45);

    const [spawnX, spawnY] = this.pickSpawnPositionPixels(level);
    this.spawnIndex++;

    // Légère variation aléatoire pour éviter le stacking
    const offsetX = (Math.random() - 0.5) * 32;
    const offsetY = (Math.random() - 0.5) * 32;

    const enemy = this.world.createEntity();
    this.world.addComponent(enemy, "EnemyTag", {});
    this.world.addComponent(enemy, "EnemyKind", { kind });
    if (kind === "wizard") {
      this.world.addComponent(enemy, "BombThrower", {
        cooldownMS: 900 + Math.random() * 1200,
      });
    }
    this.world.addComponent<ContactDamage>(enemy, "ContactDamage", {
      amount: 1,
      radius: base.contactRadius,
    });
    this.world.addComponent<Position>(enemy, "Position", {
      x: spawnX + offsetX,
      y: spawnY + offsetY,
    });
    this.world.addComponent<Velocity>(enemy, "Velocity", {
      vx: 0,
      vy: 0,
      speed,
    });
    this.world.addComponent<Health>(enemy, "Health", {
      current: hp,
      max: hp,
      isDead: false,
    });
    this.world.addComponent<SpriteComponent>(enemy, "SpriteComponent", {
      width: base.width,
      height: base.height,
      anchor: 0.5,
    });

    await this.animationSystem.loadAnimations(enemy, ENEMY_MANIFESTS[kind], {
      walk: { speed: base.animSpeed, loop: true },
    });
  }

  private getHealSpawnIntervalMS(level: number): number {
    const safeLevel = Math.max(1, Math.floor(level));
    return clamp(30000 - (safeLevel - 1) * 160, 18000, 30000);
  }

  private buildDirectionalHint(
    baseMessage: string,
    targetX: number,
    targetY: number,
  ): string {
    const player = this.getLocalPlayerEntity();
    if (player === null) {
      return `${baseMessage} sur la map !`;
    }

    const playerPos = this.world.getComponent<Position>(player, "Position");
    if (!playerPos) {
      return `${baseMessage} sur la map !`;
    }

    const dx = targetX - playerPos.x;
    const dy = targetY - playerPos.y;
    const angle = Math.atan2(-dy, dx); // y inverse pour une boussole "Nord"
    const dirs = [
      "Est",
      "Nord-Est",
      "Nord",
      "Nord-Ouest",
      "Ouest",
      "Sud-Ouest",
      "Sud",
      "Sud-Est",
    ] as const;

    let idx = Math.round(angle / (Math.PI / 4));
    idx = ((idx % 8) + 8) % 8;
    const dir = dirs[idx] ?? "quelque part";

    const tiles = Math.max(
      1,
      Math.round(Math.sqrt(dx * dx + dy * dy) / this.currentMap.tileSize),
    );

    return `${baseMessage} au ${dir} (≈ ${tiles} cases).`;
  }

  private buildHealSpawnMessage(pickupX: number, pickupY: number): string {
    return this.buildDirectionalHint("Un coeur apparait", pickupX, pickupY);
  }

  private buildPowerSpawnMessage(pickupX: number, pickupY: number): string {
    return this.buildDirectionalHint(
      "Un super pouvoir apparait",
      pickupX,
      pickupY,
    );
  }

  private spawnHealPickup(level: number) {
    const existing = this.world.query(["HealPickupTag"]);
    if (existing.length > 0) return;

    const [spawnX, spawnY] = this.pickSpawnPositionPixels(level);

    const pickup = this.world.createEntity();
    this.world.addComponent(pickup, "HealPickupTag", {});
    this.world.addComponent<HealPickup>(pickup, "HealPickup", { amount: 1 });
    this.world.addComponent<Position>(pickup, "Position", {
      x: spawnX,
      y: spawnY,
    });
    this.world.addComponent<SpriteComponent>(pickup, "SpriteComponent", {
      width: 40,
      height: 40,
      anchor: 0.5,
    });
    this.world.addComponent(pickup, "TimerComponent", { timeLeft: 25000 });

    this.pushNotification(this.buildHealSpawnMessage(spawnX, spawnY));
  }

  private updateHealPickups(deltaMS: number, level: number) {
    for (const pickup of this.world.query([
      "HealPickupTag",
      "TimerComponent",
    ])) {
      const timer = this.world.getComponent<{ timeLeft: number }>(
        pickup,
        "TimerComponent",
      );
      if (!timer) continue;
      timer.timeLeft -= deltaMS;
      if (timer.timeLeft <= 0) {
        this.world.destroyEntity(pickup);
        this.healSpawnTimerMS = this.getHealSpawnIntervalMS(level);
      }
    }

    const players = this.world.query(["PlayerTag", "Position", "Health"]);
    const pickups = this.world.query([
      "HealPickupTag",
      "Position",
      "HealPickup",
    ]);

    for (const player of players) {
      if (this.world.hasComponent(player, "DeadTag")) continue;
      const health = this.world.getComponent<Health>(player, "Health");
      const pos = this.world.getComponent<Position>(player, "Position");
      if (!health || !pos || health.isDead || health.current <= 0) continue;

      for (const pickup of pickups) {
        const pickupPos = this.world.getComponent<Position>(pickup, "Position");
        const heal = this.world.getComponent<HealPickup>(pickup, "HealPickup");
        if (!pickupPos || !heal) continue;

        const dx = pos.x - pickupPos.x;
        const dy = pos.y - pickupPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 34) continue;

        if (health.current >= health.max) continue;

        const before = health.current;
        health.current = Math.min(health.max, health.current + heal.amount);
        if (health.current > before) {
          this.pushNotification(`+${health.current - before} PV`);
        }

        this.world.destroyEntity(pickup);
        this.healSpawnTimerMS = this.getHealSpawnIntervalMS(level);
        break;
      }
    }

    if (this.world.query(["HealPickupTag"]).length > 0) return;

    this.healSpawnTimerMS = Math.max(0, this.healSpawnTimerMS - deltaMS);
    if (this.healSpawnTimerMS > 0) return;

    this.spawnHealPickup(level);
    // Stoppe le timer tant qu'un coeur est présent
    this.healSpawnTimerMS = 0;
  }

  private getPowerSpawnIntervalMS(level: number): number {
    const safeLevel = Math.max(1, Math.floor(level));
    return clamp(42000 - (safeLevel - 1) * 220, 24000, 42000);
  }

  private pickPowerType(): PowerPickupType {
    const options = getUpgradeOptions();
    const pick = options[Math.floor(Math.random() * options.length)];
    return (pick?.type ?? "damage") as PowerPickupType;
  }

  private getPowerLabel(type: PowerPickupType): string {
    const option = getUpgradeOptions().find((o) => o.type === type);
    return option?.label ?? type;
  }

  private spawnPowerPickup(level: number) {
    const existing = this.world.query(["PowerPickupTag"]);
    if (existing.length > 0) return;

    const [spawnX, spawnY] = this.pickSpawnPositionPixels(level);
    const type = this.pickPowerType();

    const pickup = this.world.createEntity();
    this.world.addComponent(pickup, "PowerPickupTag", {});
    this.world.addComponent<PowerPickup>(pickup, "PowerPickup", { type });
    this.world.addComponent<Position>(pickup, "Position", {
      x: spawnX,
      y: spawnY,
    });
    this.world.addComponent<SpriteComponent>(pickup, "SpriteComponent", {
      width: 44,
      height: 44,
      anchor: 0.5,
    });
    this.world.addComponent(pickup, "TimerComponent", { timeLeft: 35000 });

    this.pushNotification(this.buildPowerSpawnMessage(spawnX, spawnY));
  }

  private updatePowerPickups(deltaMS: number, level: number) {
    for (const pickup of this.world.query([
      "PowerPickupTag",
      "TimerComponent",
    ])) {
      const timer = this.world.getComponent<{ timeLeft: number }>(
        pickup,
        "TimerComponent",
      );
      if (!timer) continue;
      timer.timeLeft -= deltaMS;
      if (timer.timeLeft <= 0) {
        this.world.destroyEntity(pickup);
        this.powerSpawnTimerMS = this.getPowerSpawnIntervalMS(level);
      }
    }

    const player = this.world.query([
      "PlayerTag",
      "LocalPlayerTag",
      "Position",
      "Health",
    ])[0];

    if (player !== undefined && !this.world.hasComponent(player, "DeadTag")) {
      const health = this.world.getComponent<Health>(player, "Health");
      const pos = this.world.getComponent<Position>(player, "Position");

      if (health && pos && !health.isDead && health.current > 0) {
        const pickups = this.world.query([
          "PowerPickupTag",
          "Position",
          "PowerPickup",
        ]);

        for (const pickup of pickups) {
          const pickupPos = this.world.getComponent<Position>(
            pickup,
            "Position",
          );
          const power = this.world.getComponent<PowerPickup>(
            pickup,
            "PowerPickup",
          );
          if (!pickupPos || !power) continue;

          const dx = pos.x - pickupPos.x;
          const dy = pos.y - pickupPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 34) continue;

          const progressEntity = this.world.query([
            "ProgressionTag",
            "PlayerProgress",
          ])[0];
          if (progressEntity !== undefined) {
            const progress = this.world.getComponent<PlayerProgress>(
              progressEntity,
              "PlayerProgress",
            );
            if (progress) progress.skillPoints += 1;
          }

          applyUpgrade(this.world, power.type as UpgradeType);
          this.pushNotification(
            `Super pouvoir : ${this.getPowerLabel(power.type)} !`,
          );

          this.world.destroyEntity(pickup);
          this.powerSpawnTimerMS = this.getPowerSpawnIntervalMS(level);
          break;
        }
      }
    }

    if (this.world.query(["PowerPickupTag"]).length > 0) return;

    this.powerSpawnTimerMS = Math.max(0, this.powerSpawnTimerMS - deltaMS);
    if (this.powerSpawnTimerMS > 0) return;

    this.spawnPowerPickup(level);
    this.powerSpawnTimerMS = 0;
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
