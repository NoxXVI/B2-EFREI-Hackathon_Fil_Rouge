import { World } from "../ecs/World";
import { Position, Velocity } from "../components";

/**
 * Fait en sorte que les entités avec "EnemyTag" se dirigent vers le joueur "PlayerTag"
 */
export function enemyFollowSystem(world: World) {
  const localPlayers = world.query(["PlayerTag", "Position", "LocalPlayerTag"]);
  const players =
    localPlayers.length > 0
      ? localPlayers
      : world.query(["PlayerTag", "Position"]);
  const enemies = world.query(["EnemyTag", "Position", "Velocity"]);

  if (players.length === 0) return;

  // S'il y a plusieurs joueurs (co-op?), on prend le premier pour l'instant
  const playerEntity = players[0];
  const playerPos = world.getComponent<Position>(playerEntity, "Position")!;

  for (const enemy of enemies) {
    const enemyPos = world.getComponent<Position>(enemy, "Position")!;
    const enemyVel = world.getComponent<Velocity>(enemy, "Velocity")!;

    // Calcul du vecteur de direction vers le joueur
    const dx = playerPos.x - enemyPos.x;
    const dy = playerPos.y - enemyPos.y;

    // Normalisation basique (la normalisation finale sera faite dans le MovementSystem)
    // Ici on assigne juste la direction
    enemyVel.vx = dx;
    enemyVel.vy = dy;
  }
}
