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

export interface PlayerTag {}
export interface EnemyTag {}
