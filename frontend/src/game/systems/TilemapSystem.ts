import {
  Container,
  Sprite,
  Texture,
  Rectangle,
  SCALE_MODES,
  Assets,
} from "pixi.js";
import { World } from "../ecs/World";
import { Position } from "../components";
import {
  MAP_TILE_SIZE,
  TILE_EMPTY,
  TILE_WALL,
  TILE_CARPET,
  TILE_TREE,
  TILE_BUSH,
  TILE_PILLAR,
  TILE_STATUE,
  TILE_LAVA,
  TILE_RUBBLE,
  isWalkableTile,
  type GeneratedMap,
  type MapTheme,
} from "./MapData";

const TS = MAP_TILE_SIZE;

// Atlas coords (col, row) des tuiles dans full_tilemap.png (9x8 tuiles de 16x16)
const FLOOR_TILES: [number, number][] = [
  [1, 2],
  [2, 2],
  [3, 2],
];
const WALL_TILES: [number, number][] = [
  [0, 1],
  [1, 1],
  [2, 1],
];
const WALL_TOP: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
];

function seededPick<T>(arr: T[], x: number, y: number): T {
  const idx = Math.abs((x * 2654435761 + y * 2246822519) >>> 0) % arr.length;
  return arr[idx];
}

function seededRand01(x: number, y: number, seed: number): number {
  let h = Math.imul(x ^ seed, 0x9e3779b1) ^ Math.imul(y ^ seed, 0x85ebca6b);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return h / 0xffffffff;
}

export class TilemapSystem {
  public container: Container;
  private atlasLoaded = false;
  private atlasTexture: Texture | null = null;
  private readonly atlasTileCache = new Map<string, Texture>();
  private readonly themeTextureCache = new Map<MapTheme, ThemeTextures>();

  private cols = 0;
  private rows = 0;
  private wallRects: [number, number, number, number][] = [];

  constructor() {
    this.container = new Container();
  }

  private async ensureAtlasLoaded() {
    if (this.atlasLoaded) return;
    this.atlasLoaded = true;

    // Charge le tileset (optionnel : fallback si asset absent)
    try {
      this.atlasTexture = (await Assets.load(
        "/assets/full_tilemap.png",
      )) as Texture;
      this.atlasTexture.source.scaleMode = SCALE_MODES.NEAREST;
    } catch (err) {
      console.warn(
        '[TilemapSystem] Unable to load "/assets/full_tilemap.png" — using fallback tiles.',
        err,
      );
    }
  }

  async loadMap(map: GeneratedMap) {
    await this.ensureAtlasLoaded();
    this.cols = map.cols;
    this.rows = map.rows;
    this.wallRects = map.wallRects;
    this.rebuild(map);
  }

  private getThemeTextures(theme: MapTheme): ThemeTextures {
    const cached = this.themeTextureCache.get(theme);
    if (cached) return cached;
    const created = createThemeTextures(theme);
    this.themeTextureCache.set(theme, created);
    return created;
  }

  private rebuild(map: GeneratedMap) {
    // Reset cache + children
    this.container.cacheAsTexture(false);
    for (const child of this.container.removeChildren()) {
      child.destroy();
    }

    const protectedTiles = new Set<string>();
    const protect = (tx: number, ty: number) => {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          protectedTiles.add(`${tx + ox},${ty + oy}`);
        }
      }
    };
    protect(
      Math.floor(map.playerSpawn[0] / TS),
      Math.floor(map.playerSpawn[1] / TS),
    );
    for (const [sx, sy] of map.enemySpawns) {
      protect(Math.floor(sx / TS), Math.floor(sy / TS));
    }

    // Crée une texture par tuile de l'atlas
    const getTileTex = (col: number, row: number): Texture => {
      const atlasTexture = this.atlasTexture;
      if (!atlasTexture) return Texture.WHITE;

      const key = `${col},${row}`;
      const cached = this.atlasTileCache.get(key);
      if (cached) return cached;

      const tileTex = new Texture({
        source: atlasTexture.source,
        frame: new Rectangle(col * TS, row * TS, TS, TS),
      });
      this.atlasTileCache.set(key, tileTex);
      return tileTex;
    };

    const themeTextures = this.getThemeTextures(map.theme);

    // Dessine chaque tuile
    const grid = map.grid;
    const rows = map.rows;
    const cols = map.cols;
    const atlasTexture = this.atlasTexture;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = grid[y]?.[x] ?? TILE_EMPTY;
        if (cell === TILE_EMPTY) continue;

        let texture: Texture;
        if (atlasTexture) {
          let tileCoords: [number, number];
          if (isWalkableTile(cell)) {
            tileCoords = seededPick(FLOOR_TILES, x, y);
          } else {
            // mur: si le sol est juste en dessous => face visible du mur
            const isTop =
              y + 1 < rows && isWalkableTile(grid[y + 1]?.[x] ?? TILE_EMPTY);
            tileCoords = seededPick(isTop ? WALL_TOP : WALL_TILES, x, y);
          }
          texture = getTileTex(tileCoords[0], tileCoords[1]);
        } else if (isWalkableTile(cell)) {
          const list =
            cell === TILE_CARPET ? themeTextures.carpet : themeTextures.floor;
          texture = seededPick(list, x, y);
        } else {
          const isTop =
            y + 1 < rows && isWalkableTile(grid[y + 1]?.[x] ?? TILE_EMPTY);
          const wallSet =
            themeTextures.wallByType.get(cell) ??
            themeTextures.wallByType.get(TILE_WALL);
          texture = seededPick(isTop ? wallSet!.top : wallSet!.body, x, y);
        }

        const sprite = new Sprite(texture);
        sprite.x = x * TS;
        sprite.y = y * TS;
        sprite.width = TS;
        sprite.height = TS;
        this.container.addChild(sprite);

        // Décors (uniquement en fallback, pour donner un look forêt)
        if (
          isWalkableTile(cell) &&
          !atlasTexture &&
          themeTextures.decorEnabled &&
          !protectedTiles.has(`${x},${y}`)
        ) {
          const themeSeed = map.theme === "fairy_forest" ? 101 : 99;
          const roll = seededRand01(x, y, themeSeed);
          if (roll < 0.018 && themeTextures.treeDecor.length > 0) {
            const decor = new Sprite(seededPick(themeTextures.treeDecor, x, y));
            decor.x = x * TS;
            decor.y = y * TS;
            decor.width = TS;
            decor.height = TS;
            this.container.addChild(decor);
          } else if (roll < 0.032 && themeTextures.rockDecor.length > 0) {
            const decor = new Sprite(seededPick(themeTextures.rockDecor, x, y));
            decor.x = x * TS;
            decor.y = y * TS;
            decor.width = TS;
            decor.height = TS;
            this.container.addChild(decor);
          } else if (roll < 0.05 && themeTextures.sparkleDecor.length > 0) {
            const decor = new Sprite(
              seededPick(themeTextures.sparkleDecor, x, y),
            );
            decor.x = x * TS;
            decor.y = y * TS;
            decor.width = TS;
            decor.height = TS;
            this.container.addChild(decor);
          }
        }
      }
    }

    this.container.cacheAsTexture({ scaleMode: SCALE_MODES.NEAREST });
  }

  resolveWallCollisions(world: World) {
    const entities = world.query(["Position", "Velocity"]);

    for (const id of entities) {
      if (world.hasComponent(id, "RemotePlayerTag")) continue;
      const pos = world.getComponent<Position>(id, "Position")!;
      const radius = 16; // demi-taille du sprite

      for (const [wx, wy, ww, wh] of this.wallRects) {
        // AABB: entité = carré centré sur pos
        const left = pos.x - radius;
        const right = pos.x + radius;
        const top = pos.y - radius;
        const bottom = pos.y + radius;

        const wallRight = wx + ww;
        const wallBottom = wy + wh;

        // Pas de collision
        if (
          right <= wx ||
          left >= wallRight ||
          bottom <= wy ||
          top >= wallBottom
        ) {
          continue;
        }

        const overlapLeft = right - wx;
        const overlapRight = wallRight - left;
        const overlapTop = bottom - wy;
        const overlapBottom = wallBottom - top;

        const minX = Math.min(overlapLeft, overlapRight);
        const minY = Math.min(overlapTop, overlapBottom);

        if (minX < minY) {
          pos.x += overlapLeft < overlapRight ? -overlapLeft : overlapRight;
        } else {
          pos.y += overlapTop < overlapBottom ? -overlapTop : overlapBottom;
        }
      }
    }
  }

  get bounds() {
    return {
      width: this.cols * TS,
      height: this.rows * TS,
    };
  }
}

type WallTexturePair = { body: Texture[]; top: Texture[] };

interface ThemeTextures {
  floor: Texture[];
  carpet: Texture[];
  wallByType: Map<number, WallTexturePair>;
  decorEnabled: boolean;
  treeDecor: Texture[];
  rockDecor: Texture[];
  sparkleDecor: Texture[];
}

function createThemeTextures(theme: MapTheme): ThemeTextures {
  const createTileTexture = (
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): Texture => {
    const canvas = document.createElement("canvas");
    canvas.width = TS;
    canvas.height = TS;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error(
        "[TilemapSystem] Unable to create 2D canvas context for fallback tile textures.",
      );
    }
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    const tex = Texture.from(canvas, true);
    tex.source.scaleMode = SCALE_MODES.NEAREST;
    return tex;
  };

  const makeNoisyTile = (options: {
    base: string;
    dark: string;
    light: string;
    seed: number;
    darkChance: number;
    lightChance: number;
    topHighlight?: string;
    bottomShade?: boolean;
  }) =>
    createTileTexture((ctx) => {
      ctx.fillStyle = options.base;
      ctx.fillRect(0, 0, TS, TS);
      for (let py = 0; py < TS; py++) {
        for (let px = 0; px < TS; px++) {
          const r = seededRand01(px, py, options.seed);
          if (r < options.darkChance) {
            ctx.fillStyle = options.dark;
            ctx.fillRect(px, py, 1, 1);
          } else if (r > 1 - options.lightChance) {
            ctx.fillStyle = options.light;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
      if (options.topHighlight) {
        ctx.fillStyle = options.topHighlight;
        ctx.fillRect(0, 0, TS, 3);
      }
      if (options.bottomShade) {
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(0, 12, TS, 4);
      }
    });

  const makeTreeTile = (options: {
    base: string;
    dark: string;
    light: string;
    trunk: string;
    seed: number;
    topHighlight?: boolean;
  }) =>
    createTileTexture((ctx) => {
      ctx.fillStyle = options.base;
      ctx.fillRect(0, 0, TS, TS);
      for (let py = 0; py < TS; py++) {
        for (let px = 0; px < TS; px++) {
          const r = seededRand01(px, py, options.seed);
          if (r < 0.08) {
            ctx.fillStyle = options.dark;
            ctx.fillRect(px, py, 1, 1);
          } else if (r > 0.95) {
            ctx.fillStyle = options.light;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
      ctx.fillStyle = options.trunk;
      ctx.fillRect(7, 7, 2, 3);
      if (options.topHighlight) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 0, TS, 3);
      }
    });

  const makePillarTile = (options: {
    base: string;
    shadow: string;
    highlight: string;
    seed: number;
    topHighlight?: boolean;
  }) =>
    createTileTexture((ctx) => {
      ctx.fillStyle = options.base;
      ctx.fillRect(0, 0, TS, TS);
      // colonne
      ctx.fillStyle = options.highlight;
      ctx.fillRect(6, 2, 1, 12);
      ctx.fillRect(9, 2, 1, 12);
      ctx.fillStyle = options.shadow;
      ctx.fillRect(5, 2, 1, 12);
      ctx.fillRect(10, 2, 1, 12);
      // petites fissures
      for (let i = 0; i < 8; i++) {
        const fx = Math.floor(seededRand01(i, 1, options.seed) * TS);
        const fy = Math.floor(seededRand01(i, 2, options.seed) * TS);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(fx, fy, 1, 1);
      }
      if (options.topHighlight) {
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(0, 0, TS, 3);
      }
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 12, TS, 4);
    });

  const makeLavaTile = (hot: boolean, seed: number, topHighlight?: boolean) =>
    createTileTexture((ctx) => {
      ctx.fillStyle = hot ? "#ff3b00" : "#ff5a00";
      ctx.fillRect(0, 0, TS, TS);
      for (let py = 0; py < TS; py++) {
        for (let px = 0; px < TS; px++) {
          const r = seededRand01(px, py, seed);
          if (r < 0.06) {
            ctx.fillStyle = "#b01400";
            ctx.fillRect(px, py, 1, 1);
          } else if (r > 0.94) {
            ctx.fillStyle = "#ffd36a";
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
      // bulles
      for (let i = 0; i < 4; i++) {
        const bx = Math.floor(seededRand01(i, 7, seed) * TS);
        const by = Math.floor(seededRand01(i, 9, seed) * TS);
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(bx, by, 1, 1);
      }
      if (topHighlight) {
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(0, 0, TS, 3);
      }
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 12, TS, 4);
    });

  const makeCarpetTile = (seed: number) =>
    createTileTexture((ctx) => {
      ctx.fillStyle = "#7a1717";
      ctx.fillRect(0, 0, TS, TS);
      // bordures or
      ctx.fillStyle = "#d2b14a";
      ctx.fillRect(1, 1, TS - 2, 1);
      ctx.fillRect(1, TS - 2, TS - 2, 1);
      // motif
      for (let i = 0; i < 10; i++) {
        const mx = Math.floor(seededRand01(i, 2, seed) * (TS - 4)) + 2;
        const my = Math.floor(seededRand01(i, 3, seed) * (TS - 4)) + 2;
        ctx.fillStyle = i % 2 === 0 ? "#a31f1f" : "#8b1b1b";
        ctx.fillRect(mx, my, 1, 1);
      }
    });

  const makeSparkleTile = (seed: number) =>
    createTileTexture((ctx) => {
      ctx.clearRect(0, 0, TS, TS);
      const cx = 8;
      const cy = 8;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillRect(cx, cy, 1, 1);
      ctx.fillStyle = "rgba(255,170,255,0.65)";
      ctx.fillRect(cx - 1, cy, 1, 1);
      ctx.fillRect(cx + 1, cy, 1, 1);
      ctx.fillStyle = "rgba(120,220,255,0.55)";
      ctx.fillRect(cx, cy - 1, 1, 1);
      ctx.fillRect(cx, cy + 1, 1, 1);

      // mini variations
      const v = seededRand01(1, 1, seed);
      if (v > 0.6) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(cx - 2, cy, 1, 1);
      }
    });

  const makeRockDecor = (seed: number) =>
    createTileTexture((ctx) => {
      ctx.clearRect(0, 0, TS, TS);
      const base = seededRand01(1, 1, seed) > 0.5 ? "#7b8088" : "#6f747c";
      ctx.fillStyle = base;
      ctx.fillRect(4, 7, 8, 5);
      ctx.fillStyle = "#666b73";
      ctx.fillRect(5, 8, 6, 3);
      ctx.fillStyle = "#8f959e";
      ctx.fillRect(6, 8, 2, 1);
      ctx.fillRect(9, 9, 1, 1);
    });

  const makeTreeDecor = (leafBase: string, seed: number) =>
    createTileTexture((ctx) => {
      ctx.clearRect(0, 0, TS, TS);
      const cx = 8;
      const cy = 8;
      const r = 7;
      for (let py = 0; py < TS; py++) {
        for (let px = 0; px < TS; px++) {
          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= r) {
            const n = seededRand01(px, py, seed);
            if (n < 0.08) ctx.fillStyle = "rgba(0,0,0,0.25)";
            else if (n > 0.92) ctx.fillStyle = "rgba(255,255,255,0.12)";
            else ctx.fillStyle = leafBase;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
      ctx.fillStyle = "#6a4a26";
      ctx.fillRect(7, 9, 2, 3);
    });

  const wallByType = new Map<number, WallTexturePair>();
  const floor: Texture[] = [];
  const carpet: Texture[] = [];
  const treeDecor: Texture[] = [];
  const rockDecor: Texture[] = [];
  const sparkleDecor: Texture[] = [];
  let decorEnabled = false;

  switch (theme) {
    case "forest": {
      floor.push(
        makeNoisyTile({
          base: "#2f7a3a",
          dark: "#256530",
          light: "#3e8a46",
          seed: 1,
          darkChance: 0.06,
          lightChance: 0.06,
        }),
        makeNoisyTile({
          base: "#2d7637",
          dark: "#245f2e",
          light: "#4a9151",
          seed: 2,
          darkChance: 0.08,
          lightChance: 0.04,
        }),
        createTileTexture((ctx) => {
          ctx.fillStyle = "#2f7a3a";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "#6b4f2a";
          ctx.fillRect(5, 6, 6, 5);
          ctx.fillStyle = "#5a4122";
          ctx.fillRect(6, 7, 4, 3);
          for (let py = 0; py < TS; py++) {
            for (let px = 0; px < TS; px++) {
              const r = seededRand01(px, py, 3);
              if (r < 0.04) {
                ctx.fillStyle = "#256530";
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
        }),
      );
      carpet.push(...floor);

      wallByType.set(TILE_WALL, {
        body: [
          makeNoisyTile({
            base: "#6d727a",
            dark: "#575c63",
            light: "#878d96",
            seed: 11,
            darkChance: 0.08,
            lightChance: 0.07,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#6d727a",
            dark: "#575c63",
            light: "#878d96",
            seed: 11,
            darkChance: 0.08,
            lightChance: 0.07,
            topHighlight: "rgba(255,255,255,0.1)",
            bottomShade: true,
          }),
        ],
      });
      wallByType.set(TILE_TREE, {
        body: [
          makeTreeTile({
            base: "#204b26",
            dark: "#193a1e",
            light: "#2a602f",
            trunk: "#6a4a26",
            seed: 12,
          }),
        ],
        top: [
          makeTreeTile({
            base: "#204b26",
            dark: "#193a1e",
            light: "#2a602f",
            trunk: "#6a4a26",
            seed: 12,
            topHighlight: true,
          }),
        ],
      });
      wallByType.set(TILE_BUSH, {
        body: [
          makeNoisyTile({
            base: "#1f4a25",
            dark: "#17361b",
            light: "#2f6a34",
            seed: 13,
            darkChance: 0.1,
            lightChance: 0.08,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#1f4a25",
            dark: "#17361b",
            light: "#2f6a34",
            seed: 13,
            darkChance: 0.1,
            lightChance: 0.08,
            topHighlight: "rgba(255,255,255,0.08)",
          }),
        ],
      });

      // Default for unused wall types in this theme
      wallByType.set(TILE_PILLAR, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_STATUE, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_LAVA, {
        body: [makeLavaTile(false, 71)],
        top: [makeLavaTile(false, 71, true)],
      });
      wallByType.set(TILE_RUBBLE, wallByType.get(TILE_WALL)!);

      decorEnabled = true;
      treeDecor.push(makeTreeDecor("#204b26", 31));
      rockDecor.push(makeRockDecor(41));
      break;
    }
    case "fairy_forest": {
      floor.push(
        makeNoisyTile({
          base: "#3aa85a",
          dark: "#2f8b4a",
          light: "#57d27a",
          seed: 101,
          darkChance: 0.05,
          lightChance: 0.05,
        }),
        makeNoisyTile({
          base: "#36a555",
          dark: "#2a8747",
          light: "#67e08a",
          seed: 102,
          darkChance: 0.06,
          lightChance: 0.04,
        }),
        makeNoisyTile({
          base: "#3aa85a",
          dark: "#2f8b4a",
          light: "#57d27a",
          seed: 103,
          darkChance: 0.04,
          lightChance: 0.06,
        }),
      );
      carpet.push(...floor);

      wallByType.set(TILE_WALL, {
        body: [
          makeNoisyTile({
            base: "#6a6b86",
            dark: "#4e4f66",
            light: "#9a9dc0",
            seed: 111,
            darkChance: 0.08,
            lightChance: 0.08,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#6a6b86",
            dark: "#4e4f66",
            light: "#9a9dc0",
            seed: 111,
            darkChance: 0.08,
            lightChance: 0.08,
            topHighlight: "rgba(255,255,255,0.12)",
            bottomShade: true,
          }),
        ],
      });
      wallByType.set(TILE_TREE, {
        body: [
          makeTreeTile({
            base: "#24773a",
            dark: "#1e5b2d",
            light: "#38a752",
            trunk: "#7a4f28",
            seed: 112,
          }),
        ],
        top: [
          makeTreeTile({
            base: "#24773a",
            dark: "#1e5b2d",
            light: "#38a752",
            trunk: "#7a4f28",
            seed: 112,
            topHighlight: true,
          }),
        ],
      });
      wallByType.set(TILE_BUSH, {
        body: [
          makeNoisyTile({
            base: "#1f6a37",
            dark: "#19552c",
            light: "#2fae59",
            seed: 113,
            darkChance: 0.1,
            lightChance: 0.08,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#1f6a37",
            dark: "#19552c",
            light: "#2fae59",
            seed: 113,
            darkChance: 0.1,
            lightChance: 0.08,
            topHighlight: "rgba(255,255,255,0.1)",
          }),
        ],
      });
      wallByType.set(TILE_STATUE, {
        body: [
          makeNoisyTile({
            base: "#6fd7ff",
            dark: "#3ea8d5",
            light: "#d1f3ff",
            seed: 114,
            darkChance: 0.05,
            lightChance: 0.06,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#6fd7ff",
            dark: "#3ea8d5",
            light: "#d1f3ff",
            seed: 114,
            darkChance: 0.05,
            lightChance: 0.06,
            topHighlight: "rgba(255,255,255,0.2)",
            bottomShade: true,
          }),
        ],
      });

      wallByType.set(TILE_PILLAR, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_LAVA, {
        body: [makeLavaTile(false, 171)],
        top: [makeLavaTile(false, 171, true)],
      });
      wallByType.set(TILE_RUBBLE, wallByType.get(TILE_WALL)!);

      decorEnabled = true;
      treeDecor.push(makeTreeDecor("#2d8a48", 131));
      rockDecor.push(makeRockDecor(141));
      sparkleDecor.push(makeSparkleTile(151), makeSparkleTile(152));
      break;
    }
    case "dungeon": {
      floor.push(
        makeNoisyTile({
          base: "#3b3d44",
          dark: "#2a2b30",
          light: "#545862",
          seed: 201,
          darkChance: 0.09,
          lightChance: 0.05,
        }),
        makeNoisyTile({
          base: "#373941",
          dark: "#282a2f",
          light: "#505460",
          seed: 202,
          darkChance: 0.08,
          lightChance: 0.06,
        }),
      );
      carpet.push(...floor);

      const wallBody = makeNoisyTile({
        base: "#2a2b30",
        dark: "#1c1d21",
        light: "#3f414a",
        seed: 211,
        darkChance: 0.12,
        lightChance: 0.06,
        bottomShade: true,
      });
      const wallTop = makeNoisyTile({
        base: "#2a2b30",
        dark: "#1c1d21",
        light: "#3f414a",
        seed: 211,
        darkChance: 0.12,
        lightChance: 0.06,
        topHighlight: "rgba(255,255,255,0.08)",
        bottomShade: true,
      });
      wallByType.set(TILE_WALL, { body: [wallBody], top: [wallTop] });
      wallByType.set(TILE_PILLAR, {
        body: [
          makePillarTile({
            base: "#4b4e58",
            shadow: "#2a2c33",
            highlight: "#7a7f8f",
            seed: 212,
          }),
        ],
        top: [
          makePillarTile({
            base: "#4b4e58",
            shadow: "#2a2c33",
            highlight: "#7a7f8f",
            seed: 212,
            topHighlight: true,
          }),
        ],
      });
      wallByType.set(TILE_TREE, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_BUSH, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_STATUE, wallByType.get(TILE_PILLAR)!);
      wallByType.set(TILE_RUBBLE, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_LAVA, {
        body: [makeLavaTile(false, 271)],
        top: [makeLavaTile(false, 271, true)],
      });
      decorEnabled = false;
      break;
    }
    case "kings_hall": {
      floor.push(
        makeNoisyTile({
          base: "#b8bcc6",
          dark: "#9aa0ad",
          light: "#e3e7ef",
          seed: 301,
          darkChance: 0.05,
          lightChance: 0.05,
        }),
        makeNoisyTile({
          base: "#b1b6c1",
          dark: "#8f96a4",
          light: "#edf0f6",
          seed: 302,
          darkChance: 0.04,
          lightChance: 0.06,
        }),
      );
      carpet.push(makeCarpetTile(311), makeCarpetTile(312));

      wallByType.set(TILE_WALL, {
        body: [
          makeNoisyTile({
            base: "#40424a",
            dark: "#26272c",
            light: "#5f626c",
            seed: 321,
            darkChance: 0.1,
            lightChance: 0.06,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#40424a",
            dark: "#26272c",
            light: "#5f626c",
            seed: 321,
            darkChance: 0.1,
            lightChance: 0.06,
            topHighlight: "rgba(255,255,255,0.08)",
            bottomShade: true,
          }),
        ],
      });
      wallByType.set(TILE_PILLAR, {
        body: [
          makePillarTile({
            base: "#a9adba",
            shadow: "#7c8191",
            highlight: "#f1f3f8",
            seed: 322,
          }),
        ],
        top: [
          makePillarTile({
            base: "#a9adba",
            shadow: "#7c8191",
            highlight: "#f1f3f8",
            seed: 322,
            topHighlight: true,
          }),
        ],
      });
      wallByType.set(TILE_STATUE, {
        body: [
          makeNoisyTile({
            base: "#c8a43a",
            dark: "#8c6f1d",
            light: "#ffe38a",
            seed: 323,
            darkChance: 0.06,
            lightChance: 0.06,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#c8a43a",
            dark: "#8c6f1d",
            light: "#ffe38a",
            seed: 323,
            darkChance: 0.06,
            lightChance: 0.06,
            topHighlight: "rgba(255,255,255,0.14)",
            bottomShade: true,
          }),
        ],
      });
      wallByType.set(TILE_RUBBLE, {
        body: [
          makeNoisyTile({
            base: "#6f7380",
            dark: "#4a4d57",
            light: "#9aa0ad",
            seed: 324,
            darkChance: 0.1,
            lightChance: 0.08,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#6f7380",
            dark: "#4a4d57",
            light: "#9aa0ad",
            seed: 324,
            darkChance: 0.1,
            lightChance: 0.08,
            topHighlight: "rgba(255,255,255,0.1)",
            bottomShade: true,
          }),
        ],
      });

      wallByType.set(TILE_TREE, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_BUSH, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_LAVA, {
        body: [makeLavaTile(false, 371)],
        top: [makeLavaTile(false, 371, true)],
      });
      decorEnabled = false;
      break;
    }
    case "castle_courtyard": {
      floor.push(
        makeNoisyTile({
          base: "#6a6f78",
          dark: "#50545b",
          light: "#8b919c",
          seed: 401,
          darkChance: 0.08,
          lightChance: 0.06,
        }),
        makeNoisyTile({
          base: "#646971",
          dark: "#4c4f56",
          light: "#8e949f",
          seed: 402,
          darkChance: 0.08,
          lightChance: 0.06,
        }),
      );
      carpet.push(...floor);

      wallByType.set(TILE_WALL, {
        body: [
          makeNoisyTile({
            base: "#4c4f56",
            dark: "#2e3035",
            light: "#6f7380",
            seed: 411,
            darkChance: 0.1,
            lightChance: 0.08,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#4c4f56",
            dark: "#2e3035",
            light: "#6f7380",
            seed: 411,
            darkChance: 0.1,
            lightChance: 0.08,
            topHighlight: "rgba(255,255,255,0.08)",
            bottomShade: true,
          }),
        ],
      });
      wallByType.set(TILE_BUSH, {
        body: [
          makeNoisyTile({
            base: "#245a33",
            dark: "#1b4226",
            light: "#2f7a45",
            seed: 412,
            darkChance: 0.1,
            lightChance: 0.08,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#245a33",
            dark: "#1b4226",
            light: "#2f7a45",
            seed: 412,
            darkChance: 0.1,
            lightChance: 0.08,
            topHighlight: "rgba(255,255,255,0.08)",
          }),
        ],
      });
      wallByType.set(TILE_TREE, {
        body: [
          makeTreeTile({
            base: "#234c2c",
            dark: "#17361b",
            light: "#2f6a34",
            trunk: "#6a4a26",
            seed: 413,
          }),
        ],
        top: [
          makeTreeTile({
            base: "#234c2c",
            dark: "#17361b",
            light: "#2f6a34",
            trunk: "#6a4a26",
            seed: 413,
            topHighlight: true,
          }),
        ],
      });
      wallByType.set(TILE_STATUE, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_PILLAR, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_RUBBLE, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_LAVA, {
        body: [makeLavaTile(false, 471)],
        top: [makeLavaTile(false, 471, true)],
      });

      decorEnabled = true;
      sparkleDecor.push(makeSparkleTile(451));
      rockDecor.push(makeRockDecor(452));
      break;
    }
    case "battlefield": {
      floor.push(
        makeNoisyTile({
          base: "#5a452c",
          dark: "#3e2f1f",
          light: "#7a6242",
          seed: 501,
          darkChance: 0.1,
          lightChance: 0.06,
        }),
        makeNoisyTile({
          base: "#564129",
          dark: "#362818",
          light: "#7a6242",
          seed: 502,
          darkChance: 0.11,
          lightChance: 0.05,
        }),
      );
      carpet.push(...floor);

      wallByType.set(TILE_RUBBLE, {
        body: [
          makeNoisyTile({
            base: "#3a2f26",
            dark: "#221b16",
            light: "#5a4a3f",
            seed: 511,
            darkChance: 0.12,
            lightChance: 0.06,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: "#3a2f26",
            dark: "#221b16",
            light: "#5a4a3f",
            seed: 511,
            darkChance: 0.12,
            lightChance: 0.06,
            topHighlight: "rgba(255,255,255,0.06)",
            bottomShade: true,
          }),
        ],
      });
      wallByType.set(TILE_WALL, wallByType.get(TILE_RUBBLE)!);
      wallByType.set(TILE_TREE, wallByType.get(TILE_RUBBLE)!);
      wallByType.set(TILE_BUSH, wallByType.get(TILE_RUBBLE)!);
      wallByType.set(TILE_PILLAR, wallByType.get(TILE_RUBBLE)!);
      wallByType.set(TILE_STATUE, wallByType.get(TILE_RUBBLE)!);
      wallByType.set(TILE_LAVA, {
        body: [makeLavaTile(false, 571)],
        top: [makeLavaTile(false, 571, true)],
      });
      decorEnabled = false;
      break;
    }
    case "rocky_lava":
    case "volcanic": {
      const hot = theme === "volcanic";
      floor.push(
        makeNoisyTile({
          base: hot ? "#1e1d22" : "#24232a",
          dark: "#121117",
          light: hot ? "#3b3943" : "#34313a",
          seed: hot ? 601 : 602,
          darkChance: 0.11,
          lightChance: 0.05,
        }),
        makeNoisyTile({
          base: hot ? "#1c1b20" : "#222129",
          dark: "#141217",
          light: hot ? "#3a3842" : "#34313a",
          seed: hot ? 603 : 604,
          darkChance: 0.11,
          lightChance: 0.05,
        }),
      );
      carpet.push(...floor);

      wallByType.set(TILE_WALL, {
        body: [
          makeNoisyTile({
            base: hot ? "#2a2830" : "#2f2d36",
            dark: "#1a1820",
            light: hot ? "#4a4754" : "#474452",
            seed: 611,
            darkChance: 0.12,
            lightChance: 0.06,
            bottomShade: true,
          }),
        ],
        top: [
          makeNoisyTile({
            base: hot ? "#2a2830" : "#2f2d36",
            dark: "#1a1820",
            light: hot ? "#4a4754" : "#474452",
            seed: 611,
            darkChance: 0.12,
            lightChance: 0.06,
            topHighlight: "rgba(255,255,255,0.08)",
            bottomShade: true,
          }),
        ],
      });
      wallByType.set(TILE_LAVA, {
        body: [makeLavaTile(hot, 671)],
        top: [makeLavaTile(hot, 671, true)],
      });

      wallByType.set(TILE_TREE, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_BUSH, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_PILLAR, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_STATUE, wallByType.get(TILE_WALL)!);
      wallByType.set(TILE_RUBBLE, wallByType.get(TILE_WALL)!);
      decorEnabled = false;
      break;
    }
  }

  return {
    floor,
    carpet: carpet.length > 0 ? carpet : floor,
    wallByType,
    decorEnabled,
    treeDecor,
    rockDecor,
    sparkleDecor,
  };
}
