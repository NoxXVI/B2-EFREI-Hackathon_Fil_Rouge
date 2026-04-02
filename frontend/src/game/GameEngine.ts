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
import { Position, Velocity, SpriteComponent, Health } from "./components";
import { SpriteManifest } from "./components/Animation";
import spritesManifest from "../assets/sprites_manifest.json";
import { PLAYER_SPAWN, ENEMY_SPAWNS } from "./systems/MapData"; // ← NOUVEAU

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
  private spawnTimer = 0;
  private readonly spawnInterval = 2500;
  private readonly maxEnemies = 20;
  private spawnIndex = 0; // ← pour tourner sur les spawn points

  constructor() {
    this.world = new World();
    this.animationSystem = new AnimationSystem();
    this.tilemapSystem = new TilemapSystem(); // ← NOUVEAU
    this.initGame();
  }

  async initGame() {
    // Construction de la map (async, charge le tileset)
    await this.tilemapSystem.build(); // ← NOUVEAU

    // Joueur spawn sur le point de spawn de la map
    const player = this.world.createEntity();
    this.world.addComponent(player, "PlayerTag", {});
    this.world.addComponent<Position>(player, "Position", {
      x: PLAYER_SPAWN[0], // ← utilise le spawn de la map
      y: PLAYER_SPAWN[1],
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
    const spawn = ENEMY_SPAWNS[this.spawnIndex % ENEMY_SPAWNS.length];
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
      if (getAttackTriggered()) {
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
