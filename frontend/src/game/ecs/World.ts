// src/game/ecs/World.ts
export type Entity = number;

type ComponentMap = Map<Entity, unknown>;

export class World {
  public entities = new Set<Entity>();
  private nextEntityId: Entity = 0;
  private components = new Map<string, ComponentMap>();

  createEntity(): Entity {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(entity: Entity) {
    this.entities.delete(entity);
    for (const componentMap of this.components.values()) {
      componentMap.delete(entity);
    }
  }

  addComponent<T>(entity: Entity, componentName: string, data: T) {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map<Entity, T>());
    }
    (this.components.get(componentName) as Map<Entity, T>)!.set(entity, data);
  }

  getComponent<T>(entity: Entity, componentName: string): T | undefined {
    return (this.components.get(componentName)?.get(entity) as T) ?? undefined;
  }

  hasComponent(entity: Entity, componentName: string): boolean {
    return this.components.get(componentName)?.has(entity) ?? false;
  }

  query(componentNames: string[]): Entity[] {
    const result: Entity[] = [];

    if (componentNames.length === 0 || this.entities.size === 0) return result;

    let smallestMap: ComponentMap | undefined;
    for (const name of componentNames) {
      const map = this.components.get(name);
      if (!map || map.size === 0) return [];
      if (!smallestMap || map.size < smallestMap.size) {
        smallestMap = map;
      }
    }

    if (!smallestMap) return [];

    for (const entity of smallestMap.keys()) {
      let hasAll = true;
      for (const name of componentNames) {
        if (!this.hasComponent(entity, name)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) {
        result.push(entity);
      }
    }

    return result;
  }
}
