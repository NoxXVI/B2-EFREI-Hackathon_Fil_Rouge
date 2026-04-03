// MapData.ts — génération d'une grande map "forêt"

export const MAP_TILE_SIZE = 16;

// Taille de la map (en tuiles)
export const MAP_COLS = 100;
export const MAP_ROWS = 80;

// 0 = vide (non utilisé ici), 1 = mur/obstacle, 2 = sol
export const TILE_EMPTY = 0 as const;
export const TILE_WALL = 1 as const;
export const TILE_FLOOR = 2 as const;
export const TILE_TREE = 3 as const;
export const TILE_BUSH = 4 as const;

type Tile =
  | typeof TILE_EMPTY
  | typeof TILE_WALL
  | typeof TILE_FLOOR
  | typeof TILE_TREE
  | typeof TILE_BUSH;

const MAP_SEED = 1337;

function seededRand01(x: number, y: number, seed: number): number {
  let h = Math.imul(x ^ seed, 0x9e3779b1) ^ Math.imul(y ^ seed, 0x85ebca6b);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return h / 0xffffffff;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

function clearCircle(grid: Tile[][], cx: number, cy: number, radius: number) {
  const r2 = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (y <= 0 || y >= grid.length - 1) continue;
      if (x <= 0 || x >= grid[0].length - 1) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) grid[y][x] = TILE_FLOOR;
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
) {
  let x = startX;
  let y = startY;
  const cols = grid[0].length;
  const rows = grid.length;
  const trailRadius = 2; // largeur du chemin = trailRadius*2+1

  for (let step = 0; step < cols + rows; step++) {
    for (let oy = -trailRadius; oy <= trailRadius; oy++) {
      for (let ox = -trailRadius; ox <= trailRadius; ox++) {
        const tx = clamp(x + ox, 1, cols - 2);
        const ty = clamp(y + oy, 1, rows - 2);
        grid[ty][tx] = TILE_FLOOR;
      }
    }

    if (x <= 1 || x >= cols - 2 || y <= 1 || y >= rows - 2) break;

    // petite variation pour un chemin plus "naturel"
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

function generateForestGrid(
  cols: number,
  rows: number,
  seed: number,
): Tile[][] {
  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_FLOOR),
  );

  // Bordures bloquantes (évite de sortir de la map)
  for (let x = 0; x < cols; x++) {
    grid[0][x] = TILE_TREE;
    grid[rows - 1][x] = TILE_TREE;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = TILE_TREE;
    grid[y][cols - 1] = TILE_TREE;
  }

  const area = cols * rows;
  type Cluster = { cx: number; cy: number; r: number };
  const clusters: Cluster[] = [];
  const clusterGap = 2;

  const stampCluster = (
    cx: number,
    cy: number,
    r: number,
    tileType: typeof TILE_WALL | typeof TILE_TREE | typeof TILE_BUSH,
    stampSeed: number,
  ) => {
    const scaleX = 0.85 + seededRand01(cx, cy, stampSeed) * 0.3; // 0.85..1.15
    const scaleY = 0.85 + seededRand01(cx, cy, stampSeed + 1) * 0.3;

    for (let y = cy - r - 1; y <= cy + r + 1; y++) {
      if (y <= 0 || y >= rows - 1) continue;
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        if (x <= 0 || x >= cols - 1) continue;

        const dx = (x - cx) / scaleX;
        const dy = (y - cy) / scaleY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noise = 0.85 + seededRand01(x, y, stampSeed + 2) * 0.3; // 0.85..1.15

        if (dist <= r * noise) {
          grid[y][x] = tileType;
        }
      }
    }
  };

  const placeClusters = (
    count: number,
    tileType: typeof TILE_WALL | typeof TILE_TREE | typeof TILE_BUSH,
    rMin: number,
    rMax: number,
    seedOffset: number,
  ) => {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const rr =
          rMin +
          Math.floor(seededRand01(i, attempt, seedOffset) * (rMax - rMin + 1));

        const cx =
          1 +
          rr +
          Math.floor(
            seededRand01(i, attempt + 31, seedOffset + 1) *
              Math.max(1, cols - 2 - rr * 2),
          );
        const cy =
          1 +
          rr +
          Math.floor(
            seededRand01(i, attempt + 79, seedOffset + 2) *
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

        stampCluster(cx, cy, rr, tileType, seedOffset + i * 13);
        clusters.push({ cx, cy, r: rr });
        break;
      }
    }
  };

  // Obstacles: plus petits et mieux séparés (les ennemis se coincent moins)
  const rockCount = Math.max(18, Math.floor(area / 360));
  const treeCount = Math.max(22, Math.floor(area / 320));
  const bushCount = Math.max(14, Math.floor(area / 520));

  placeClusters(rockCount, TILE_WALL, 1, 3, seed + 11000);
  placeClusters(treeCount, TILE_TREE, 1, 3, seed + 12000);
  placeClusters(bushCount, TILE_BUSH, 1, 2, seed + 13000);

  // Quelques clairières
  const clearingCount = Math.max(6, Math.floor(area / 700));
  for (let i = 0; i < clearingCount; i++) {
    const cx =
      2 + Math.floor(seededRand01(i, 3, seed + 3000) * Math.max(1, cols - 4));
    const cy =
      2 + Math.floor(seededRand01(i, 4, seed + 3000) * Math.max(1, rows - 4));
    const radius = 4 + Math.floor(seededRand01(i, 5, seed + 3000) * 5); // 4..8
    clearCircle(grid, cx, cy, radius);
  }

  // Assure des chemins (du centre vers les bords)
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  clearCircle(grid, centerX, centerY, 7);
  carveTrail(grid, centerX, centerY, 1, 0, seed + 4000);
  carveTrail(grid, centerX, centerY, -1, 0, seed + 4001);
  carveTrail(grid, centerX, centerY, 0, 1, seed + 4002);
  carveTrail(grid, centerX, centerY, 0, -1, seed + 4003);

  // Re-bordure (au cas où un carving aurait touché les bords)
  for (let x = 0; x < cols; x++) {
    grid[0][x] = TILE_TREE;
    grid[rows - 1][x] = TILE_TREE;
  }
  for (let y = 0; y < rows; y++) {
    grid[y][0] = TILE_TREE;
    grid[y][cols - 1] = TILE_TREE;
  }

  return grid;
}

function isWallTile(value: number): boolean {
  return value !== TILE_FLOOR && value !== TILE_EMPTY;
}

function buildWallRects(grid: number[][]): [number, number, number, number][] {
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
        rects[existingIndex][3] += MAP_TILE_SIZE;
        nextActive.set(key, existingIndex);
      } else {
        rects.push([
          startX * MAP_TILE_SIZE,
          y * MAP_TILE_SIZE,
          widthTiles * MAP_TILE_SIZE,
          MAP_TILE_SIZE,
        ]);
        nextActive.set(key, rects.length - 1);
      }
    }

    active = nextActive;
  }

  return rects;
}

function findNearestFloor(grid: Tile[][], startX: number, startY: number) {
  const cols = grid[0].length;
  const rows = grid.length;

  for (let r = 0; r < Math.max(cols, rows); r++) {
    for (let y = startY - r; y <= startY + r; y++) {
      for (let x = startX - r; x <= startX + r; x++) {
        if (x <= 0 || x >= cols - 1 || y <= 0 || y >= rows - 1) continue;
        if (grid[y][x] === TILE_FLOOR) return [x, y] as const;
      }
    }
  }
  return [startX, startY] as const;
}

function toPixel(tileX: number, tileY: number): [number, number] {
  return [
    tileX * MAP_TILE_SIZE + MAP_TILE_SIZE / 2,
    tileY * MAP_TILE_SIZE + MAP_TILE_SIZE / 2,
  ];
}

const grid = generateForestGrid(MAP_COLS, MAP_ROWS, MAP_SEED);

// Spawn joueur : proche du centre
const [playerTileX, playerTileY] = findNearestFloor(
  grid,
  Math.floor(MAP_COLS / 2),
  Math.floor(MAP_ROWS / 2),
);
clearCircle(grid, playerTileX, playerTileY, 3);
export const PLAYER_SPAWN: [number, number] = toPixel(playerTileX, playerTileY);

// Spawns ennemis (20 points) : sur du sol, pas trop proche du joueur
const enemySpawnTiles: [number, number][] = [];
const used = new Set<string>([`${playerTileX},${playerTileY}`]);
const minDistTiles = 18;

for (let i = 0; i < 20; i++) {
  let chosen: [number, number] | null = null;

  for (let attempt = 0; attempt < 800; attempt++) {
    const rx = seededRand01(i, attempt, MAP_SEED + 5000);
    const ry = seededRand01(i, attempt + 999, MAP_SEED + 5000);
    const x = 1 + Math.floor(rx * (MAP_COLS - 2));
    const y = 1 + Math.floor(ry * (MAP_ROWS - 2));

    if (grid[y][x] !== TILE_FLOOR) continue;

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
    clamp(playerTileX + 10 + i, 1, MAP_COLS - 2),
    clamp(playerTileY + 10 + i, 1, MAP_ROWS - 2),
  ];

  const [sx, sy] = chosen ?? fallback;
  enemySpawnTiles.push([sx, sy]);
  clearCircle(grid, sx, sy, 2);
}

export const ENEMY_SPAWNS: [number, number][] = enemySpawnTiles.map((t) =>
  toPixel(t[0], t[1]),
);

export const MAP_GRID: number[][] = grid;

// Rectangles de collision des murs [x, y, width, height] en pixels
export const WALL_RECTS: [number, number, number, number][] =
  buildWallRects(MAP_GRID);
