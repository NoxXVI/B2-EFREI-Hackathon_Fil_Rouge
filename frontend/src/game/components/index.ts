// src/game/components/index.ts
export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
  speed: number;
}

export interface Health {
  current: number;
  max: number;
  isDead: boolean;
}

export interface Invulnerable {
  timer: number;
  duration: number;
}

export interface SpriteComponent {
  width: number;
  height: number;
  anchor: number;
}

export interface PlayerAppearance {
  name: string;
  color: number;
}

export interface NetworkPlayer {
  id: string;
}

export interface PlayerProgress {
  level: number;
  xp: number;
  xpToNext: number;
  skillPoints: number;
}

export interface CombatStats {
  fireRateMultiplier: number;
  damageBonus: number;
  multishot: number;
  critChance: number;
  critMultiplier: number;
  homingStrength: number;
}

export interface ProjectileStats {
  damage: number;
  critChance: number;
  critMultiplier: number;
  homingStrength: number;
}

export type ProjectileTextureKey =
  | "arrow"
  | "arrow_01"
  | "arrow_02"
  | "arrow_03";

export interface ProjectileAppearance {
  texture: ProjectileTextureKey;
  tint?: number;
}

export type WeaponType =
  | "bow"
  | "crossbow"
  | "longbow"
  | "scatterbow"
  | "arcane_wand";

export interface WeaponState {
  type: WeaponType;
}

export type PlayerTag = Record<string, never>;
export type LocalPlayerTag = Record<string, never>;
export type RemotePlayerTag = Record<string, never>;
export type EnemyTag = Record<string, never>;
export type ProjectileTag = Record<string, never>;
export type DeadTag = Record<string, never>;
export type LaserTag = Record<string, never>;
export type BombTag = Record<string, never>;
export type ExplosionFxTag = Record<string, never>;

export type TimerComponent = {
  timeLeft: number;
};

export interface LaserStats {
  length: number;
  damage: number;
}

export interface FollowTarget {
  entity: number;
}

export interface ContactDamage {
  amount: number;
  radius?: number;
}

export interface BossStats {
  laserDamage: number;
  laserCooldownMS: number;
  laserDurationMS: number;
  laserLength: number;
  laserCount: number;
  stopDistance: number;
}

export interface HealPickup {
  amount: number;
}

export type PowerPickupType =
  | "fireRate"
  | "damage"
  | "multishot"
  | "crit"
  | "homing";

export interface PowerPickup {
  type: PowerPickupType;
}

export interface HazardCooldown {
  timer: number;
}

export interface ShieldState {
  activeMS: number;
  cooldownMS: number;
}

export interface DashState {
  activeMS: number;
  cooldownMS: number;
  dirX: number;
  dirY: number;
  lastDirX: number;
  lastDirY: number;
}

export interface Bomb {
  owner: number | null;
  fuseMS: number;
  radius: number;
  damage: number;
}

export interface BombThrower {
  cooldownMS: number;
}

export interface ExplosionFx {
  radius: number;
}
