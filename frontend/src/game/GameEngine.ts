// GameEngine.ts — modifié pour intégrer la map tilemap
import { World } from "./ecs/World";
import { movementSystem } from "./systems/MovementSystem";
import { enemyFollowSystem } from "./systems/EnemyFollowSystem";
import { playerInputSystem } from "./systems/PlayerInputSystem";
import { collisionAvoidanceSystem } from "./systems/CollisionAvoidanceSystem";
import { healthSystem, checkDeath } from "./systems/HealthSystem";
import { ensurePlayerProgress } from "./systems/PlayerProgressSystem";
import {
  attackSystem,
  getAttackTriggered,
  projectileSystem,
} from "./systems/AttackSystem";
import { AnimationSystem } from "./systems/AnimationSystem";
import { TilemapSystem } from "./systems/TilemapSystem"; // ← NOUVEAU
import {
  Position,
  Velocity,
  SpriteComponent,
  Health,
  type PlayerAppearance,
} from "./components";
import { SpriteManifest } from "./components/Animation";
import spritesManifest from "../assets/sprites_manifest.json";
import {
  DEFAULT_MAP_ID,
  getMapData,
  type MapData,
  type MapId,
} from "./systems/MapData"; // ← NOUVEAU

const createSoldierManifest = (): SpriteManifest => ({
  idle: spritesManifest.soldier_walk.slice(0, 1),
  walk: spritesManifest.soldier_walk,
  attack: spritesManifest.soldier_attack,
  death: spritesManifest.soldier_death,
});

const createOrcManifest = (): SpriteManifest => ({
  walk: spritesManifest.orc_walk,
});

export class GameEngine {
  public world: World;
  public animationSystem: AnimationSystem;
  public tilemapSystem: TilemapSystem; // ← NOUVEAU
  public currentMap: MapData;
  private remotePlayerEntities = new Map<string, number>();
  private spawnTimer = 0;
  private readonly spawnInterval = 2500;
  private readonly maxEnemies = 20;
  private spawnIndex = 0; // ← pour tourner sur les spawn points
  private initPromise: Promise<void>;

  constructor() {
    this.world = new World();
    this.animationSystem = new AnimationSystem();
    this.tilemapSystem = new TilemapSystem(); // ← NOUVEAU
    this.currentMap = getMapData(DEFAULT_MAP_ID);
    this.initPromise = this.initGame();
  }

  async initGame() {
    // Construction de la map (async, charge le tileset)
    await this.tilemapSystem.build(this.currentMap); // ← NOUVEAU

    // Joueur spawn sur le point de spawn de la map
    const player = this.world.createEntity();
    this.world.addComponent(player, "PlayerTag", {});
    this.world.addComponent(player, "LocalPlayerTag", {});
    this.world.addComponent<Position>(player, "Position", {
      x: this.currentMap.playerSpawn[0], // ← utilise le spawn de la map
      y: this.currentMap.playerSpawn[1],
    });
    this.world.addComponent<Velocity>(player, "Velocity", {
      vx: 0,
      vy: 0,
      speed: 200,
    });
    this.world.addComponent<Health>(player, "Health", {
      current: 3,
      max: 3,
      isDead: false,
    });
    this.world.addComponent<SpriteComponent>(player, "SpriteComponent", {
      width: 48,
      height: 48,
      anchor: 0.5,
    });
    this.world.addComponent<PlayerAppearance>(player, "PlayerAppearance", {
      name: "You",
      color: 0xffffff,
    });

    await this.animationSystem.loadAnimations(player, createSoldierManifest(), {
      idle: { speed: 1, loop: true },
      walk: { speed: 10, loop: true },
      attack: { speed: 15, loop: false },
      death: { speed: 8, loop: false },
    });

    ensurePlayerProgress(this.world);

    // Spawn des ennemis initiaux sur les points de spawn de la map
    for (let i = 0; i < 10; i++) {
      await this.spawnOrc();
    }
  }

  async changeMap(mapId: MapId) {
    await this.initPromise;

    const nextMap = getMapData(mapId);
    if (this.currentMap.id === nextMap.id) return;

    this.currentMap = nextMap;
    this.spawnTimer = 0;
    this.spawnIndex = 0;

    // Supprime les projectiles + ennemis actuels pour éviter des collisions "fantômes".
    for (const projectile of this.world.query(["ProjectileTag"])) {
      this.world.destroyEntity(projectile);
    }
    for (const enemy of this.world.query(["EnemyTag"])) {
      this.world.destroyEntity(enemy);
    }

    // Rebuild visuel + collisions
    await this.tilemapSystem.setMap(nextMap);

    // Repositionne le joueur au spawn de la nouvelle map
    const players = this.world.query(["PlayerTag", "Position", "Velocity"]);
    if (players.length > 0) {
      const player = players[0];
      const pos = this.world.getComponent<Position>(player, "Position")!;
      const vel = this.world.getComponent<Velocity>(player, "Velocity")!;
      pos.x = nextMap.playerSpawn[0];
      pos.y = nextMap.playerSpawn[1];
      vel.vx = 0;
      vel.vy = 0;
    }

    for (let i = 0; i < 10; i++) {
      await this.spawnOrc();
    }
  }

  getLocalPlayerEntity(): number | null {
    return this.world.query(["PlayerTag", "LocalPlayerTag"])[0] ?? null;
  }

  setLocalPlayerAppearance(name: string, color: number) {
    const player = this.getLocalPlayerEntity();
    if (player === null) return;

    if (!this.world.hasComponent(player, "PlayerAppearance")) {
      this.world.addComponent<PlayerAppearance>(player, "PlayerAppearance", {
        name,
        color,
      });
      return;
    }

    const appearance = this.world.getComponent<PlayerAppearance>(
      player,
      "PlayerAppearance",
    )!;
    appearance.name = name;
    appearance.color = color;
  }

  setLocalNetworkId(id: string) {
    const player = this.getLocalPlayerEntity();
    if (player === null) return;
    this.world.addComponent(player, "NetworkPlayer", { id });
  }

  upsertRemotePlayer(data: {
    id: string;
    name: string;
    color: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
  }) {
    const networkId = data.id;
    if (!networkId) return;

    let entity = this.remotePlayerEntities.get(networkId);
    if (
      entity === undefined ||
      !this.world.hasComponent(entity, "RemotePlayerTag")
    ) {
      entity = this.world.createEntity();
      this.remotePlayerEntities.set(networkId, entity);

      this.world.addComponent(entity, "PlayerTag", {});
      this.world.addComponent(entity, "RemotePlayerTag", {});
      this.world.addComponent(entity, "NetworkPlayer", { id: networkId });
      this.world.addComponent<Position>(entity, "Position", {
        x: data.x,
        y: data.y,
      });
      this.world.addComponent<Velocity>(entity, "Velocity", {
        vx: data.vx,
        vy: data.vy,
        speed: 0,
      });
      this.world.addComponent<SpriteComponent>(entity, "SpriteComponent", {
        width: 48,
        height: 48,
        anchor: 0.5,
      });
      this.world.addComponent<PlayerAppearance>(entity, "PlayerAppearance", {
        name: data.name,
        color: data.color,
      });

      if (!this.animationSystem.hasAnimation(entity)) {
        void this.animationSystem
          .loadAnimations(entity, createSoldierManifest(), {
            idle: { speed: 1, loop: true },
            walk: { speed: 10, loop: true },
            attack: { speed: 15, loop: true },
            death: { speed: 8, loop: false },
          })
          .catch((err) => {
            console.warn(
              "[GameEngine] Failed to load remote player anims",
              err,
            );
          });
      }
    }

    const pos = this.world.getComponent<Position>(entity, "Position");
    if (pos) {
      pos.x = data.x;
      pos.y = data.y;
    }

    const vel = this.world.getComponent<Velocity>(entity, "Velocity");
    if (vel) {
      vel.vx = data.vx;
      vel.vy = data.vy;
      vel.speed = 0;
    }

    const appearance = this.world.getComponent<PlayerAppearance>(
      entity,
      "PlayerAppearance",
    );
    if (appearance) {
      appearance.name = data.name;
      appearance.color = data.color;
    } else {
      this.world.addComponent<PlayerAppearance>(entity, "PlayerAppearance", {
        name: data.name,
        color: data.color,
      });
    }
  }

  removeRemotePlayer(networkId: string) {
    const entity = this.remotePlayerEntities.get(networkId);
    if (entity === undefined) return;
    this.remotePlayerEntities.delete(networkId);
    this.world.destroyEntity(entity);
  }

  getRemotePlayerIds(): string[] {
    return [...this.remotePlayerEntities.keys()];
  }

  update(deltaMS: number) {
    // Safety net: keep progression components present even if init was interrupted.
    ensurePlayerProgress(this.world);

    this.spawnTimer += deltaMS;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      void this.spawnOrc();
    }

    playerInputSystem(this.world);
    attackSystem(this.world, deltaMS);
    projectileSystem(this.world);
    enemyFollowSystem(this.world);
    collisionAvoidanceSystem(this.world);
    movementSystem(this.world, deltaMS);

    // Résolution collisions avec les murs après le mouvement ← NOUVEAU
    this.tilemapSystem.resolveWallCollisions(this.world);

    healthSystem(this.world, deltaMS);
    checkDeath(this.world);
    this.animationSystem.update(this.world, deltaMS);
    this.updateAnimations();
  }

  private async spawnOrc() {
    const enemyCount = this.world.query(["EnemyTag"]).length;
    if (enemyCount >= this.maxEnemies) return;

    // Utilise les spawn points de la map en rotation ← NOUVEAU
    const spawns = this.currentMap.enemySpawns;
    if (spawns.length === 0) return;

    const spawn = spawns[this.spawnIndex % spawns.length];
    this.spawnIndex++;

    // Légère variation aléatoire pour éviter le stacking
    const offsetX = (Math.random() - 0.5) * 32;
    const offsetY = (Math.random() - 0.5) * 32;

    const enemy = this.world.createEntity();
    this.world.addComponent(enemy, "EnemyTag", {});
    this.world.addComponent<Position>(enemy, "Position", {
      x: spawn[0] + offsetX,
      y: spawn[1] + offsetY,
    });
    this.world.addComponent<Velocity>(enemy, "Velocity", {
      vx: 0,
      vy: 0,
      speed: 80,
    });
    this.world.addComponent<Health>(enemy, "Health", {
      current: 3,
      max: 3,
      isDead: false,
    });
    this.world.addComponent<SpriteComponent>(enemy, "SpriteComponent", {
      width: 48,
      height: 48,
      anchor: 0.5,
    });

    await this.animationSystem.loadAnimations(enemy, createOrcManifest(), {
      walk: { speed: 8, loop: true },
    });
  }

  private updateAnimations() {
    const players = this.world.query(["PlayerTag", "Velocity"]);
    for (const player of players) {
      if (this.world.hasComponent(player, "DeadTag")) {
        this.animationSystem.setAnimation(player, "death");
        continue;
      }
      const vel = this.world.getComponent<Velocity>(player, "Velocity")!;
      const isLocal = this.world.hasComponent(player, "LocalPlayerTag");
      if (isLocal && getAttackTriggered()) {
        this.animationSystem.setAnimation(player, "attack");
      } else if (vel.vx !== 0 || vel.vy !== 0) {
        this.animationSystem.setAnimation(player, "walk");
      } else {
        this.animationSystem.setAnimation(player, "idle");
      }
    }

    const enemies = this.world.query(["EnemyTag", "Velocity"]);
    for (const enemy of enemies) {
      const vel = this.world.getComponent<Velocity>(enemy, "Velocity")!;
      if (vel.vx !== 0 || vel.vy !== 0) {
        this.animationSystem.setAnimation(enemy, "walk");
      }
    }
  }
}
