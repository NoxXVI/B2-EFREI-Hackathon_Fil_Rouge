# The Arch

Jeu **survival/top‑down shooter** (type roguelite) réalisé avec **React + Pixi.js** côté client, et un petit serveur **WebSocket** côté multi.

- Mode **solo** et **multi (jusqu’à 4 joueurs)**.
- Progression par **niveaux**, choix d’**upgrades**, **boss** régulier, **changement de maps/biomes**, et **pickups** (coeur / super pouvoir).

---

## Prérequis

- **Node.js** recommandé: `>= 18`
- `npm`

---

## Lancer le jeu (solo)

```bash
cd frontend
npm install
npm run dev
```

Ensuite ouvrir l’URL indiquée par Vite (souvent `http://localhost:5173`).

---

## Lancer le jeu (multijoueur)

### 1) Démarrer le serveur WS

```bash
cd server
npm install
npm run dev
```

Par défaut le serveur écoute sur `:3001`.
Vous pouvez changer le port avec:

```bash
PORT=3001 npm run dev
```

Endpoint simple de check:

```bash
curl http://localhost:3001/health
```

### 2) Démarrer le frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend se connecte automatiquement sur:

- `ws://<hostname>:3001` (ou `wss://` si la page est en HTTPS)

### Rooms / lien d’invitation

- Le multi fonctionne par **room** (max **4 joueurs**).
- Vous pouvez partager un lien du style: `http://localhost:5173/?room=ma-room`.

### 3) Option: changer l’URL du serveur WS

Vous pouvez forcer l’URL du WS avec la variable d’environnement:

```bash
VITE_WS_URL=ws://localhost:3001 npm run dev
```

---

## Build (production)

```bash
cd frontend
npm run build
```

---

## Commandes (in‑game)

- Déplacement: **ZQSD / WASD** ou **flèches**
- Viser: **souris**
- Tir: **clic gauche** (maintenir)
- Bouclier: **clic droit**
  - Le bouclier peut aussi s’activer **automatiquement** face aux **bombes** si disponible (anti “oubli”).
- Dash: **Espace**

---

## Gameplay & progression

### Niveaux, XP, points de skill

- Les ennemis donnent de l’XP → montée en niveau.
- À chaque niveau: **+1 point de skill**.
- Les **super pouvoirs** donnent un **upgrade immédiat** + **1 point de skill**.
- Les upgrades disponibles:
  - **Cadence**, **Dégâts**, **Multishot**, **Critique**, **Homing**

### Boss

- Un **boss apparaît tous les 5 niveaux** (si aucun boss vivant).
- Le boss attaque avec des **lasers** (dégâts bloqués par invuln / bouclier).

### Changement de maps / biomes

Le biome change en fonction du niveau (exemples):

- Niveau `1`: Forêt
- `5`: Forêt féerique
- `10`: Donjon
- `20`: Salle du roi
- `25`: Cour du château
- `35`: Champ de bataille
- `40`: Zone rocheuse
- `50`: Volcan

En multi: le **host** demande le changement, puis il faut des **confirmations**.

---

## Armes (auto) — nouvelle arme tous les 5 niveaux

Tous les **5 niveaux**, le joueur reçoit **automatiquement** une nouvelle arme (rotation).

Exemples d’armes:

- **Arbalète**: plus rapide
- **Arc long**: plus lent mais plus fort
- **Arc à fragmentation**: tir en éventail
- **Bâton arcanique**: léger homing

Chaque arme peut influencer:

- cadence (cooldown), dégâts de base, multishot, spread, vitesse/lifetime projectile
- **texture/couleur** du projectile

Le nom de l’arme courante est visible dans le HUD (`Arme: ...`).

---

## Pickups & survie

### Coeur (heal)

- Un **coeur** apparaît parfois sur la map.
- Il rend **+1 PV** (si vous n’êtes pas full).
- Le coeur est visible:
  - sur la **mini‑carte** (point rouge)
  - dans la **boussole/radar** (direction + distance)

### Super pouvoir

- Un **super pouvoir** apparaît parfois sur la map.
- À la récupération: upgrade aléatoire + **+1 point de skill**.
- Visible:
  - sur la **mini‑carte** (point violet)
  - dans la **boussole/radar**

---

## Ennemis spéciaux

### Wizard (lanceur de bombes)

- Apparition à partir de certains niveaux selon la map.
- Le wizard garde ses distances et lance des **bombes** près du joueur.
- La bombe affiche un **cercle rouge** d’avertissement, puis explose.
- Le **bouclier** bloque l’explosion (et peut s’activer automatiquement si dispo).

### Lave (map Volcan)

- Sur le biome **Volcan**, être près de la lave inflige des dégâts.

---

## HUD / UI

Le HUD affiche notamment:

- PV (coeurs), barre d’XP, niveau, map, points de skill
- états **Bouclier** et **Dash** (durée/cooldown)
- arme courante
- boussole + **mini‑carte** (joueur + coeur + super pouvoir)
- en multi: scoreboard des kills

---

## Organisation du code (repères)

### Frontend

- `frontend/src/game/GameEngine.ts`: boucle de jeu, spawns, maps, boss, notifications
- `frontend/src/game/systems/*`: systèmes (input, movement, boss/laser, bombes, dash/bouclier…)
- `frontend/src/game/ui/*`: HUD (Tamagui)
- `frontend/src/ui/screens/*`: écrans (Accueil, Game Over…)

Config utile:

- `frontend/src/game/config/abilities.ts`: durées/cooldowns (bouclier/dash)
- `frontend/src/game/config/weapons.ts`: rotation + stats des armes

### Serveur

- `server/index.js`: serveur WebSocket (`ws`) + rooms + état multi

---

## Outils (optionnels)

- `tools/`: scripts Python utilisés pour manipuler des sprites (crop/splice). Pas nécessaires pour jouer.
