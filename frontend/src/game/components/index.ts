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

export interface SpriteComponent {
  // Optionnel : référence vers le sprite PixiJS (à lier côté React/Pixi)
  asset: string;
  width: number;
  height: number;
  anchor: number; // ex: 0.5 pour centrer
}

// Les "Tags" sont des composants sans données (juste pour filtrer)
export interface PlayerTag {}
export interface EnemyTag {}
