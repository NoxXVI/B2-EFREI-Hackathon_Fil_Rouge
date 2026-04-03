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
  TILE_FLOOR,
  TILE_TREE,
  TILE_BUSH,
  type MapBiome,
  type MapData,
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

type BiomeTextureSet = {
  floor: Texture[];
  wall: Texture[];
  wallTop: Texture[];
  decor: null | {
    primary: Texture[];
    secondary: Texture[];
    primaryChance: number;
    secondaryChance: number;
    seed: number;
  };
};

const BIOME_TINTS: Record<
  MapBiome,
  { floor: number; wall: number; wallTop: number; tree: number; bush: number }
> = {
  forest: {
    floor: 0xffffff,
    wall: 0xffffff,
    wallTop: 0xffffff,
    tree: 0xffffff,
    bush: 0xffffff,
  },
  ice: {
    floor: 0xe6f7ff,
    wall: 0xc4ecff,
    wallTop: 0xe6f7ff,
    tree: 0xd7fbff,
    bush: 0xf5fdff,
  },
  dungeon: {
    floor: 0xdedede,
    wall: 0xffffff,
    wallTop: 0xffffff,
    tree: 0xffffff,
    bush: 0xffffff,
  },
  lava: {
    floor: 0xffe0d5,
    wall: 0xffc8b2,
    wallTop: 0xffe0d5,
    tree: 0xffbdb0,
    bush: 0xffb08f,
  },
};

export class TilemapSystem {
  public container: Container;
  private atlasTexture: Texture | null = null;
  private atlasAttempted = false;
  private wallRects: [number, number, number, number][] = [];
  private cols = 0;
  private rows = 0;
  private tileSize = TS;
  private biomeTextureCache = new Map<MapBiome, BiomeTextureSet>();

  constructor() {
    this.container = new Container();
  }

  async build(mapData: MapData) {
    await this.setMap(mapData);
  }

  private async ensureAtlasTexture() {
    if (this.atlasAttempted) return;
    this.atlasAttempted = true;

    try {
      this.atlasTexture = (await Assets.load(
        "/assets/full_tilemap.png",
      )) as Texture;
      this.atlasTexture.source.scaleMode = SCALE_MODES.NEAREST;
    } catch (err) {
      this.atlasTexture = null;
      console.warn(
        '[TilemapSystem] Unable to load "/assets/full_tilemap.png" — using fallback tiles.',
        err,
      );
    }
  }

  private getBiomeTextures(
    biome: MapBiome,
    createTileTexture: (
      draw: (ctx: CanvasRenderingContext2D) => void,
    ) => Texture,
  ): BiomeTextureSet {
    const cached = this.biomeTextureCache.get(biome);
    if (cached) return cached;

    const makeForest = (): BiomeTextureSet => {
      const floor = [
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

      const wall = [
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

      const wallTop = [
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

      const decorPrimary = [
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

      const decorSecondary = [
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

      return {
        floor,
        wall,
        wallTop,
        decor: {
          primary: decorPrimary,
          secondary: decorSecondary,
          primaryChance: 0.025,
          secondaryChance: 0.045,
          seed: 99,
        },
      };
    };

    const makeIce = (): BiomeTextureSet => {
      const floor = [
        createTileTexture((ctx) => {
          ctx.fillStyle = "#bfe8ff";
          ctx.fillRect(0, 0, TS, TS);
          for (let py = 0; py < TS; py++) {
            for (let px = 0; px < TS; px++) {
              const r = seededRand01(px, py, 41);
              if (r < 0.08) {
                ctx.fillStyle = "#a8ddff";
                ctx.fillRect(px, py, 1, 1);
              } else if (r > 0.95) {
                ctx.fillStyle = "#d7f4ff";
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
        }),
        createTileTexture((ctx) => {
          ctx.fillStyle = "#cfefff";
          ctx.fillRect(0, 0, TS, TS);
          // petites stries
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(0, 2, TS, 1);
          ctx.fillRect(0, 9, TS, 1);
          ctx.fillStyle = "rgba(0,0,0,0.08)";
          ctx.fillRect(0, 12, TS, 1);
        }),
      ];

      const wall = [
        // ice boulder
        createTileTexture((ctx) => {
          ctx.fillStyle = "#94b9cc";
          ctx.fillRect(0, 0, TS, TS);
          for (let py = 0; py < TS; py++) {
            for (let px = 0; px < TS; px++) {
              const r = seededRand01(px, py, 51);
              if (r < 0.08) {
                ctx.fillStyle = "#7fa9c0";
                ctx.fillRect(px, py, 1, 1);
              } else if (r > 0.94) {
                ctx.fillStyle = "#b8d6e6";
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        // ice pillar
        createTileTexture((ctx) => {
          ctx.fillStyle = "#6ad1ff";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(2, 0, 2, TS);
          ctx.fillRect(9, 0, 1, TS);
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        // snow bank
        createTileTexture((ctx) => {
          ctx.fillStyle = "#eaf8ff";
          ctx.fillRect(0, 0, TS, TS);
          for (let py = 0; py < TS; py++) {
            for (let px = 0; px < TS; px++) {
              const r = seededRand01(px, py, 53);
              if (r < 0.08) {
                ctx.fillStyle = "#d7f2ff";
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
          ctx.fillStyle = "rgba(0,0,0,0.08)";
          ctx.fillRect(0, 12, TS, 4);
        }),
      ];

      const wallTop = [
        // ice boulder top
        createTileTexture((ctx) => {
          ctx.fillStyle = "#94b9cc";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(0, 0, TS, 3);
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        // pillar top
        createTileTexture((ctx) => {
          ctx.fillStyle = "#6ad1ff";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(0, 0, TS, 3);
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        // snow top
        createTileTexture((ctx) => {
          ctx.fillStyle = "#eaf8ff";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(0, 0, TS, 3);
          ctx.fillStyle = "rgba(0,0,0,0.08)";
          ctx.fillRect(0, 12, TS, 4);
        }),
      ];

      const decorPrimary = [
        createTileTexture((ctx) => {
          ctx.clearRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(160,240,255,0.95)";
          ctx.fillRect(8, 4, 1, 8);
          ctx.fillRect(6, 7, 1, 5);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(9, 5, 1, 6);
        }),
      ];

      const decorSecondary = [
        createTileTexture((ctx) => {
          ctx.clearRect(0, 0, TS, TS);
          ctx.fillStyle = "#9fb3bf";
          ctx.fillRect(5, 9, 6, 3);
          ctx.fillStyle = "rgba(255,255,255,0.25)";
          ctx.fillRect(6, 9, 2, 1);
        }),
      ];

      return {
        floor,
        wall,
        wallTop,
        decor: {
          primary: decorPrimary,
          secondary: decorSecondary,
          primaryChance: 0.02,
          secondaryChance: 0.035,
          seed: 199,
        },
      };
    };

    const makeDungeon = (): BiomeTextureSet => {
      const floor = [
        createTileTexture((ctx) => {
          ctx.fillStyle = "#34353b";
          ctx.fillRect(0, 0, TS, TS);
          for (let py = 0; py < TS; py++) {
            for (let px = 0; px < TS; px++) {
              const r = seededRand01(px, py, 61);
              if (r < 0.07) {
                ctx.fillStyle = "#2a2b30";
                ctx.fillRect(px, py, 1, 1);
              } else if (r > 0.96) {
                ctx.fillStyle = "#44464d";
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(0, 12, TS, 1);
        }),
        createTileTexture((ctx) => {
          ctx.fillStyle = "#3b3c44";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(0, 0, TS, 1);
          ctx.fillRect(0, 8, TS, 1);
        }),
      ];

      const wall = [
        // bricks
        createTileTexture((ctx) => {
          ctx.fillStyle = "#565864";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          for (let y = 4; y < TS; y += 4) ctx.fillRect(0, y, TS, 1);
          ctx.fillRect(0, 0, 1, TS);
          ctx.fillRect(8, 0, 1, TS);
        }),
        // pillar
        createTileTexture((ctx) => {
          ctx.fillStyle = "#6a6c78";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(2, 0, 2, TS);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        // debris
        createTileTexture((ctx) => {
          ctx.fillStyle = "#4c4e57";
          ctx.fillRect(0, 0, TS, TS);
          for (let i = 0; i < 10; i++) {
            const x = Math.floor(seededRand01(i, 0, 77) * TS);
            const y = Math.floor(seededRand01(i, 1, 77) * TS);
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(x, y, 1, 1);
          }
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
      ];

      const wallTop = [
        createTileTexture((ctx) => {
          ctx.fillStyle = "#565864";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(0, 0, TS, 3);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          for (let y = 4; y < TS; y += 4) ctx.fillRect(0, y, TS, 1);
        }),
        createTileTexture((ctx) => {
          ctx.fillStyle = "#6a6c78";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(0, 0, TS, 3);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        createTileTexture((ctx) => {
          ctx.fillStyle = "#4c4e57";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(0, 0, TS, 3);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
      ];

      const decorPrimary = [
        createTileTexture((ctx) => {
          ctx.clearRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(2, 10, 12, 1);
          ctx.fillRect(6, 6, 1, 6);
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(7, 6, 1, 3);
        }),
      ];

      const decorSecondary = [
        createTileTexture((ctx) => {
          ctx.clearRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(4, 11, 2, 2);
          ctx.fillRect(10, 9, 2, 2);
        }),
      ];

      return {
        floor,
        wall,
        wallTop,
        decor: {
          primary: decorPrimary,
          secondary: decorSecondary,
          primaryChance: 0.03,
          secondaryChance: 0.055,
          seed: 299,
        },
      };
    };

    const makeLava = (): BiomeTextureSet => {
      const floor = [
        createTileTexture((ctx) => {
          ctx.fillStyle = "#2c2326";
          ctx.fillRect(0, 0, TS, TS);
          for (let py = 0; py < TS; py++) {
            for (let px = 0; px < TS; px++) {
              const r = seededRand01(px, py, 71);
              if (r < 0.06) {
                ctx.fillStyle = "#1f1a1c";
                ctx.fillRect(px, py, 1, 1);
              } else if (r > 0.965) {
                ctx.fillStyle = "#ff7a1a";
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
        }),
        createTileTexture((ctx) => {
          ctx.fillStyle = "#2a2023";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,122,26,0.35)";
          ctx.fillRect(0, 6, TS, 1);
          ctx.fillRect(0, 12, TS, 1);
        }),
      ];

      const wall = [
        // basalt
        createTileTexture((ctx) => {
          ctx.fillStyle = "#3a2f33";
          ctx.fillRect(0, 0, TS, TS);
          for (let py = 0; py < TS; py++) {
            for (let px = 0; px < TS; px++) {
              const r = seededRand01(px, py, 81);
              if (r < 0.07) {
                ctx.fillStyle = "#2b2427";
                ctx.fillRect(px, py, 1, 1);
              } else if (r > 0.96) {
                ctx.fillStyle = "#54454b";
                ctx.fillRect(px, py, 1, 1);
              }
            }
          }
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        // obsidian spire
        createTileTexture((ctx) => {
          ctx.fillStyle = "#1c1b1f";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(160,120,255,0.18)";
          ctx.fillRect(3, 0, 1, TS);
          ctx.fillRect(10, 0, 1, TS);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        // magma rock
        createTileTexture((ctx) => {
          ctx.fillStyle = "#4a2a28";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,122,26,0.25)";
          ctx.fillRect(0, 0, TS, 2);
          for (let i = 0; i < 7; i++) {
            const x = Math.floor(seededRand01(i, 0, 88) * TS);
            const y = 6 + Math.floor(seededRand01(i, 1, 88) * 8);
            ctx.fillRect(x, y, 1, 1);
          }
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
      ];

      const wallTop = [
        createTileTexture((ctx) => {
          ctx.fillStyle = "#3a2f33";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(0, 0, TS, 3);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        createTileTexture((ctx) => {
          ctx.fillStyle = "#1c1b1f";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,122,26,0.25)";
          ctx.fillRect(0, 0, TS, 2);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
        createTileTexture((ctx) => {
          ctx.fillStyle = "#4a2a28";
          ctx.fillRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,122,26,0.25)";
          ctx.fillRect(0, 0, TS, 3);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(0, 12, TS, 4);
        }),
      ];

      const decorPrimary = [
        createTileTexture((ctx) => {
          ctx.clearRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(255,122,26,0.9)";
          ctx.fillRect(8, 10, 2, 2);
          ctx.fillRect(4, 12, 1, 1);
          ctx.fillStyle = "rgba(255,220,170,0.8)";
          ctx.fillRect(9, 10, 1, 1);
        }),
      ];

      const decorSecondary = [
        createTileTexture((ctx) => {
          ctx.clearRect(0, 0, TS, TS);
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fillRect(6, 10, 4, 2);
          ctx.fillStyle = "rgba(255,122,26,0.25)";
          ctx.fillRect(7, 10, 1, 1);
        }),
      ];

      return {
        floor,
        wall,
        wallTop,
        decor: {
          primary: decorPrimary,
          secondary: decorSecondary,
          primaryChance: 0.02,
          secondaryChance: 0.04,
          seed: 399,
        },
      };
    };

    const set =
      biome === "forest"
        ? makeForest()
        : biome === "ice"
          ? makeIce()
          : biome === "dungeon"
            ? makeDungeon()
            : makeLava();

    this.biomeTextureCache.set(biome, set);
    return set;
  }

  async setMap(mapData: MapData) {
    await this.ensureAtlasTexture();

    if (mapData.tileSize !== TS) {
      console.warn(
        `[TilemapSystem] Unsupported tileSize=${mapData.tileSize}; expected ${TS}. Rendering may look wrong.`,
      );
    }

    this.cols = mapData.cols;
    this.rows = mapData.rows;
    this.tileSize = mapData.tileSize;
    this.wallRects = mapData.wallRects;

    // Reset cached texture so we can rebuild without stale rendering.
    this.container.cacheAsTexture(false);
    const oldChildren = this.container.removeChildren();
    for (const child of oldChildren) child.destroy();

    const atlasTexture = this.atlasTexture;

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

    const textureSet = this.getBiomeTextures(mapData.biome, createTileTexture);

    const protectedTiles = new Set<string>();
    const protect = (tx: number, ty: number) => {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          protectedTiles.add(`${tx + ox},${ty + oy}`);
        }
      }
    };
    protect(
      Math.floor(mapData.playerSpawn[0] / TS),
      Math.floor(mapData.playerSpawn[1] / TS),
    );
    for (const [sx, sy] of mapData.enemySpawns) {
      protect(Math.floor(sx / TS), Math.floor(sy / TS));
    }

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

    const grid = mapData.grid;
    const rows = mapData.rows;
    const cols = mapData.cols;
    const tints = BIOME_TINTS[mapData.biome];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = grid[y][x];
        if (cell === TILE_EMPTY) continue;

        let texture: Texture;
        let tint = 0xffffff;

        if (atlasTexture) {
          let tileCoords: [number, number];
          if (cell === TILE_FLOOR) {
            tileCoords = seededPick(FLOOR_TILES, x, y);
            tint = tints.floor;
          } else {
            const isTop = y + 1 < rows && grid[y + 1][x] === TILE_FLOOR;
            tileCoords = seededPick(isTop ? WALL_TOP : WALL_TILES, x, y);
            tint = isTop ? tints.wallTop : tints.wall;
            if (cell === TILE_TREE) tint = tints.tree;
            else if (cell === TILE_BUSH) tint = tints.bush;
          }
          texture = getTileTex(tileCoords[0], tileCoords[1]);
        } else if (cell === TILE_FLOOR) {
          texture = seededPick(textureSet.floor, x, y);
        } else {
          const isTop = y + 1 < rows && grid[y + 1][x] === TILE_FLOOR;
          const wallTypeIndex =
            cell === TILE_TREE ? 1 : cell === TILE_BUSH ? 2 : 0;
          const texList = isTop ? textureSet.wallTop : textureSet.wall;
          texture = texList[wallTypeIndex] ?? texList[0];
        }

        const sprite = new Sprite(texture);
        sprite.x = x * TS;
        sprite.y = y * TS;
        sprite.width = TS;
        sprite.height = TS;
        if (atlasTexture) sprite.tint = tint;
        this.container.addChild(sprite);

        if (
          cell === TILE_FLOOR &&
          !atlasTexture &&
          textureSet.decor &&
          !protectedTiles.has(`${x},${y}`)
        ) {
          const roll = seededRand01(x, y, textureSet.decor.seed);
          if (roll < textureSet.decor.primaryChance) {
            const decor = new Sprite(
              seededPick(textureSet.decor.primary, x, y),
            );
            decor.x = x * TS;
            decor.y = y * TS;
            decor.width = TS;
            decor.height = TS;
            this.container.addChild(decor);
          } else if (roll < textureSet.decor.secondaryChance) {
            const decor = new Sprite(
              seededPick(textureSet.decor.secondary, x, y),
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
    if (this.wallRects.length === 0) return;

    for (const id of entities) {
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
      width: this.cols * this.tileSize,
      height: this.rows * this.tileSize,
    };
  }
}
