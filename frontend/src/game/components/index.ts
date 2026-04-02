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

export type PlayerTag = Record<string, never>;
export type EnemyTag = Record<string, never>;
export type ProjectileTag = Record<string, never>;
export type DeadTag = Record<string, never>;
export type LaserTag = Record<string, never>;

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
