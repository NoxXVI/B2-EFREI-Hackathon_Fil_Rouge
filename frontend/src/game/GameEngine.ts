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
import {
  Position,
  Velocity,
  SpriteComponent,
  Health,
  PlayerProgress,
} from "./components";
import { SpriteManifest } from "./components/Animation";
import spritesManifest from "../assets/sprites_manifest.json";

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
  private spawnTimer = 0;
  private readonly initialOrcs = 14;
  private readonly baseSpawnIntervalMS = 1000;
  private readonly minSpawnIntervalMS = 900;
  private readonly spawnIntervalStepPerLevelMS = 120;
  private readonly baseMaxEnemies = 18;
  private readonly maxEnemiesStepPerLevel = 3;
  private readonly worldWidth = 800;
  private readonly worldHeight = 600;
  private readonly spawnRadius = 200;

  constructor() {
    this.world = new World();
    this.animationSystem = new AnimationSystem();
    this.initGame();
  }

  async initGame() {
    const player = this.world.createEntity();
    this.world.addComponent(player, "PlayerTag", {});
    this.world.addComponent<Position>(player, "Position", { x: 400, y: 300 });
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

    const initialLevel = this.getCurrentLevel();
    const initialMaxEnemies = this.getMaxEnemies(initialLevel);
    for (let i = 0; i < this.initialOrcs; i++) {
      await this.spawnOrc(initialMaxEnemies);
    }
  }

  update(deltaMS: number) {
    // Safety net: keep progression components present even if init was interrupted.
    ensurePlayerProgress(this.world);
    const level = this.getCurrentLevel();
    const maxEnemies = this.getMaxEnemies(level);
    const spawnIntervalMS = this.getSpawnIntervalMS(level);

    this.spawnTimer += deltaMS;
    while (this.spawnTimer >= spawnIntervalMS) {
      this.spawnTimer -= spawnIntervalMS;
      void this.spawnOrc(maxEnemies);
    }

    playerInputSystem(this.world);
    attackSystem(this.world, deltaMS);
    projectileSystem(this.world);
    enemyFollowSystem(this.world);
    collisionAvoidanceSystem(this.world);
    movementSystem(this.world, deltaMS);
    healthSystem(this.world, deltaMS);
    checkDeath(this.world);
    this.animationSystem.update(this.world, deltaMS);
    this.updateAnimations();
  }

  private async spawnOrc(maxEnemies: number) {
    const enemyCount = this.world.query(["EnemyTag"]).length;
    if (enemyCount >= maxEnemies) return;

    const player = this.world.query(["PlayerTag", "Position"])[0];
    if (player === undefined) return;
    const playerPos = this.world.getComponent<Position>(player, "Position");
    if (!playerPos) return;

    const angle = Math.random() * Math.PI * 2;
    const spawnX = this.clamp(
      playerPos.x + Math.cos(angle) * this.spawnRadius,
      0,
      this.worldWidth,
    );
    const spawnY = this.clamp(
      playerPos.y + Math.sin(angle) * this.spawnRadius,
      0,
      this.worldHeight,
    );

    const enemy = this.world.createEntity();
    this.world.addComponent(enemy, "EnemyTag", {});
    this.world.addComponent<Position>(enemy, "Position", {
      x: spawnX,
      y: spawnY,
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private getCurrentLevel(): number {
    const progressionEntity = this.world.query([
      "ProgressionTag",
      "PlayerProgress",
    ])[0];
    if (progressionEntity === undefined) return 1;

    const progress = this.world.getComponent<PlayerProgress>(
      progressionEntity,
      "PlayerProgress",
    );
    return progress?.level ?? 1;
  }

  private getMaxEnemies(level: number): number {
    return this.baseMaxEnemies + (level - 1) * this.maxEnemiesStepPerLevel;
  }

  private getSpawnIntervalMS(level: number): number {
    return Math.max(
      this.minSpawnIntervalMS,
      this.baseSpawnIntervalMS - (level - 1) * this.spawnIntervalStepPerLevelMS,
    );
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
