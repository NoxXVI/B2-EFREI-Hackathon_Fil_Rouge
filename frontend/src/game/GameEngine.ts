import { World } from "./ecs/World";
import { movementSystem } from "./systems/MovementSystem";
import { enemyFollowSystem } from "./systems/EnemyFollowSystem";
import { playerInputSystem } from "./systems/PlayerInputSystem";
import { collisionAvoidanceSystem } from "./systems/CollisionAvoidanceSystem";
import { AnimationSystem } from "./systems/AnimationSystem";
import { Position, Velocity, SpriteComponent } from "./components";
import { SpriteManifest } from "./components/Animation";

const soldierManifest: SpriteManifest = {
  idle: ["/assets/soldier/walk/soldier_walk_0.png"],
  walk: [
    "/assets/soldier/walk/soldier_walk_0.png",
    "/assets/soldier/walk/soldier_walk_1.png",
    "/assets/soldier/walk/soldier_walk_2.png",
    "/assets/soldier/walk/soldier_walk_3.png",
    "/assets/soldier/walk/soldier_walk_4.png",
    "/assets/soldier/walk/soldier_walk_5.png",
    "/assets/soldier/walk/soldier_walk_6.png",
    "/assets/soldier/walk/soldier_walk_7.png",
  ],
  attack: [
    "/assets/soldier/attack/soldier_attack_0.png",
    "/assets/soldier/attack/soldier_attack_1.png",
    "/assets/soldier/attack/soldier_attack_2.png",
    "/assets/soldier/attack/soldier_attack_3.png",
    "/assets/soldier/attack/soldier_attack_4.png",
    "/assets/soldier/attack/soldier_attack_5.png",
    "/assets/soldier/attack/soldier_attack_6.png",
    "/assets/soldier/attack/soldier_attack_7.png",
    "/assets/soldier/attack/soldier_attack_8.png",
  ],
  death: [
    "/assets/soldier/death/soldier_death_0.png",
    "/assets/soldier/death/soldier_death_1.png",
    "/assets/soldier/death/soldier_death_2.png",
    "/assets/soldier/death/soldier_death_3.png",
  ],
};

const orcManifest: SpriteManifest = {
  walk: [
    "/assets/orc/walk/orc_walk_0.png",
    "/assets/orc/walk/orc_walk_1.png",
    "/assets/orc/walk/orc_walk_2.png",
    "/assets/orc/walk/orc_walk_3.png",
    "/assets/orc/walk/orc_walk_4.png",
    "/assets/orc/walk/orc_walk_5.png",
    "/assets/orc/walk/orc_walk_6.png",
    "/assets/orc/walk/orc_walk_7.png",
  ],
};

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
    this.world.addComponent<SpriteComponent>(player, "SpriteComponent", {
      width: 48,
      height: 48,
      anchor: 0.5
    });

    await this.animationSystem.loadAnimations(
      player,
      soldierManifest,
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
        orcManifest,
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
