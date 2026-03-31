import { World } from "./ecs/World";
import { movementSystem } from "./systems/MovementSystem";
import { enemyFollowSystem } from "./systems/EnemyFollowSystem";
import { playerInputSystem } from "./systems/PlayerInputSystem";
import { collisionAvoidanceSystem } from "./systems/CollisionAvoidanceSystem";
import { healthSystem, checkDeath } from "./systems/HealthSystem";
import { AnimationSystem } from "./systems/AnimationSystem";
import { Position, Velocity, SpriteComponent, Health } from "./components";
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

  constructor() {
    this.world = new World();
    this.animationSystem = new AnimationSystem();
    this.initGame();
  }

  async initGame() {
    const player = this.world.createEntity();
    this.world.addComponent(player, "PlayerTag", {});
    this.world.addComponent<Position>(player, "Position", { x: 400, y: 300 });
    this.world.addComponent<Velocity>(player, "Velocity", { vx: 0, vy: 0, speed: 200 });
    this.world.addComponent<Health>(player, "Health", { current: 3, max: 3 });
    this.world.addComponent<SpriteComponent>(player, "SpriteComponent", {
      width: 48,
      height: 48,
      anchor: 0.5
    });

    await this.animationSystem.loadAnimations(
      player,
      createSoldierManifest(),
      {
        idle: { speed: 1, loop: true },
        walk: { speed: 10, loop: true },
        attack: { speed: 15, loop: false },
        death: { speed: 8, loop: false },
      }
    );

    for (let i = 0; i < 10; i++) {
      const enemy = this.world.createEntity();
      this.world.addComponent(enemy, "EnemyTag", {});
      this.world.addComponent<Position>(enemy, "Position", {
        x: Math.random() * 800,
        y: Math.random() * 600,
      });
      this.world.addComponent<Velocity>(enemy, "Velocity", { vx: 0, vy: 0, speed: 80 });
      this.world.addComponent<SpriteComponent>(enemy, "SpriteComponent", {
        width: 48,
        height: 48,
        anchor: 0.5
      });

      await this.animationSystem.loadAnimations(
        enemy,
        createOrcManifest(),
        {
          walk: { speed: 8, loop: true },
        }
      );
    }
  }

  update(deltaMS: number) {
    playerInputSystem(this.world);
    enemyFollowSystem(this.world);
    collisionAvoidanceSystem(this.world);
    movementSystem(this.world, deltaMS);
    healthSystem(this.world, deltaMS);
    checkDeath(this.world);
    this.animationSystem.update(this.world, deltaMS);
    this.updateAnimations();
  }

  private updateAnimations() {
    const players = this.world.query(["PlayerTag", "Velocity"]);
    for (const player of players) {
      const vel = this.world.getComponent<Velocity>(player, "Velocity")!;
      if (vel.vx !== 0 || vel.vy !== 0) {
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
