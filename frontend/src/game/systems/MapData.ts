// MapData.ts — génération de maps (biomes) + progression par level

export const MAP_TILE_SIZE = 16;
export const DEFAULT_MAP_COLS = 200;
export const DEFAULT_MAP_ROWS = 160;

export const TILE_EMPTY = 0 as const;
export const TILE_WALL = 1 as const;
export const TILE_FLOOR = 2 as const;
export const TILE_TREE = 3 as const;
export const TILE_BUSH = 4 as const;
export const TILE_PILLAR = 5 as const;
export const TILE_STATUE = 6 as const;
export const TILE_LAVA = 7 as const;
export const TILE_RUBBLE = 8 as const;
export const TILE_CARPET = 9 as const;

export type Tile =
  | typeof TILE_EMPTY
  | typeof TILE_WALL
  | typeof TILE_FLOOR
  | typeof TILE_TREE
  | typeof TILE_BUSH
  | typeof TILE_PILLAR
  | typeof TILE_STATUE
  | typeof TILE_LAVA
  | typeof TILE_RUBBLE
  | typeof TILE_CARPET;

export type MapTheme =
  | "forest"
  | "fairy_forest"
  | "dungeon"
  | "kings_hall"
  | "castle_courtyard"
  | "battlefield"
  | "rocky_lava"
  | "volcanic";

export interface MapMeta {
  name: string;
  description: string;
}

export interface GeneratedMap extends MapMeta {
  theme: MapTheme;
  cols: number;
  rows: number;
  tileSize: number;
  grid: number[][];
  wallRects: [number, number, number, number][];
  playerSpawn: [number, number];
  enemySpawns: [number, number][];
}

const BASE_SEED = 1337;

export function getMapThemeForLevel(level: number): MapTheme {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel >= 50) return "volcanic";
  if (safeLevel >= 40) return "rocky_lava";
  if (safeLevel >= 35) return "battlefield";
  if (safeLevel >= 25) return "castle_courtyard";
  if (safeLevel >= 20) return "kings_hall";
  if (safeLevel >= 10) return "dungeon";
  if (safeLevel >= 5) return "fairy_forest";
  return "forest";
}

export function getMapMeta(theme: MapTheme): MapMeta {
  switch (theme) {
    case "forest":
      return { name: "Forêt", description: "Une forêt dense et sauvage." };
    case "fairy_forest":
      return {
        name: "Forêt féerique",
        description: "Une clairière enchantée digne d’un conte de fées.",
      };
    case "dungeon":
      return {
        name: "Donjon",
        description: "Couloirs sombres et salles humides.",
      };
    case "kings_hall":
      return {
        name: "Salle du roi",
        description: "Un grand hall royal, marbre et tapis écarlate.",
      };
    case "castle_courtyard":
      return {
        name: "Cour du château",
        description: "Une cour ouverte, pavés, haies et fontaine.",
      };
    case "battlefield":
      return {
        name: "Champ de bataille",
        description: "Terrain boueux, débris et barricades.",
      };
    case "rocky_lava":
      return {
        name: "Zone rocheuse",
        description: "Rochers noirs et quelques poches de lave.",
      };
    case "volcanic":
      return {
        name: "Volcan",
        description: "Une fournaise volcanique: la lave est partout.",
      };
  }
}

export function isWalkableTile(value: number): boolean {
  return value === TILE_FLOOR || value === TILE_CARPET;
}

function isWallTile(value: number): boolean {
  return value !== TILE_EMPTY && !isWalkableTile(value);
}

function seededRand01(x: number, y: number, seed: number): number {
  let h = Math.imul(x ^ seed, 0x9e3779b1) ^ Math.imul(y ^ seed, 0x85ebca6b);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return h / 0xffffffff;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function themeHash(theme: MapTheme): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < theme.length; i++) {
    h ^= theme.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function seedForTheme(theme: MapTheme, seed: number): number {
  return (seed + themeHash(theme)) >>> 0;
}

function clearCircleTo(
  grid: Tile[][],
  cx: number,
  cy: number,
  radius: number,
  tile: Tile,
) {
  const r2 = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (y <= 0 || y >= grid.length - 1) continue;
      if (x <= 0 || x >= grid[0].length - 1) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) grid[y][x] = tile;
    }
  }
}

function carveTrail(
  grid: Tile[][],
  startX: number,
  startY: number,
  dirX: number,
  dirY: number,
  seed: number,
  tile: Tile = TILE_FLOOR,
) {
  let x = startX;
  let y = startY;
  const cols = grid[0].length;
  const rows = grid.length;
  const trailRadius = 2;

  for (let step = 0; step < cols + rows; step++) {
    for (let oy = -trailRadius; oy <= trailRadius; oy++) {
      for (let ox = -trailRadius; ox <= trailRadius; ox++) {
        const tx = clamp(x + ox, 1, cols - 2);
        const ty = clamp(y + oy, 1, rows - 2);
        grid[ty][tx] = tile;
      }
    }

    if (x <= 1 || x >= cols - 2 || y <= 1 || y >= rows - 2) break;

    const jitter = seededRand01(step, x + y, seed);
    const j = jitter < 0.33 ? -1 : jitter < 0.66 ? 0 : 1;

    if (dirX !== 0) {
      x += dirX;
      y += j;
    } else {
      y += dirY;
      x += j;
    }
  }
}

type Rect = { x: number; y: number; w: number; h: number };

function carveRect(grid: Tile[][], rect: Rect, tile: Tile = TILE_FLOOR) {
  const rows = grid.length;
  const cols = grid[0].length;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    if (y <= 0 || y >= rows - 1) continue;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x <= 0 || x >= cols - 1) continue;
      grid[y][x] = tile;
    }
  }
}

function stampCluster(
  grid: Tile[][],
  cx: number,
  cy: number,
  r: number,
  tileType: Tile,
  stampSeed: number,
) {
  const rows = grid.length;
  const cols = grid[0].length;
  const scaleX = 0.85 + seededRand01(cx, cy, stampSeed) * 0.3;
  const scaleY = 0.85 + seededRand01(cx, cy, stampSeed + 1) * 0.3;

  for (let y = cy - r - 1; y <= cy + r + 1; y++) {
    if (y <= 0 || y >= rows - 1) continue;
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      if (x <= 0 || x >= cols - 1) continue;

      const dx = (x - cx) / scaleX;
      const dy = (y - cy) / scaleY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const noise = 0.85 + seededRand01(x, y, stampSeed + 2) * 0.3;

      if (dist <= r * noise) {
        grid[y][x] = tileType;
      }
    }
  }
}

function placeClusters(options: {
  grid: Tile[][];
  count: number;
  tileType: Tile;
  rMin: number;
  rMax: number;
  seed: number;
  clusters?: Array<{ cx: number; cy: number; r: number }>;
  clusterGap?: number;
}) {
  const { grid, count, tileType, rMin, rMax, seed } = options;
  const rows = grid.length;
  const cols = grid[0].length;
  const clusters = options.clusters ?? [];
  const clusterGap = options.clusterGap ?? 2;

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const rr =
        rMin + Math.floor(seededRand01(i, attempt, seed) * (rMax - rMin + 1));
      const cx =
        1 +
        rr +
        Math.floor(
          seededRand01(i, attempt + 31, seed + 1) *
            Math.max(1, cols - 2 - rr * 2),
        );
      const cy =
        1 +
        rr +
        Math.floor(
          seededRand01(i, attempt + 79, seed + 2) *
            Math.max(1, rows - 2 - rr * 2),
        );

      let ok = true;
      for (const c of clusters) {
        const dx = cx - c.cx;
        const dy = cy - c.cy;
        const minDist = rr + c.r + clusterGap;
        if (dx * dx + dy * dy < minDist * minDist) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      stampCluster(grid, cx, cy, rr, tileType, seed + i * 13);
      clusters.push({ cx, cy, r: rr });
      break;
    }
  }
}

function generateForestLikeGrid(params: {
  cols: number;
  rows: number;
  seed: number;
  borderTile: Tile;
  rockFactor: number;
  treeFactor: number;
  bushFactor: number;
  clearingFactor: number;
  extraObstacleTile?: Tile;
  extraObstacleFactor?: number;
}): Tile[][] {
  const { cols, rows, seed } = params;
  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_FLOOR),
  );

  // Bordures bloquantes
  for (let x = 0; x < cols; x++) {
    grid[0][x] = params.borderTile;
    grid[rows - 1][x] = params.borderTile;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = params.borderTile;
    grid[y][cols - 1] = params.borderTile;
  }

  const area = cols * rows;
  const clusters: Array<{ cx: number; cy: number; r: number }> = [];

  const rockCount = Math.max(14, Math.floor((area / 360) * params.rockFactor));
  const treeCount = Math.max(18, Math.floor((area / 320) * params.treeFactor));
  const bushCount = Math.max(12, Math.floor((area / 520) * params.bushFactor));

  placeClusters({
    grid,
    count: rockCount,
    tileType: TILE_WALL,
    rMin: 1,
    rMax: 3,
    seed: seed + 11000,
    clusters,
    clusterGap: 2,
  });
  placeClusters({
    grid,
    count: treeCount,
    tileType: TILE_TREE,
    rMin: 1,
    rMax: 3,
    seed: seed + 12000,
    clusters,
    clusterGap: 2,
  });
  placeClusters({
    grid,
    count: bushCount,
    tileType: TILE_BUSH,
    rMin: 1,
    rMax: 2,
    seed: seed + 13000,
    clusters,
    clusterGap: 2,
  });

  if (params.extraObstacleTile && params.extraObstacleFactor) {
    const extraCount = Math.max(
      8,
      Math.floor((area / 700) * params.extraObstacleFactor),
    );
    placeClusters({
      grid,
      count: extraCount,
      tileType: params.extraObstacleTile,
      rMin: 1,
      rMax: 2,
      seed: seed + 14000,
      clusters,
      clusterGap: 2,
    });
  }

  // Clairières
  const clearingCount = Math.max(
    5,
    Math.floor((area / 700) * params.clearingFactor),
  );
  for (let i = 0; i < clearingCount; i++) {
    const cx =
      2 + Math.floor(seededRand01(i, 3, seed + 3000) * Math.max(1, cols - 4));
    const cy =
      2 + Math.floor(seededRand01(i, 4, seed + 3000) * Math.max(1, rows - 4));
    const radius = 4 + Math.floor(seededRand01(i, 5, seed + 3000) * 5);
    clearCircleTo(grid, cx, cy, radius, TILE_FLOOR);
  }

  // Chemins depuis le centre
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  clearCircleTo(grid, centerX, centerY, 7, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, 1, 0, seed + 4000, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, -1, 0, seed + 4001, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, 0, 1, seed + 4002, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, 0, -1, seed + 4003, TILE_FLOOR);

  // Re-bordure
  for (let x = 0; x < cols; x++) {
    grid[0][x] = params.borderTile;
    grid[rows - 1][x] = params.borderTile;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = params.borderTile;
    grid[y][cols - 1] = params.borderTile;
  }

  return grid;
}

function generateForestGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  return generateForestLikeGrid({
    cols,
    rows,
    seed,
    borderTile: TILE_TREE,
    rockFactor: 1,
    treeFactor: 1,
    bushFactor: 1,
    clearingFactor: 1,
  });
}

function generateFairyForestGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  return generateForestLikeGrid({
    cols,
    rows,
    seed,
    borderTile: TILE_TREE,
    rockFactor: 0.8,
    treeFactor: 0.9,
    bushFactor: 1.35,
    clearingFactor: 1.4,
    extraObstacleTile: TILE_STATUE,
    extraObstacleFactor: 0.55,
  });
}

function generateDungeonGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_WALL),
  );

  const rooms: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    cx: number;
    cy: number;
  }> = [];
  const roomCount = 9;
  const gap = 2;

  for (let i = 0; i < roomCount; i++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const w = 10 + Math.floor(seededRand01(i, attempt, seed + 10) * 16); // 10..25
      const h = 8 + Math.floor(seededRand01(i, attempt, seed + 11) * 14); // 8..21
      const x =
        2 +
        Math.floor(
          seededRand01(i, attempt, seed + 12) * Math.max(1, cols - w - 4),
        );
      const y =
        2 +
        Math.floor(
          seededRand01(i, attempt, seed + 13) * Math.max(1, rows - h - 4),
        );

      const rect: Rect = { x, y, w, h };

      let ok = true;
      for (const r of rooms) {
        const ax1 = rect.x - gap;
        const ay1 = rect.y - gap;
        const ax2 = rect.x + rect.w + gap;
        const ay2 = rect.y + rect.h + gap;
        const bx1 = r.x;
        const by1 = r.y;
        const bx2 = r.x + r.w;
        const by2 = r.y + r.h;
        const overlap = ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
        if (overlap) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      carveRect(grid, rect, TILE_FLOOR);
      rooms.push({
        ...rect,
        cx: x + Math.floor(w / 2),
        cy: y + Math.floor(h / 2),
      });
      break;
    }
  }

  // Au moins une grande salle centrale
  const centerRoom: Rect = {
    x: Math.floor(cols / 2) - 18,
    y: Math.floor(rows / 2) - 14,
    w: 36,
    h: 28,
  };
  carveRect(grid, centerRoom, TILE_FLOOR);
  rooms.push({
    ...centerRoom,
    cx: centerRoom.x + Math.floor(centerRoom.w / 2),
    cy: centerRoom.y + Math.floor(centerRoom.h / 2),
  });

  const corridorHalf = 1;
  const carveCorridor = (x1: number, y1: number, x2: number, y2: number) => {
    let x = x1;
    let y = y1;
    const stepX = x2 >= x1 ? 1 : -1;
    const stepY = y2 >= y1 ? 1 : -1;

    while (x !== x2) {
      for (let oy = -corridorHalf; oy <= corridorHalf; oy++) {
        const ty = clamp(y + oy, 1, rows - 2);
        grid[ty][x] = TILE_FLOOR;
      }
      x += stepX;
    }
    while (y !== y2) {
      for (let ox = -corridorHalf; ox <= corridorHalf; ox++) {
        const tx = clamp(x + ox, 1, cols - 2);
        grid[y][tx] = TILE_FLOOR;
      }
      y += stepY;
    }
  };

  // Connecte les rooms en chaîne
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  }

  // Piliers dans les grandes rooms
  for (const r of rooms) {
    if (r.w * r.h < 300) continue;
    for (let y = r.y + 3; y < r.y + r.h - 3; y += 6) {
      for (let x = r.x + 3; x < r.x + r.w - 3; x += 6) {
        const roll = seededRand01(x, y, seed + 9000);
        if (roll < 0.55) continue;
        grid[y][x] = TILE_PILLAR;
      }
    }
  }

  // Bordures (murs)
  for (let x = 0; x < cols; x++) {
    grid[0][x] = TILE_WALL;
    grid[rows - 1][x] = TILE_WALL;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = TILE_WALL;
    grid[y][cols - 1] = TILE_WALL;
  }

  return grid;
}

function generateKingsHallGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_WALL),
  );

  // Grand hall
  const marginX = 8;
  const marginY = 10;
  carveRect(
    grid,
    {
      x: marginX,
      y: marginY,
      w: cols - marginX * 2,
      h: rows - marginY * 2,
    },
    TILE_FLOOR,
  );

  // Tapis central (carpet)
  const carpetW = 10;
  const cx = Math.floor(cols / 2) - Math.floor(carpetW / 2);
  for (let y = marginY; y < rows - marginY; y++) {
    for (let x = cx; x < cx + carpetW; x++) {
      if (x <= 0 || x >= cols - 1) continue;
      grid[y][x] = TILE_CARPET;
    }
  }

  // Piliers de chaque côté
  for (let y = marginY + 6; y < rows - marginY - 6; y += 10) {
    for (const x of [marginX + 5, cols - marginX - 6]) {
      grid[y][x] = TILE_PILLAR;
      grid[y][x + 1] = TILE_PILLAR;
    }
  }

  // Statues près du "trône"
  const topY = marginY + 3;
  grid[topY][cx - 6] = TILE_STATUE;
  grid[topY][cx + carpetW + 5] = TILE_STATUE;

  // Laisse une zone de spawn confortable au centre
  clearCircleTo(
    grid,
    Math.floor(cols / 2),
    Math.floor(rows / 2),
    6,
    TILE_FLOOR,
  );

  // Bordures
  for (let x = 0; x < cols; x++) {
    grid[0][x] = TILE_WALL;
    grid[rows - 1][x] = TILE_WALL;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = TILE_WALL;
    grid[y][cols - 1] = TILE_WALL;
  }

  // Petite variation: quelques débris
  placeClusters({
    grid,
    count: Math.max(8, Math.floor((cols * rows) / 1600)),
    tileType: TILE_RUBBLE,
    rMin: 1,
    rMax: 2,
    seed: seed + 16000,
    clusters: [],
    clusterGap: 3,
  });

  return grid;
}

function generateCourtyardGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_FLOOR),
  );

  // Bordures en murs
  for (let x = 0; x < cols; x++) {
    grid[0][x] = TILE_WALL;
    grid[rows - 1][x] = TILE_WALL;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = TILE_WALL;
    grid[y][cols - 1] = TILE_WALL;
  }

  // Fontaine centrale (statues)
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const x = centerX + Math.round(Math.cos(ang) * 5);
    const y = centerY + Math.round(Math.sin(ang) * 5);
    if (x > 1 && x < cols - 2 && y > 1 && y < rows - 2)
      grid[y][x] = TILE_STATUE;
  }
  clearCircleTo(grid, centerX, centerY, 3, TILE_FLOOR);

  // Haies (buissons) et quelques arbres pour structurer
  placeClusters({
    grid,
    count: Math.max(28, Math.floor((cols * rows) / 420)),
    tileType: TILE_BUSH,
    rMin: 1,
    rMax: 3,
    seed: seed + 17000,
    clusters: [],
    clusterGap: 2,
  });
  placeClusters({
    grid,
    count: Math.max(18, Math.floor((cols * rows) / 520)),
    tileType: TILE_TREE,
    rMin: 1,
    rMax: 3,
    seed: seed + 17100,
    clusters: [],
    clusterGap: 2,
  });

  // Allées principales (croix)
  carveTrail(grid, centerX, centerY, 1, 0, seed + 17200, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, -1, 0, seed + 17201, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, 0, 1, seed + 17202, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, 0, -1, seed + 17203, TILE_FLOOR);
  clearCircleTo(grid, centerX, centerY, 7, TILE_FLOOR);

  return grid;
}

function generateBattlefieldGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_FLOOR),
  );

  // Bordures en débris (empêche de sortir)
  for (let x = 0; x < cols; x++) {
    grid[0][x] = TILE_RUBBLE;
    grid[rows - 1][x] = TILE_RUBBLE;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = TILE_RUBBLE;
    grid[y][cols - 1] = TILE_RUBBLE;
  }

  const area = cols * rows;
  placeClusters({
    grid,
    count: Math.max(26, Math.floor(area / 420)),
    tileType: TILE_RUBBLE,
    rMin: 1,
    rMax: 3,
    seed: seed + 18000,
    clusters: [],
    clusterGap: 2,
  });
  placeClusters({
    grid,
    count: Math.max(14, Math.floor(area / 850)),
    tileType: TILE_WALL,
    rMin: 1,
    rMax: 2,
    seed: seed + 18100,
    clusters: [],
    clusterGap: 3,
  });

  // Quelques cratères (clairières)
  const craterCount = Math.max(8, Math.floor(area / 900));
  for (let i = 0; i < craterCount; i++) {
    const cx =
      2 + Math.floor(seededRand01(i, 1, seed + 18200) * Math.max(1, cols - 4));
    const cy =
      2 + Math.floor(seededRand01(i, 2, seed + 18200) * Math.max(1, rows - 4));
    const radius = 3 + Math.floor(seededRand01(i, 3, seed + 18200) * 5);
    clearCircleTo(grid, cx, cy, radius, TILE_FLOOR);
  }

  return grid;
}

function generateRockyLavaGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_FLOOR),
  );

  // Bordures rocheuses
  for (let x = 0; x < cols; x++) {
    grid[0][x] = TILE_WALL;
    grid[rows - 1][x] = TILE_WALL;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = TILE_WALL;
    grid[y][cols - 1] = TILE_WALL;
  }

  const area = cols * rows;
  placeClusters({
    grid,
    count: Math.max(22, Math.floor(area / 520)),
    tileType: TILE_WALL,
    rMin: 1,
    rMax: 3,
    seed: seed + 19000,
    clusters: [],
    clusterGap: 2,
  });
  placeClusters({
    grid,
    count: Math.max(10, Math.floor(area / 1400)),
    tileType: TILE_LAVA,
    rMin: 2,
    rMax: 4,
    seed: seed + 19100,
    clusters: [],
    clusterGap: 3,
  });

  // Un couloir traversant pour éviter les maps "bloquées"
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  clearCircleTo(grid, centerX, centerY, 7, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, 1, 0, seed + 19200, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, -1, 0, seed + 19201, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, 0, 1, seed + 19202, TILE_FLOOR);
  carveTrail(grid, centerX, centerY, 0, -1, seed + 19203, TILE_FLOOR);

  return grid;
}

function generateVolcanicGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  const grid = generateRockyLavaGrid(cols, rows, seed + 2000);

  const area = cols * rows;
  // Plus de lave
  placeClusters({
    grid,
    count: Math.max(16, Math.floor(area / 900)),
    tileType: TILE_LAVA,
    rMin: 2,
    rMax: 6,
    seed: seed + 20000,
    clusters: [],
    clusterGap: 3,
  });

  // Une "rivière" de lave (diagonale)
  const startX = 2 + Math.floor(seededRand01(1, 1, seed + 20100) * (cols - 4));
  const startY = 2 + Math.floor(seededRand01(2, 2, seed + 20100) * (rows - 4));
  carveTrail(grid, startX, startY, 1, 1, seed + 20110, TILE_LAVA);
  carveTrail(grid, startX, startY, 1, -1, seed + 20111, TILE_LAVA);

  // Garantit un gros espace central jouable
  clearCircleTo(
    grid,
    Math.floor(cols / 2),
    Math.floor(rows / 2),
    11,
    TILE_FLOOR,
  );

  return grid;
}

function buildWallRects(
  grid: number[][],
  tileSize: number,
): [number, number, number, number][] {
  const rects: [number, number, number, number][] = [];
  const cols = grid[0].length;
  const rows = grid.length;

  let active = new Map<string, number>();

  for (let y = 0; y < rows; y++) {
    const nextActive = new Map<string, number>();

    let x = 0;
    while (x < cols) {
      if (!isWallTile(grid[y][x])) {
        x++;
        continue;
      }

      const startX = x;
      while (x < cols && isWallTile(grid[y][x])) x++;
      const widthTiles = x - startX;

      const key = `${startX},${widthTiles}`;
      const existingIndex = active.get(key);

      if (existingIndex !== undefined) {
        rects[existingIndex][3] += tileSize;
        nextActive.set(key, existingIndex);
      } else {
        rects.push([
          startX * tileSize,
          y * tileSize,
          widthTiles * tileSize,
          tileSize,
        ]);
        nextActive.set(key, rects.length - 1);
      }
    }

    active = nextActive;
  }

  return rects;
}

function findNearestWalkable(grid: Tile[][], startX: number, startY: number) {
  const cols = grid[0].length;
  const rows = grid.length;

  for (let r = 0; r < Math.max(cols, rows); r++) {
    for (let y = startY - r; y <= startY + r; y++) {
      for (let x = startX - r; x <= startX + r; x++) {
        if (x <= 0 || x >= cols - 1 || y <= 0 || y >= rows - 1) continue;
        if (isWalkableTile(grid[y][x])) return [x, y] as const;
      }
    }
  }
  return [startX, startY] as const;
}

function toPixel(
  tileX: number,
  tileY: number,
  tileSize: number,
): [number, number] {
  return [tileX * tileSize + tileSize / 2, tileY * tileSize + tileSize / 2];
}

function buildSpawns(options: {
  grid: Tile[][];
  cols: number;
  rows: number;
  tileSize: number;
  seed: number;
}) {
  const { grid, cols, rows, tileSize, seed } = options;

  const [playerTileX, playerTileY] = findNearestWalkable(
    grid,
    Math.floor(cols / 2),
    Math.floor(rows / 2),
  );
  clearCircleTo(grid, playerTileX, playerTileY, 3, TILE_FLOOR);
  const playerSpawn = toPixel(playerTileX, playerTileY, tileSize);

  const enemySpawnTiles: [number, number][] = [];
  const used = new Set<string>([`${playerTileX},${playerTileY}`]);
  const minDistTiles = 18;

  for (let i = 0; i < 20; i++) {
    let chosen: [number, number] | null = null;

    for (let attempt = 0; attempt < 800; attempt++) {
      const rx = seededRand01(i, attempt, seed + 5000);
      const ry = seededRand01(i, attempt + 999, seed + 5000);
      const x = 1 + Math.floor(rx * (cols - 2));
      const y = 1 + Math.floor(ry * (rows - 2));

      if (!isWalkableTile(grid[y][x])) continue;

      const dx = x - playerTileX;
      const dy = y - playerTileY;
      if (dx * dx + dy * dy < minDistTiles * minDistTiles) continue;

      const key = `${x},${y}`;
      if (used.has(key)) continue;

      used.add(key);
      chosen = [x, y];
      break;
    }

    const fallback: [number, number] = [
      clamp(playerTileX + 10 + i, 1, cols - 2),
      clamp(playerTileY + 10 + i, 1, rows - 2),
    ];

    const [sx, sy] = chosen ?? fallback;
    enemySpawnTiles.push([sx, sy]);
    clearCircleTo(grid, sx, sy, 2, TILE_FLOOR);
  }

  const enemySpawns: [number, number][] = enemySpawnTiles.map((t) =>
    toPixel(t[0], t[1], tileSize),
  );

  return { playerSpawn, enemySpawns };
}

export function generateMap(
  theme: MapTheme,
  options?: { cols?: number; rows?: number; seed?: number },
): GeneratedMap {
  const cols = options?.cols ?? DEFAULT_MAP_COLS;
  const rows = options?.rows ?? DEFAULT_MAP_ROWS;
  const tileSize = MAP_TILE_SIZE;
  const seed = options?.seed ?? seedForTheme(theme, BASE_SEED);

  let grid: Tile[][];
  switch (theme) {
    case "forest":
      grid = generateForestGrid(cols, rows, seed);
      break;
    case "fairy_forest":
      grid = generateFairyForestGrid(cols, rows, seed);
      break;
    case "dungeon":
      grid = generateDungeonGrid(cols, rows, seed);
      break;
    case "kings_hall":
      grid = generateKingsHallGrid(cols, rows, seed);
      break;
    case "castle_courtyard":
      grid = generateCourtyardGrid(cols, rows, seed);
      break;
    case "battlefield":
      grid = generateBattlefieldGrid(cols, rows, seed);
      break;
    case "rocky_lava":
      grid = generateRockyLavaGrid(cols, rows, seed);
      break;
    case "volcanic":
      grid = generateVolcanicGrid(cols, rows, seed);
      break;
  }

  const { playerSpawn, enemySpawns } = buildSpawns({
    grid,
    cols,
    rows,
    tileSize,
    seed,
  });
  const wallRects = buildWallRects(grid, tileSize);
  const meta = getMapMeta(theme);

  return {
    theme,
    name: meta.name,
    description: meta.description,
    cols,
    rows,
    tileSize,
    grid,
    wallRects,
    playerSpawn,
    enemySpawns,
  };
}
