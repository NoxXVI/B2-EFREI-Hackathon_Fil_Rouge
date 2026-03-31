import * as PIXI from "pixi.js";
import { World, Entity } from "../ecs/World";
import { Position, Velocity } from "./components";
import { SpriteAnimation, AnimationName, SpriteManifest, AnimationConfig, animationLoader } from "../components/Animation";

export interface AnimationState {
  current: AnimationName;
  timer: number;
  frameIndex: number;
}

export class AnimationSystem {
  private animations = new Map<Entity, AnimationState>();
  private animationData = new Map<Entity, Map<AnimationName, SpriteAnimation>>();

  async loadAnimations(
    entity: Entity,
    manifest: SpriteManifest,
    config: Partial<Record<AnimationName, AnimationConfig>>
  ) {
    const animMap = new Map<AnimationName, SpriteAnimation>();
    const defaultConfig: AnimationConfig = { speed: 10, loop: true };

    for (const animName of Object.keys(manifest)) {
      const animConfig = config[animName] ?? defaultConfig;
      const animation = await animationLoader.loadAnimation(
        manifest,
        animName as AnimationName,
        animConfig
      );
      animMap.set(animName as AnimationName, animation);
    }

    this.animationData.set(entity, animMap);
    this.animations.set(entity, {
      current: "idle",
      timer: 0,
      frameIndex: 0,
    });
  }

  setAnimation(entity: Entity, name: AnimationName) {
    const state = this.animations.get(entity);
    if (state && state.current !== name) {
      state.current = name;
      state.frameIndex = 0;
      state.timer = 0;
    }
  }

  update(world: World, deltaMS: number) {
    const entitiesWithAnim = world.query(["Position", "Velocity"]);

    for (const entity of entitiesWithAnim) {
      const state = this.animations.get(entity);
      if (!state) continue;

      const anims = this.animationData.get(entity);
      if (!anims) continue;

      const currentAnim = anims.get(state.current);
      if (!currentAnim) continue;

      state.timer += deltaMS;
      const frameDuration = 1000 / currentAnim.speed;

      if (state.timer >= frameDuration) {
        state.timer -= frameDuration;
        state.frameIndex++;

        if (state.frameIndex >= currentAnim.frames.length) {
          if (currentAnim.loop) {
            state.frameIndex = 0;
          } else {
            state.frameIndex = currentAnim.frames.length - 1;
          }
        }
      }
    }
  }

  getCurrentTexture(entity: Entity): PIXI.Texture | null {
    const state = this.animations.get(entity);
    if (!state) return null;

    const anims = this.animationData.get(entity);
    if (!anims) return null;

    const currentAnim = anims.get(state.current);
    if (!currentAnim) return null;

    return currentAnim.frames[state.frameIndex] ?? null;
  }

  hasAnimation(entity: Entity): boolean {
    return this.animations.has(entity);
  }
}
