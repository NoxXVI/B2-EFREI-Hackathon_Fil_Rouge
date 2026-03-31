import * as PIXI from "pixi.js";

export type AnimationName = "walk" | "attack" | "death" | "idle";

export type SpriteManifest = {
  [key: string]: string[];
};

export interface AnimationConfig {
  speed: number;
  loop: boolean;
}

export interface SpriteAnimation {
  frames: PIXI.Texture[];
  speed: number;
  loop: boolean;
}

export class AnimationLoader {
  private cache = new Map<string, SpriteAnimation>();
  private loading = new Map<string, Promise<SpriteAnimation>>();

  async loadAnimation(
    manifest: SpriteManifest,
    animationName: AnimationName,
    config: AnimationConfig,
  ): Promise<SpriteAnimation> {
    const key = `${JSON.stringify(manifest)}-${animationName}`;

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    if (this.loading.has(key)) {
      return this.loading.get(key)!;
    }

    const frames = manifest[animationName];
    if (!frames || frames.length === 0) {
      throw new Error(`Animation "${animationName}" not found in manifest`);
    }

    const loadPromise = this.loadFrames(frames, config);
    this.loading.set(key, loadPromise);

    const animation = await loadPromise;
    this.cache.set(key, animation);
    this.loading.delete(key);
    return animation;
  }

  private async loadFrames(
    framePaths: string[],
    config: AnimationConfig,
  ): Promise<SpriteAnimation> {
    const loadPromises = framePaths.map((path) => PIXI.Assets.load(path));
    const loadedTextures = await Promise.all(loadPromises);

    return {
      frames: loadedTextures,
      speed: config.speed,
      loop: config.loop,
    };
  }

  clearCache() {
    this.cache.clear();
  }
}

export const animationLoader = new AnimationLoader();
