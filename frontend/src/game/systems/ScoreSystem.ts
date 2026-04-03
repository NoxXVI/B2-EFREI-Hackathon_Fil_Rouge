import { World } from "../ecs/World";

type LocalKillScore = {
  kills: number;
  pendingKills: number;
};

function getOrCreateScoreEntity(world: World): number {
  const existing = world.query(["ProgressionTag"])[0];
  const entity = existing !== undefined ? existing : world.createEntity();

  if (!world.hasComponent(entity, "ProgressionTag")) {
    world.addComponent(entity, "ProgressionTag", {});
  }

  if (!world.hasComponent(entity, "LocalKillScore")) {
    world.addComponent<LocalKillScore>(entity, "LocalKillScore", {
      kills: 0,
      pendingKills: 0,
    });
  }

  return entity;
}

export function addLocalKills(world: World, count: number) {
  if (!Number.isFinite(count) || count <= 0) return;
  const entity = getOrCreateScoreEntity(world);
  const score = world.getComponent<LocalKillScore>(entity, "LocalKillScore")!;
  score.kills += count;
  score.pendingKills += count;
}

export function consumePendingLocalKills(world: World): number {
  const entity = getOrCreateScoreEntity(world);
  const score = world.getComponent<LocalKillScore>(entity, "LocalKillScore")!;
  const pending = score.pendingKills;
  score.pendingKills = 0;
  return pending;
}

export function getLocalKills(world: World): number {
  const entity = getOrCreateScoreEntity(world);
  const score = world.getComponent<LocalKillScore>(entity, "LocalKillScore")!;
  return score.kills;
}
