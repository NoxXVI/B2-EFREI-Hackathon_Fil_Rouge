// src/game/ecs/World.ts
export type Entity = number;

export class World {
  private nextEntityId: Entity = 0;
  private entities = new Set<Entity>();
  private components = new Map<string, Map<Entity, any>>();

  /**
   * Créer une nouvelle entité
   */
  createEntity(): Entity {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }

  /**
   * Détruire une entité et ses composants associés
   */
  destroyEntity(entity: Entity) {
    this.entities.delete(entity);
    for (const componentMap of this.components.values()) {
      componentMap.delete(entity);
    }
  }

  /**
   * Ajouter ou modifier un composant sur une entité
   */
  addComponent<T>(entity: Entity, componentName: string, data: T) {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map<Entity, T>());
    }
    this.components.get(componentName)!.set(entity, data);
  }

  /**
   * Récupérer un composant d'une entité
   */
  getComponent<T>(entity: Entity, componentName: string): T | undefined {
    return this.components.get(componentName)?.get(entity) as T | undefined;
  }

  /**
   * Vérifier si une entité possède un composant précis
   */
  hasComponent(entity: Entity, componentName: string): boolean {
    return this.components.get(componentName)?.has(entity) ?? false;
  }

  /**
   * Requêter toutes les entités qui possèdent une liste spécifique de composants
   */
  query(componentNames: string[]): Entity[] {
    const result: Entity[] = [];
    
    // Si la requête est vide ou s'il n'y a pas d'entités, on sort
    if (componentNames.length === 0 || this.entities.size === 0) return result;

    // Trouver le composant le plus "rare" pour optimiser l'itération
    let smallestMap: Map<Entity, any> | undefined;
    for (const name of componentNames) {
      const map = this.components.get(name);
      if (!map || map.size === 0) return []; // Si un composant est vide, la requête retourne vide
      if (!smallestMap || map.size < smallestMap.size) {
        smallestMap = map;
      }
    }

    if (!smallestMap) return [];

    // On itère uniquement sur les entités qui ont le composant le plus rare
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
