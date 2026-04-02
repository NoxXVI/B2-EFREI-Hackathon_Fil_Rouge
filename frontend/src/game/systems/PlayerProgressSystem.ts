import { World } from "../ecs/World";
import { PlayerProgress, CombatStats } from "../components";

export type UpgradeType =
  | "fireRate"
  | "damage"
  | "multishot"
  | "crit"
  | "homing";

export interface UpgradeOption {
  type: UpgradeType;
  label: string;
  description: string;
}

const XP_PER_ENEMY = 1;
const BASE_XP_TO_NEXT = 5;
const PASSIVE_XP_INTERVAL_MS = 3000;
const PASSIVE_XP_AMOUNT = 1;

let passiveXpAccumulatorMS = 0;
let lastPassiveTickMS: number | null = null;

function getOrCreateProgressEntity(world: World): number {
  const progressionEntities = world.query(["ProgressionTag"]);
  const entity =
    progressionEntities[0] !== undefined
      ? progressionEntities[0]
      : world.createEntity();

  if (!world.hasComponent(entity, "ProgressionTag")) {
    world.addComponent(entity, "ProgressionTag", {});
  }

  if (!world.hasComponent(entity, "PlayerProgress")) {
    world.addComponent<PlayerProgress>(entity, "PlayerProgress", {
      level: 1,
      xp: 0,
      xpToNext: BASE_XP_TO_NEXT,
      skillPoints: 0,
    });
  }

  return entity;
}

export function ensurePlayerProgress(world: World) {
  getOrCreateProgressEntity(world);

  const players = world.query(["PlayerTag"]);
  for (const player of players) {
    if (!world.hasComponent(player, "CombatStats")) {
      world.addComponent<CombatStats>(player, "CombatStats", {
        fireRateMultiplier: 1,
        damageBonus: 0,
        multishot: 1,
        critChance: 0,
        critMultiplier: 1.5,
        homingStrength: 0,
      });
    }
  }
}

export function grantEnemyXp(world: World, enemyCountKilled: number) {
  ensurePlayerProgress(world);

  const progressionEntity = world.query([
    "ProgressionTag",
    "PlayerProgress",
  ])[0];
  if (progressionEntity === undefined || enemyCountKilled <= 0) return;

  const progress = world.getComponent<PlayerProgress>(
    progressionEntity,
    "PlayerProgress",
  )!;
  progress.xp += enemyCountKilled * XP_PER_ENEMY;

  while (progress.xp >= progress.xpToNext) {
    progress.xp -= progress.xpToNext;
    progress.level += 1;
    progress.skillPoints += 1;
    progress.xpToNext = Math.floor(BASE_XP_TO_NEXT + progress.level * 2);
  }
}

export function passiveXpSystem(world: World, deltaMS: number) {
  ensurePlayerProgress(world);

  const nowMS =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  if (lastPassiveTickMS === null) {
    lastPassiveTickMS = nowMS;
  }

  let elapsedMS = nowMS - lastPassiveTickMS;
  lastPassiveTickMS = nowMS;

  if (!Number.isFinite(elapsedMS) || elapsedMS <= 0) {
    elapsedMS = Math.max(0, deltaMS);
  }

  passiveXpAccumulatorMS += elapsedMS;

  while (passiveXpAccumulatorMS >= PASSIVE_XP_INTERVAL_MS) {
    passiveXpAccumulatorMS -= PASSIVE_XP_INTERVAL_MS;
    grantEnemyXp(world, PASSIVE_XP_AMOUNT);
  }
}

export function applyUpgrade(world: World, upgrade: UpgradeType) {
  ensurePlayerProgress(world);

  const progressionEntity = world.query([
    "ProgressionTag",
    "PlayerProgress",
  ])[0];
  if (progressionEntity === undefined) return;

  const progress = world.getComponent<PlayerProgress>(
    progressionEntity,
    "PlayerProgress",
  )!;
  if (progress.skillPoints <= 0) return;

  const players = world.query(["PlayerTag", "CombatStats"]);
  if (players.length === 0) return;

  const player = players[0];

  const stats = world.getComponent<CombatStats>(player, "CombatStats")!;

  switch (upgrade) {
    case "fireRate":
      stats.fireRateMultiplier = Math.max(0.4, stats.fireRateMultiplier * 0.88);
      break;
    case "damage":
      stats.damageBonus += 1;
      break;
    case "multishot":
      stats.multishot = Math.min(5, stats.multishot + 1);
      break;
    case "crit":
      stats.critChance = Math.min(0.5, stats.critChance + 0.05);
      stats.critMultiplier = Math.min(3, stats.critMultiplier + 0.25);
      break;
    case "homing":
      stats.homingStrength = Math.min(0.25, stats.homingStrength + 0.05);
      break;
  }

  progress.skillPoints -= 1;
}

export function getUpgradeOptions(): UpgradeOption[] {
  return [
    { type: "fireRate", label: "Cadence", description: "Tire plus vite." },
    {
      type: "damage",
      label: "Degats",
      description: "Projectiles plus puissants.",
    },
    {
      type: "multishot",
      label: "Multishot",
      description: "Tire plusieurs projectiles.",
    },
    {
      type: "crit",
      label: "Critique",
      description: "Chance de coups critiques.",
    },
    {
      type: "homing",
      label: "Homing leger",
      description: "Corrige un peu la trajectoire.",
    },
  ];
}
