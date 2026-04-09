import { type ProjectileTextureKey, type WeaponType } from "../components";

export type WeaponSpec = {
  type: WeaponType;
  name: string;
  description: string;
  baseCooldownMS: number;
  baseDamage: number;
  baseMultishot: number;
  spreadRad: number;
  projectileSpeed: number;
  projectileLifetimeFrames: number;
  homingBonus: number;
  projectileTexture: ProjectileTextureKey;
  projectileTint: number;
  projectileSize: number;
};

export const WEAPON_CYCLE: WeaponType[] = [
  "crossbow",
  "longbow",
  "scatterbow",
  "arcane_wand",
];

const WEAPONS: Record<WeaponType, WeaponSpec> = {
  bow: {
    type: "bow",
    name: "Arc",
    description: "Équilibré.",
    baseCooldownMS: 250,
    baseDamage: 1,
    baseMultishot: 1,
    spreadRad: 0,
    projectileSpeed: 8,
    projectileLifetimeFrames: 60,
    homingBonus: 0,
    projectileTexture: "arrow",
    projectileTint: 0xffffff,
    projectileSize: 24,
  },
  crossbow: {
    type: "crossbow",
    name: "Arbalète",
    description: "Très rapide, mais moins stable.",
    baseCooldownMS: 175,
    baseDamage: 1,
    baseMultishot: 1,
    spreadRad: 0.12,
    projectileSpeed: 10,
    projectileLifetimeFrames: 56,
    homingBonus: 0,
    projectileTexture: "arrow_01",
    projectileTint: 0xffd60a,
    projectileSize: 24,
  },
  longbow: {
    type: "longbow",
    name: "Arc long",
    description: "Plus lent, mais frappe fort.",
    baseCooldownMS: 320,
    baseDamage: 2,
    baseMultishot: 1,
    spreadRad: 0,
    projectileSpeed: 9,
    projectileLifetimeFrames: 72,
    homingBonus: 0,
    projectileTexture: "arrow_02",
    projectileTint: 0x7cff6b,
    projectileSize: 24,
  },
  scatterbow: {
    type: "scatterbow",
    name: "Arc à fragmentation",
    description: "Tire en éventail pour nettoyer la zone.",
    baseCooldownMS: 380,
    baseDamage: 1,
    baseMultishot: 3,
    spreadRad: 0.22,
    projectileSpeed: 8,
    projectileLifetimeFrames: 54,
    homingBonus: 0,
    projectileTexture: "arrow_03",
    projectileTint: 0xff6b6b,
    projectileSize: 24,
  },
  arcane_wand: {
    type: "arcane_wand",
    name: "Bâton arcanique",
    description: "Les tirs corrigent légèrement la trajectoire.",
    baseCooldownMS: 260,
    baseDamage: 1,
    baseMultishot: 1,
    spreadRad: 0,
    projectileSpeed: 7,
    projectileLifetimeFrames: 84,
    homingBonus: 0.12,
    projectileTexture: "arrow_02",
    projectileTint: 0x8f2dff,
    projectileSize: 24,
  },
};

export function getWeaponSpec(type: WeaponType): WeaponSpec {
  return WEAPONS[type] ?? WEAPONS.bow;
}

export function weaponForTier(tier: number): WeaponType {
  const safeTier = Math.max(0, Math.floor(tier));
  if (safeTier <= 0) return "bow";
  const idx = (safeTier - 1) % WEAPON_CYCLE.length;
  return WEAPON_CYCLE[idx] ?? "bow";
}
