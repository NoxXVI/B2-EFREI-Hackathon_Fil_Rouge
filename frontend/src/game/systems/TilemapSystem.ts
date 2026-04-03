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
  MAP_GRID,
  MAP_TILE_SIZE,
  MAP_COLS,
  MAP_ROWS,
  WALL_RECTS,
  PLAYER_SPAWN,
  ENEMY_SPAWNS,
  TILE_FLOOR,
  TILE_TREE,
  TILE_BUSH,
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
  private built = false;

  constructor() {
    this.container = new Container();
  }

  async build() {
    if (this.built) return;
    this.built = true;

    // Charge le tileset (optionnel : fallback si asset absent)
    let atlasTexture: Texture | null = null;
    try {
      atlasTexture = (await Assets.load("/assets/full_tilemap.png")) as Texture;
      atlasTexture.source.scaleMode = SCALE_MODES.NEAREST;
    } catch (err) {
      console.warn(
        '[TilemapSystem] Unable to load "/assets/full_tilemap.png" — using fallback tiles.',
        err,
      );
    }

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

    const floorFallbackTextures = [
      createTileTexture((ctx) => {
        ctx.fillStyle = "#2f7a3a";
        ctx.fillRect(0, 0, TS, TS);
        for (let py = 0; py < TS; py++) {
          for (let px = 0; px < TS; px++) {
            const r = seededRand01(px, py, 1);
            if (r < 0.06) {
              ctx.fillStyle = "#256530";
              ctx.fillRect(px, py, 1, 1);
            } else if (r > 0.94) {
              ctx.fillStyle = "#3e8a46";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
        for (let i = 0; i < 4; i++) {
          const fx = Math.floor(seededRand01(i, 0, 17) * TS);
          const fy = Math.floor(seededRand01(i, 1, 17) * TS);
          ctx.fillStyle = i % 2 === 0 ? "#e6d15e" : "#e86aa1";
          ctx.fillRect(fx, fy, 1, 1);
        }
      }),
      createTileTexture((ctx) => {
        ctx.fillStyle = "#2d7637";
        ctx.fillRect(0, 0, TS, TS);
        for (let py = 0; py < TS; py++) {
          for (let px = 0; px < TS; px++) {
            const r = seededRand01(px, py, 2);
            if (r < 0.08) {
              ctx.fillStyle = "#245f2e";
              ctx.fillRect(px, py, 1, 1);
            } else if (r > 0.96) {
              ctx.fillStyle = "#4a9151";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
      }),
      createTileTexture((ctx) => {
        ctx.fillStyle = "#2f7a3a";
        ctx.fillRect(0, 0, TS, TS);
        // petite zone de terre pour varier
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
    ];

    const wallFallbackTextures = [
      // rocher
      createTileTexture((ctx) => {
        ctx.fillStyle = "#6d727a";
        ctx.fillRect(0, 0, TS, TS);
        for (let py = 0; py < TS; py++) {
          for (let px = 0; px < TS; px++) {
            const r = seededRand01(px, py, 11);
            if (r < 0.08) {
              ctx.fillStyle = "#575c63";
              ctx.fillRect(px, py, 1, 1);
            } else if (r > 0.93) {
              ctx.fillStyle = "#878d96";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(0, 12, TS, 4);
      }),
      // arbre (canopée dense)
      createTileTexture((ctx) => {
        ctx.fillStyle = "#204b26";
        ctx.fillRect(0, 0, TS, TS);
        for (let py = 0; py < TS; py++) {
          for (let px = 0; px < TS; px++) {
            const r = seededRand01(px, py, 12);
            if (r < 0.08) {
              ctx.fillStyle = "#193a1e";
              ctx.fillRect(px, py, 1, 1);
            } else if (r > 0.95) {
              ctx.fillStyle = "#2a602f";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
        // tronc au centre
        ctx.fillStyle = "#6a4a26";
        ctx.fillRect(7, 7, 2, 3);
      }),
      // buisson / ronces
      createTileTexture((ctx) => {
        ctx.fillStyle = "#1f4a25";
        ctx.fillRect(0, 0, TS, TS);
        for (let py = 0; py < TS; py++) {
          for (let px = 0; px < TS; px++) {
            const r = seededRand01(px, py, 13);
            if (r < 0.1) {
              ctx.fillStyle = "#17361b";
              ctx.fillRect(px, py, 1, 1);
            } else if (r > 0.92) {
              ctx.fillStyle = "#2f6a34";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
      }),
    ];

    const wallTopFallbackTextures = [
      // rocher (haut plus clair)
      createTileTexture((ctx) => {
        ctx.fillStyle = "#6d727a";
        ctx.fillRect(0, 0, TS, TS);
        for (let py = 0; py < TS; py++) {
          for (let px = 0; px < TS; px++) {
            const r = seededRand01(px, py, 11);
            if (r < 0.08) {
              ctx.fillStyle = "#575c63";
              ctx.fillRect(px, py, 1, 1);
            } else if (r > 0.93) {
              ctx.fillStyle = "#878d96";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(0, 0, TS, 3);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(0, 12, TS, 4);
      }),
      // arbre (liseré clair en haut)
      createTileTexture((ctx) => {
        ctx.fillStyle = "#204b26";
        ctx.fillRect(0, 0, TS, TS);
        for (let py = 0; py < TS; py++) {
          for (let px = 0; px < TS; px++) {
            const r = seededRand01(px, py, 12);
            if (r < 0.08) {
              ctx.fillStyle = "#193a1e";
              ctx.fillRect(px, py, 1, 1);
            } else if (r > 0.95) {
              ctx.fillStyle = "#2a602f";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
        ctx.fillStyle = "#6a4a26";
        ctx.fillRect(7, 7, 2, 3);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 0, TS, 3);
      }),
      // buisson (haut plus clair)
      createTileTexture((ctx) => {
        ctx.fillStyle = "#1f4a25";
        ctx.fillRect(0, 0, TS, TS);
        for (let py = 0; py < TS; py++) {
          for (let px = 0; px < TS; px++) {
            const r = seededRand01(px, py, 13);
            if (r < 0.1) {
              ctx.fillStyle = "#17361b";
              ctx.fillRect(px, py, 1, 1);
            } else if (r > 0.92) {
              ctx.fillStyle = "#2f6a34";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, 0, TS, 3);
      }),
    ];

    const treeDecorTextures = [
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
              const n = seededRand01(px, py, 31);
              if (n < 0.08) ctx.fillStyle = "#17361b";
              else if (n > 0.92) ctx.fillStyle = "#2a602f";
              else ctx.fillStyle = "#204b26";
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
        ctx.fillStyle = "#6a4a26";
        ctx.fillRect(7, 9, 2, 3);
      }),
    ];

    const rockDecorTextures = [
      createTileTexture((ctx) => {
        ctx.clearRect(0, 0, TS, TS);
        ctx.fillStyle = "#7b8088";
        ctx.fillRect(4, 7, 8, 5);
        ctx.fillStyle = "#666b73";
        ctx.fillRect(5, 8, 6, 3);
        ctx.fillStyle = "#8f959e";
        ctx.fillRect(6, 8, 2, 1);
        ctx.fillRect(9, 9, 1, 1);
      }),
    ];

    const protectedTiles = new Set<string>();
    const protect = (tx: number, ty: number) => {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          protectedTiles.add(`${tx + ox},${ty + oy}`);
        }
      }
    };
    protect(Math.floor(PLAYER_SPAWN[0] / TS), Math.floor(PLAYER_SPAWN[1] / TS));
    for (const [sx, sy] of ENEMY_SPAWNS) {
      protect(Math.floor(sx / TS), Math.floor(sy / TS));
    }

    // Crée une texture par tuile de l'atlas
    const tileTexCache = new Map<string, Texture>();
    const getTileTex = (col: number, row: number): Texture => {
      if (!atlasTexture) return Texture.WHITE;

      const key = `${col},${row}`;
      const cached = tileTexCache.get(key);
      if (cached) return cached;

      const tileTex = new Texture({
        source: atlasTexture.source,
        frame: new Rectangle(col * TS, row * TS, TS, TS),
      });
      tileTexCache.set(key, tileTex);
      return tileTex;
    };

    // Dessine chaque tuile
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const cell = MAP_GRID[y][x];
        if (cell === 0) continue;

        let texture: Texture;
        if (atlasTexture) {
          let tileCoords: [number, number];
          if (cell === TILE_FLOOR) {
            tileCoords = seededPick(FLOOR_TILES, x, y);
          } else {
            // mur: si le sol est juste en dessous => face visible du mur
            const isTop = y + 1 < MAP_ROWS && MAP_GRID[y + 1][x] === TILE_FLOOR;
            tileCoords = seededPick(isTop ? WALL_TOP : WALL_TILES, x, y);
          }
          texture = getTileTex(tileCoords[0], tileCoords[1]);
        } else if (cell === TILE_FLOOR) {
          texture = seededPick(floorFallbackTextures, x, y);
        } else {
          const isTop = y + 1 < MAP_ROWS && MAP_GRID[y + 1][x] === TILE_FLOOR;
          const wallTypeIndex =
            cell === TILE_TREE ? 1 : cell === TILE_BUSH ? 2 : 0;
          const texList = isTop
            ? wallTopFallbackTextures
            : wallFallbackTextures;
          texture = texList[wallTypeIndex] ?? texList[0];
        }

        const sprite = new Sprite(texture);
        sprite.x = x * TS;
        sprite.y = y * TS;
        sprite.width = TS;
        sprite.height = TS;
        this.container.addChild(sprite);

        // Décors (uniquement en fallback, pour donner un look forêt)
        if (
          cell === TILE_FLOOR &&
          !atlasTexture &&
          !protectedTiles.has(`${x},${y}`)
        ) {
          const roll = seededRand01(x, y, 99);
          if (roll < 0.025) {
            const decor = new Sprite(seededPick(treeDecorTextures, x, y));
            decor.x = x * TS;
            decor.y = y * TS;
            decor.width = TS;
            decor.height = TS;
            this.container.addChild(decor);
          } else if (roll < 0.045) {
            const decor = new Sprite(seededPick(rockDecorTextures, x, y));
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
      const pos = world.getComponent<Position>(id, "Position")!;
      const radius = 16; // demi-taille du sprite

      for (const [wx, wy, ww, wh] of WALL_RECTS) {
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
      width: MAP_COLS * TS,
      height: MAP_ROWS * TS,
    };
  }
}
