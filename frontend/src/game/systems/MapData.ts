// MapData.ts — génération de maps (biomes) + transitions par niveau.

export const MAP_TILE_SIZE = 16;

// 0 = vide, 1 = mur/obstacle, 2 = sol
export const TILE_EMPTY = 0 as const;
export const TILE_WALL = 1 as const;
export const TILE_FLOOR = 2 as const;
export const TILE_TREE = 3 as const;
export const TILE_BUSH = 4 as const;

export type Tile =
  | typeof TILE_EMPTY
  | typeof TILE_WALL
  | typeof TILE_FLOOR
  | typeof TILE_TREE
  | typeof TILE_BUSH;

export type MapBiome = "forest" | "ice" | "dungeon" | "lava";
export type MapId = "forest_1" | "forest_2" | "ice_1" | "dungeon_1" | "lava_1";

export interface MapData {
  id: MapId;
  biome: MapBiome;
  name: string;
  cols: number;
  rows: number;
  tileSize: number;
  grid: Tile[][];
  wallRects: [number, number, number, number][];
  playerSpawn: [number, number];
  enemySpawns: [number, number][];
  backgroundColor: number;
}

export const DEFAULT_MAP_ID: MapId = "forest_1";

export const MAP_LEVEL_TARGETS: Array<{ level: number; mapId: MapId }> = [
  { level: 1, mapId: "forest_1" },
  { level: 10, mapId: "forest_2" },
  { level: 15, mapId: "ice_1" },
  { level: 20, mapId: "dungeon_1" },
  { level: 25, mapId: "lava_1" },
];

export function getMapDisplayName(mapId: MapId): string {
  switch (mapId) {
    case "forest_1":
      return "Forêt";
    case "forest_2":
      return "Forêt profonde";
    case "ice_1":
      return "Glacier";
    case "dungeon_1":
      return "Donjon";
    case "lava_1":
      return "Lave";
  }
}

export function getTargetMapIdForLevel(level: number): MapId {
  let current = DEFAULT_MAP_ID;
  for (const step of MAP_LEVEL_TARGETS) {
    if (level >= step.level) current = step.mapId;
  }
  return current;
}

function seededRand01(x: number, y: number, seed: number): number {
  let h = Math.imul(x ^ seed, 0x9e3779b1) ^ Math.imul(y ^ seed, 0x85ebca6b);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return h / 0xffffffff;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max));
}

function randInt(seed: number, a: number, b: number, min: number, max: number) {
  const r = seededRand01(a, b, seed);
  return min + Math.floor(r * (max - min + 1));
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
  trailRadius = 2,
) {
  let x = startX;
  let y = startY;
  const cols = grid[0].length;
  const rows = grid.length;

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

type Cluster = { cx: number; cy: number; r: number };

function generateClusterBiomeGrid(options: {
  cols: number;
  rows: number;
  seed: number;
  borderTile: typeof TILE_WALL | typeof TILE_TREE | typeof TILE_BUSH;
  clusterGap: number;
  clusters: Array<{
    count: number;
    tileType: typeof TILE_WALL | typeof TILE_TREE | typeof TILE_BUSH;
    rMin: number;
    rMax: number;
    seedOffset: number;
  }>;
  clearingCount: number;
  clearingRadiusMin: number;
  clearingRadiusMax: number;
  trailRadius: number;
}) {
  const { cols, rows } = options;

  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_FLOOR),
  );

  const setBorder = (tile: typeof options.borderTile) => {
    for (let x = 0; x < cols; x++) {
      grid[0][x] = tile;
      grid[rows - 1][x] = tile;
    }
    for (let y = 0; y < rows; y++) {
      grid[y][0] = tile;
      grid[y][cols - 1] = tile;
    }
  };

  setBorder(options.borderTile);

  const placed: Cluster[] = [];

  const stampCluster = (
    cx: number,
    cy: number,
    r: number,
    tileType: typeof TILE_WALL | typeof TILE_TREE | typeof TILE_BUSH,
    stampSeed: number,
  ) => {
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
  };

  const placeClusters = (spec: (typeof options.clusters)[number]) => {
    const { count, tileType, rMin, rMax, seedOffset } = spec;
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
        for (const c of placed) {
          const dx = cx - c.cx;
          const dy = cy - c.cy;
          const minDist = rr + c.r + options.clusterGap;
          if (dx * dx + dy * dy < minDist * minDist) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        stampCluster(cx, cy, rr, tileType, seedOffset + i * 13);
        placed.push({ cx, cy, r: rr });
        break;
      }
    }
  };

  for (const spec of options.clusters) {
    placeClusters(spec);
  }

  // Clairières
  for (let i = 0; i < options.clearingCount; i++) {
    const cx =
      2 +
      Math.floor(
        seededRand01(i, 3, options.seed + 3000) * Math.max(1, cols - 4),
      );
    const cy =
      2 +
      Math.floor(
        seededRand01(i, 4, options.seed + 3000) * Math.max(1, rows - 4),
      );
    const radius = randInt(
      options.seed + 3000,
      i,
      5,
      options.clearingRadiusMin,
      options.clearingRadiusMax,
    );
    clearCircle(grid, cx, cy, radius);
  }

  // Chemins (du centre vers les bords)
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);
  clearCircle(grid, centerX, centerY, 7);
  carveTrail(
    grid,
    centerX,
    centerY,
    1,
    0,
    options.seed + 4000,
    options.trailRadius,
  );
  carveTrail(
    grid,
    centerX,
    centerY,
    -1,
    0,
    options.seed + 4001,
    options.trailRadius,
  );
  carveTrail(
    grid,
    centerX,
    centerY,
    0,
    1,
    options.seed + 4002,
    options.trailRadius,
  );
  carveTrail(
    grid,
    centerX,
    centerY,
    0,
    -1,
    options.seed + 4003,
    options.trailRadius,
  );

  // Re-bordure (au cas où un carving aurait touché les bords)
  setBorder(options.borderTile);

  return grid;
}

function generateForestGrid(
  cols: number,
  rows: number,
  seed: number,
  variant: "normal" | "deep",
) {
  const area = cols * rows;
  const density = variant === "deep" ? 1.2 : 1;

  const rockCount = Math.max(18, Math.floor((area / 360) * density));
  const treeCount = Math.max(22, Math.floor((area / 320) * density));
  const bushCount = Math.max(14, Math.floor((area / 520) * density));

  const clearingCount = Math.max(6, Math.floor((area / 700) * (2 - density)));

  return generateClusterBiomeGrid({
    cols,
    rows,
    seed,
    borderTile: TILE_TREE,
    clusterGap: variant === "deep" ? 1 : 2,
    clusters: [
      {
        count: rockCount,
        tileType: TILE_WALL,
        rMin: 1,
        rMax: 3,
        seedOffset: seed + 11000,
      },
      {
        count: treeCount,
        tileType: TILE_TREE,
        rMin: 1,
        rMax: 3,
        seedOffset: seed + 12000,
      },
      {
        count: bushCount,
        tileType: TILE_BUSH,
        rMin: 1,
        rMax: 2,
        seedOffset: seed + 13000,
      },
    ],
    clearingCount,
    clearingRadiusMin: 4,
    clearingRadiusMax: 8,
    trailRadius: 2,
  });
}

function generateIceGrid(cols: number, rows: number, seed: number) {
  const area = cols * rows;

  const rockCount = Math.max(12, Math.floor(area / 520));
  const pillarCount = Math.max(10, Math.floor(area / 700));
  const snowCount = Math.max(10, Math.floor(area / 650));
  const clearingCount = Math.max(8, Math.floor(area / 600));

  return generateClusterBiomeGrid({
    cols,
    rows,
    seed,
    borderTile: TILE_WALL,
    clusterGap: 3,
    clusters: [
      {
        count: rockCount,
        tileType: TILE_WALL,
        rMin: 1,
        rMax: 3,
        seedOffset: seed + 21000,
      },
      {
        count: pillarCount,
        tileType: TILE_TREE,
        rMin: 1,
        rMax: 2,
        seedOffset: seed + 22000,
      },
      {
        count: snowCount,
        tileType: TILE_BUSH,
        rMin: 1,
        rMax: 2,
        seedOffset: seed + 23000,
      },
    ],
    clearingCount,
    clearingRadiusMin: 5,
    clearingRadiusMax: 10,
    trailRadius: 3,
  });
}

type Room = {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
};

function carveRect(
  grid: Tile[][],
  x: number,
  y: number,
  w: number,
  h: number,
  tile: Tile,
) {
  const rows = grid.length;
  const cols = grid[0].length;
  for (let ty = y; ty < y + h; ty++) {
    if (ty <= 0 || ty >= rows - 1) continue;
    for (let tx = x; tx < x + w; tx++) {
      if (tx <= 0 || tx >= cols - 1) continue;
      grid[ty][tx] = tile;
    }
  }
}

function carveCorridor(
  grid: Tile[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
) {
  const half = Math.max(0, Math.floor(width / 2));

  const carvePoint = (x: number, y: number) => {
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) {
        const tx = clamp(x + ox, 1, grid[0].length - 2);
        const ty = clamp(y + oy, 1, grid.length - 2);
        grid[ty][tx] = TILE_FLOOR;
      }
    }
  };

  let cx = x1;
  let cy = y1;
  const dx = x2 > x1 ? 1 : -1;
  const dy = y2 > y1 ? 1 : -1;

  while (cx !== x2) {
    carvePoint(cx, cy);
    cx += dx;
  }
  while (cy !== y2) {
    carvePoint(cx, cy);
    cy += dy;
  }
  carvePoint(cx, cy);
}

function generateDungeonGrid(cols: number, rows: number, seed: number) {
  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => TILE_WALL),
  );

  const rooms: Room[] = [];
  const roomCount = 12;
  const margin = 2;

  for (let i = 0; i < roomCount; i++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const w = randInt(seed + 7000, i, attempt, 7, 14);
      const h = randInt(seed + 7100, i, attempt, 6, 12);
      const x = randInt(seed + 7200, i, attempt, 2, cols - w - 3);
      const y = randInt(seed + 7300, i, attempt, 2, rows - h - 3);

      const x2 = x + w;
      const y2 = y + h;
      let overlaps = false;
      for (const r of rooms) {
        const rx1 = r.x - margin;
        const ry1 = r.y - margin;
        const rx2 = r.x + r.w + margin;
        const ry2 = r.y + r.h + margin;
        if (x < rx2 && x2 > rx1 && y < ry2 && y2 > ry1) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      carveRect(grid, x, y, w, h, TILE_FLOOR);
      rooms.push({
        x,
        y,
        w,
        h,
        cx: Math.floor(x + w / 2),
        cy: Math.floor(y + h / 2),
      });
      break;
    }
  }

  rooms.sort((a, b) => a.cx - b.cx);
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    const firstHorizontal = seededRand01(a.cx, a.cy, seed + i) < 0.5;
    if (firstHorizontal) {
      carveCorridor(grid, a.cx, a.cy, b.cx, a.cy, 2);
      carveCorridor(grid, b.cx, a.cy, b.cx, b.cy, 2);
    } else {
      carveCorridor(grid, a.cx, a.cy, a.cx, b.cy, 2);
      carveCorridor(grid, a.cx, b.cy, b.cx, b.cy, 2);
    }
  }

  // Piliers / caisses (obstacles variés) dans certaines salles
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const decorations = randInt(seed + 8000, r.cx, r.cy, 1, 4);
    for (let j = 0; j < decorations; j++) {
      const tx = randInt(seed + 8100, i, j, r.x + 2, r.x + r.w - 3);
      const ty = randInt(seed + 8200, i, j, r.y + 2, r.y + r.h - 3);
      const roll = seededRand01(tx, ty, seed + 9000);
      if (roll < 0.35)
        grid[ty][tx] = TILE_TREE; // pilier
      else if (roll < 0.6) grid[ty][tx] = TILE_BUSH; // caisse / débris
    }
  }

  // Bordures
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

function generateLavaGrid(cols: number, rows: number, seed: number) {
  const area = cols * rows;
  const rockCount = Math.max(18, Math.floor(area / 300));
  const basaltCount = Math.max(14, Math.floor(area / 420));
  const rubbleCount = Math.max(14, Math.floor(area / 450));
  const clearingCount = Math.max(6, Math.floor(area / 800));

  return generateClusterBiomeGrid({
    cols,
    rows,
    seed,
    borderTile: TILE_WALL,
    clusterGap: 2,
    clusters: [
      {
        count: rockCount,
        tileType: TILE_WALL,
        rMin: 1,
        rMax: 4,
        seedOffset: seed + 31000,
      },
      {
        count: basaltCount,
        tileType: TILE_TREE,
        rMin: 1,
        rMax: 3,
        seedOffset: seed + 32000,
      },
      {
        count: rubbleCount,
        tileType: TILE_BUSH,
        rMin: 1,
        rMax: 2,
        seedOffset: seed + 33000,
      },
    ],
    clearingCount,
    clearingRadiusMin: 4,
    clearingRadiusMax: 7,
    trailRadius: 2,
  });
}

function isWallTile(value: number): boolean {
  return value !== TILE_FLOOR && value !== TILE_EMPTY;
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

function toPixel(
  tileX: number,
  tileY: number,
  tileSize: number,
): [number, number] {
  return [tileX * tileSize + tileSize / 2, tileY * tileSize + tileSize / 2];
}

function computeSpawnsAndWalls(
  grid: Tile[][],
  cols: number,
  rows: number,
  seed: number,
) {
  // Spawn joueur : proche du centre
  const [playerTileX, playerTileY] = findNearestFloor(
    grid,
    Math.floor(cols / 2),
    Math.floor(rows / 2),
  );
  clearCircle(grid, playerTileX, playerTileY, 3);
  const playerSpawn: [number, number] = toPixel(
    playerTileX,
    playerTileY,
    MAP_TILE_SIZE,
  );

  // Spawns ennemis : sur du sol, pas trop proche du joueur
  const enemySpawnTiles: [number, number][] = [];
  const used = new Set<string>([`${playerTileX},${playerTileY}`]);
  const minDistTiles = Math.max(16, Math.floor(Math.min(cols, rows) * 0.2));

  for (let i = 0; i < 20; i++) {
    let chosen: [number, number] | null = null;

    for (let attempt = 0; attempt < 900; attempt++) {
      const rx = seededRand01(i, attempt, seed + 5000);
      const ry = seededRand01(i, attempt + 999, seed + 5000);
      const x = 1 + Math.floor(rx * (cols - 2));
      const y = 1 + Math.floor(ry * (rows - 2));

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
      clamp(playerTileX + 10 + i, 1, cols - 2),
      clamp(playerTileY + 10 + i, 1, rows - 2),
    ];

    const [sx, sy] = chosen ?? fallback;
    enemySpawnTiles.push([sx, sy]);
    clearCircle(grid, sx, sy, 2);
  }

  const enemySpawns: [number, number][] = enemySpawnTiles.map((t) =>
    toPixel(t[0], t[1], MAP_TILE_SIZE),
  );

  const wallRects = buildWallRects(
    grid as unknown as number[][],
    MAP_TILE_SIZE,
  );

  return { playerSpawn, enemySpawns, wallRects };
}

type MapDefinition = {
  id: MapId;
  biome: MapBiome;
  name: string;
  cols: number;
  rows: number;
  seed: number;
  backgroundColor: number;
  generator: (cols: number, rows: number, seed: number) => Tile[][];
};

const MAP_DEFINITIONS: Record<MapId, MapDefinition> = {
  forest_1: {
    id: "forest_1",
    biome: "forest",
    name: getMapDisplayName("forest_1"),
    cols: 100,
    rows: 80,
    seed: 1337,
    backgroundColor: 0x0a0a0f,
    generator: (c, r, s) => generateForestGrid(c, r, s, "normal"),
  },
  forest_2: {
    id: "forest_2",
    biome: "forest",
    name: getMapDisplayName("forest_2"),
    cols: 110,
    rows: 88,
    seed: 7331,
    backgroundColor: 0x06080c,
    generator: (c, r, s) => generateForestGrid(c, r, s, "deep"),
  },
  ice_1: {
    id: "ice_1",
    biome: "ice",
    name: getMapDisplayName("ice_1"),
    cols: 110,
    rows: 88,
    seed: 20210,
    backgroundColor: 0x0b1220,
    generator: generateIceGrid,
  },
  dungeon_1: {
    id: "dungeon_1",
    biome: "dungeon",
    name: getMapDisplayName("dungeon_1"),
    cols: 100,
    rows: 80,
    seed: 40404,
    backgroundColor: 0x050506,
    generator: generateDungeonGrid,
  },
  lava_1: {
    id: "lava_1",
    biome: "lava",
    name: getMapDisplayName("lava_1"),
    cols: 110,
    rows: 88,
    seed: 90010,
    backgroundColor: 0x1a0500,
    generator: generateLavaGrid,
  },
};

const mapCache = new Map<MapId, MapData>();

export function getMapData(mapId: MapId): MapData {
  const cached = mapCache.get(mapId);
  if (cached) return cached;

  const def = MAP_DEFINITIONS[mapId] ?? MAP_DEFINITIONS[DEFAULT_MAP_ID];
  const grid = def.generator(def.cols, def.rows, def.seed);
  const { playerSpawn, enemySpawns, wallRects } = computeSpawnsAndWalls(
    grid,
    def.cols,
    def.rows,
    def.seed,
  );

  const data: MapData = {
    id: def.id,
    biome: def.biome,
    name: def.name,
    cols: def.cols,
    rows: def.rows,
    tileSize: MAP_TILE_SIZE,
    grid,
    wallRects,
    playerSpawn,
    enemySpawns,
    backgroundColor: def.backgroundColor,
  };

  mapCache.set(mapId, data);
  return data;
}
